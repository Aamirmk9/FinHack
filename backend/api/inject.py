"""Live transaction injection endpoint — accepts new transactions and incrementally updates the pipeline."""

import hashlib
import random
from collections import defaultdict
from datetime import datetime

import numpy as np
import pandas as pd
from fastapi import APIRouter
from pydantic import BaseModel

from api.routes import _state, set_state
from api.websocket import manager
from engine.features import compute_node_features, compute_cluster_features
from engine.community import detect_communities
from engine.risk_scorer import score_clusters
from engine.typology import classify_all_clusters
from engine.freeze_priority import compute_all_freeze_priorities
from engine.known_actors import scan_all_clusters

inject_router = APIRouter(prefix="/api")


class TransactionRequest(BaseModel):
    from_address: str
    to_address: str
    amount: float
    # Optional: force a pattern label for demo purposes
    pattern_type: str | None = None


def _make_tx_hash() -> str:
    return "0x" + hashlib.sha256(random.randbytes(32)).hexdigest()


@inject_router.post("/inject")
async def inject_transaction(txn: TransactionRequest):
    """Inject a live transaction, incrementally update detection pipeline, and broadcast."""

    transactions = _state["transactions"]
    graph = _state["graph"]
    wallet_scores = _state["wallet_scores"]
    labels = _state["labels"]

    # 1. Create the new transaction record
    new_txn = {
        "tx_hash": _make_tx_hash(),
        "from_address": txn.from_address,
        "to_address": txn.to_address,
        "amount": txn.amount,
        "timestamp": datetime.now(),
        "pattern_type": txn.pattern_type,
    }

    # 2. Append to transactions DataFrame
    new_row = pd.DataFrame([new_txn])
    updated_txns = pd.concat([transactions, new_row], ignore_index=True)
    set_state("transactions", updated_txns)

    # 3. Incrementally update the graph
    sender = txn.from_address
    receiver = txn.to_address

    # Add nodes if new
    for addr in (sender, receiver):
        if not graph.has_node(addr):
            graph.add_node(
                addr,
                total_sent=0.0,
                total_received=0.0,
                tx_count=0,
                first_active=str(datetime.now()),
                last_active=str(datetime.now()),
                active_hours=0.0,
            )
            # New wallets get "legitimate" label by default (unknown)
            labels[addr] = "legitimate"

    # Update node attributes
    graph.nodes[sender]["total_sent"] = round(
        graph.nodes[sender].get("total_sent", 0) + txn.amount, 2
    )
    graph.nodes[sender]["tx_count"] = graph.nodes[sender].get("tx_count", 0) + 1
    graph.nodes[sender]["last_active"] = str(datetime.now())

    graph.nodes[receiver]["total_received"] = round(
        graph.nodes[receiver].get("total_received", 0) + txn.amount, 2
    )
    graph.nodes[receiver]["tx_count"] = graph.nodes[receiver].get("tx_count", 0) + 1
    graph.nodes[receiver]["last_active"] = str(datetime.now())

    # Add/update edge
    if graph.has_edge(sender, receiver):
        edge = graph.edges[sender, receiver]
        edge["total_amount"] = round(edge["total_amount"] + txn.amount, 2)
        edge["tx_count"] += 1
        edge["last_tx"] = str(datetime.now())
    else:
        graph.add_edge(
            sender, receiver,
            total_amount=round(txn.amount, 2),
            tx_count=1,
            avg_amount=round(txn.amount, 2),
            min_amount=round(txn.amount, 2),
            max_amount=round(txn.amount, 2),
            first_tx=str(datetime.now()),
            last_tx=str(datetime.now()),
            time_span_hours=0.0,
        )

    # 4. Re-run community detection
    communities = detect_communities(graph)
    set_state("communities", communities)

    # 5. Re-compute features
    node_features = compute_node_features(graph, communities)
    cluster_features = compute_cluster_features(graph, communities, node_features)
    set_state("node_features", node_features)
    set_state("cluster_features", cluster_features)

    # 6. Re-run detection on ALL nodes (uses trained model from startup)
    # Rule-based detection
    from engine.detector import RuleBasedDetector
    rule_detector = RuleBasedDetector()
    rule_flags = rule_detector.detect(graph, updated_txns, node_features)

    # Use stored ML model for prediction
    detector = _state.get("_detector")
    if detector:
        ml_probas = detector.ml_detector.predict_proba(node_features)
    else:
        ml_probas = {addr: 0.0 for addr in node_features}

    # Rebuild wallet scores
    new_wallet_scores = {}
    for addr in node_features:
        flags = rule_flags.get(addr, [])
        ml_prob = ml_probas.get(addr, 0.0)
        rule_score = min(len(flags) * 12, 50)
        ml_score = ml_prob * 50
        composite = min(round(rule_score + ml_score, 1), 100)
        new_wallet_scores[addr] = {
            "score": composite, "rule_score": rule_score,
            "ml_score": round(ml_score, 1), "ml_probability": ml_prob,
            "flags": flags, "n_flags": len(flags),
        }
    set_state("wallet_scores", new_wallet_scores)

    # 7. Re-score clusters
    cluster_scores = score_clusters(cluster_features, new_wallet_scores)
    set_state("cluster_scores", cluster_scores)

    # 8. Re-classify typologies
    typologies = classify_all_clusters(cluster_scores, new_wallet_scores, updated_txns)
    set_state("typologies", typologies)

    # 9. Re-compute freeze priorities
    freeze_priorities = compute_all_freeze_priorities(
        cluster_scores, new_wallet_scores, updated_txns, typologies
    )
    set_state("freeze_priorities", freeze_priorities)

    # 10. Re-scan known actors
    known_actor_results = scan_all_clusters(
        cluster_scores, new_wallet_scores, typologies, freeze_priorities
    )
    set_state("known_actor_results", known_actor_results)

    # Build the update payload
    sender_score = new_wallet_scores.get(sender, {})
    receiver_score = new_wallet_scores.get(receiver, {})

    # Find which cluster the affected wallets are in
    sender_cluster = communities.get(sender, -1)
    receiver_cluster = communities.get(receiver, -1)

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
            "cluster": sender_cluster,
        },
        "receiver": {
            "address": receiver,
            "score": receiver_score.get("score", 0),
            "flags": receiver_score.get("flags", []),
            "cluster": receiver_cluster,
        },
        "alert": None,
    }

    # Check if this triggered a new high-risk alert
    for cid in (sender_cluster, receiver_cluster):
        if cid in cluster_scores and cluster_scores[cid]["score"] >= 40:
            cs = cluster_scores[cid]
            typo = typologies.get(cid, {})
            update["alert"] = {
                "cluster_id": cid,
                "score": cs["score"],
                "risk_level": cs["risk_level"],
                "typology": typo.get("name", "Unclassified"),
                "size": cs["size"],
            }
            break

    # 11. Broadcast to all connected WebSocket clients
    await manager.broadcast(update)

    return {
        "status": "injected",
        "tx_hash": new_txn["tx_hash"],
        "sender_score": sender_score.get("score", 0),
        "receiver_score": receiver_score.get("score", 0),
        "alert": update["alert"],
    }
