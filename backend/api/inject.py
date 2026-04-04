"""Live transaction injection — FAST path for demo presentations."""

import hashlib
import random
from datetime import datetime
from typing import Optional

import numpy as np
import pandas as pd
from fastapi import APIRouter
from pydantic import BaseModel

from api.routes import _state, set_state
from api.websocket import manager

inject_router = APIRouter(prefix="/api")


class TransactionRequest(BaseModel):
    from_address: str
    to_address: str
    amount: float
    pattern_type: Optional[str] = None


def _make_tx_hash() -> str:
    return "0x" + hashlib.sha256(random.randbytes(32)).hexdigest()


@inject_router.post("/inject")
async def inject_transaction(txn: TransactionRequest):
    """Fast injection: updates graph, quick-scores, broadcasts instantly."""

    graph = _state["graph"]
    transactions = _state["transactions"]
    wallet_scores = _state.get("wallet_scores", {})
    communities = _state.get("communities", {})
    labels = _state.get("labels", {})
    cluster_scores = _state.get("cluster_scores", {})
    typologies = _state.get("typologies", {})

    # 1. Create transaction record
    new_txn = {
        "tx_hash": _make_tx_hash(),
        "from_address": txn.from_address,
        "to_address": txn.to_address,
        "amount": txn.amount,
        "timestamp": datetime.now(),
        "pattern_type": txn.pattern_type,
    }

    # 2. Append to transactions
    new_row = pd.DataFrame([new_txn])
    updated_txns = pd.concat([transactions, new_row], ignore_index=True)
    set_state("transactions", updated_txns)

    sender = txn.from_address
    receiver = txn.to_address

    # 3. Add nodes if new
    for addr in (sender, receiver):
        if not graph.has_node(addr):
            graph.add_node(
                addr,
                total_sent=0.0, total_received=0.0, tx_count=0,
                first_active=str(datetime.now()),
                last_active=str(datetime.now()),
                active_hours=0.0,
            )
            labels[addr] = "legitimate"

    # 4. Update graph attributes
    graph.nodes[sender]["total_sent"] = round(
        graph.nodes[sender].get("total_sent", 0) + txn.amount, 2)
    graph.nodes[sender]["tx_count"] = graph.nodes[sender].get("tx_count", 0) + 1
    graph.nodes[sender]["last_active"] = str(datetime.now())

    graph.nodes[receiver]["total_received"] = round(
        graph.nodes[receiver].get("total_received", 0) + txn.amount, 2)
    graph.nodes[receiver]["tx_count"] = graph.nodes[receiver].get("tx_count", 0) + 1
    graph.nodes[receiver]["last_active"] = str(datetime.now())

    if graph.has_edge(sender, receiver):
        edge = graph.edges[sender, receiver]
        edge["total_amount"] = round(edge["total_amount"] + txn.amount, 2)
        edge["tx_count"] += 1
        edge["last_tx"] = str(datetime.now())
    else:
        graph.add_edge(
            sender, receiver,
            total_amount=round(txn.amount, 2), tx_count=1,
            avg_amount=round(txn.amount, 2),
            min_amount=round(txn.amount, 2), max_amount=round(txn.amount, 2),
            first_tx=str(datetime.now()), last_tx=str(datetime.now()),
            time_span_hours=0.0,
        )

    # 5. FAST scoring — skip full Louvain / full feature recomputation
    #    Use quick heuristics + existing ML model for instant response
    sender_community = communities.get(sender)
    receiver_community = communities.get(receiver)

    # Assign new wallets to a fresh demo community
    if sender_community is None:
        demo_cid = max(communities.values(), default=0) + 1
        communities[sender] = demo_cid
        sender_community = demo_cid
    if receiver_community is None:
        if receiver_community is None and sender_community:
            communities[receiver] = sender_community
            receiver_community = sender_community
        else:
            demo_cid = max(communities.values(), default=0) + 1
            communities[receiver] = demo_cid
            receiver_community = demo_cid
    set_state("communities", communities)

    # Quick-score the two wallets involved
    detector = _state.get("_detector")
    for addr in (sender, receiver):
        node_data = graph.nodes[addr]
        in_deg = graph.in_degree(addr)
        out_deg = graph.out_degree(addr)
        total_sent = node_data.get("total_sent", 0)
        total_received = node_data.get("total_received", 0)
        tx_count = node_data.get("tx_count", 1)
        avg_tx = (total_sent + total_received) / max(tx_count, 1)

        # Rule-based flags (fast)
        flags = []
        if txn.amount >= 8500 and txn.amount <= 9999:
            flags.append("structuring_detected")
        if txn.amount >= 15000:
            flags.append("high_value_transfer")
        if out_deg > 10:
            flags.append("fan_out_pattern")
        if in_deg > 10:
            flags.append("fan_in_pattern")

        rule_score = min(len(flags) * 15, 50)

        # ML score from trained model (fast — single prediction)
        ml_prob = 0.0
        if detector and hasattr(detector, 'ml_detector'):
            try:
                features = {
                    "in_degree": in_deg, "out_degree": out_deg,
                    "total_sent": total_sent, "total_received": total_received,
                    "tx_count": tx_count, "avg_tx_size": avg_tx,
                    "in_out_ratio": total_received / max(total_sent, 0.01),
                    "activity_burst_score": tx_count / max(node_data.get("active_hours", 1), 0.1),
                    "active_hours": node_data.get("active_hours", 0),
                }
                feat_array = np.array([[features[f] for f in [
                    "in_degree", "out_degree", "total_sent", "total_received",
                    "tx_count", "avg_tx_size", "in_out_ratio",
                    "activity_burst_score", "active_hours"
                ]]])
                ml_prob = float(detector.ml_detector.model.predict_proba(feat_array)[0][1])
            except Exception:
                ml_prob = 0.0

        ml_score = ml_prob * 50

        # Boost score for high-value transactions (demo reliability)
        amount_boost = 0
        if txn.amount >= 50000:
            amount_boost = 25
        elif txn.amount >= 25000:
            amount_boost = 18
        elif txn.amount >= 15000:
            amount_boost = 12

        composite = min(round(rule_score + ml_score + amount_boost, 1), 100)

        wallet_scores[addr] = {
            "score": composite, "rule_score": rule_score,
            "ml_score": round(ml_score, 1), "ml_probability": ml_prob,
            "flags": flags, "n_flags": len(flags),
        }

    set_state("wallet_scores", wallet_scores)

    # 6. Quick cluster scoring for affected clusters
    for cid in set([sender_community, receiver_community]):
        if cid is None:
            continue
        members = [a for a, c in communities.items() if c == cid]
        member_scores = [wallet_scores.get(a, {}).get("score", 0) for a in members]
        if not member_scores:
            continue
        avg_s = sum(member_scores) / len(member_scores)
        max_s = max(member_scores)
        cluster_score = round(avg_s * 0.4 + max_s * 0.6, 1)

        risk_level = "low"
        if cluster_score >= 70:
            risk_level = "critical"
        elif cluster_score >= 40:
            risk_level = "high"
        elif cluster_score >= 20:
            risk_level = "medium"

        cluster_scores[cid] = {
            "cluster_id": cid, "score": cluster_score,
            "risk_level": risk_level, "size": len(members),
            "total_volume": sum(
                wallet_scores.get(a, {}).get("score", 0) for a in members
            ),
            "flags": list(set(
                f for a in members
                for f in wallet_scores.get(a, {}).get("flags", [])
            )),
            "top_wallets": sorted(
                [{"address": a, "score": wallet_scores.get(a, {}).get("score", 0)} for a in members],
                key=lambda x: x["score"], reverse=True
            )[:5],
        }

    set_state("cluster_scores", cluster_scores)

    # 7. Quick typology for demo
    for cid in set([sender_community, receiver_community]):
        if cid is None or cid not in cluster_scores:
            continue
        cs = cluster_scores[cid]
        flags = cs.get("flags", [])
        if "structuring_detected" in flags:
            typologies[cid] = {
                "name": "Structuring", "fincen_code": "SAR-ML-002",
                "typology_key": "structuring", "confidence": 85,
                "indicators": ["Multiple sub-threshold transactions", "Pattern consistent with CTR evasion"],
            }
        elif "high_value_transfer" in flags:
            typologies[cid] = {
                "name": "Layering", "fincen_code": "SAR-ML-001",
                "typology_key": "layering", "confidence": 78,
                "indicators": ["High-value fund movement", "Transfer to unknown entity", "Potential layering activity"],
            }
        elif cs["score"] >= 40:
            typologies[cid] = {
                "name": "Suspicious Activity", "fincen_code": "SAR-ML-006",
                "typology_key": "suspicious", "confidence": 65,
                "indicators": ["Elevated risk scoring", "Anomalous transaction pattern"],
            }
    set_state("typologies", typologies)

    # Build response payload
    sender_score = wallet_scores.get(sender, {})
    receiver_score = wallet_scores.get(receiver, {})

    update = {
        "type": "transaction_injected",
        "transaction": {
            "tx_hash": new_txn["tx_hash"],
            "from_address": sender,
            "to_address": receiver,
            "amount": txn.amount,
            "timestamp": str(new_txn["timestamp"]),
            "pattern_type": txn.pattern_type,
        },
        "sender": {
            "address": sender,
            "score": sender_score.get("score", 0),
            "flags": sender_score.get("flags", []),
            "cluster": sender_community,
        },
        "receiver": {
            "address": receiver,
            "score": receiver_score.get("score", 0),
            "flags": receiver_score.get("flags", []),
            "cluster": receiver_community,
        },
        "alert": None,
    }

    # Check for alert (lower threshold for demo responsiveness)
    for cid in (sender_community, receiver_community):
        if cid in cluster_scores and cluster_scores[cid]["score"] >= 25:
            cs = cluster_scores[cid]
            typo = typologies.get(cid, {})
            update["alert"] = {
                "cluster_id": cid,
                "score": cs["score"],
                "risk_level": cs["risk_level"],
                "typology": typo.get("name", "Suspicious Activity"),
                "size": cs["size"],
            }
            break

    # Broadcast via WebSocket
    await manager.broadcast(update)

    return {
        "status": "injected",
        "tx_hash": new_txn["tx_hash"],
        "sender_score": sender_score.get("score", 0),
        "receiver_score": receiver_score.get("score", 0),
        "alert": update["alert"],
    }
