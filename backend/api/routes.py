"""FastAPI route definitions."""

import pandas as pd
from fastapi import APIRouter, Query

router = APIRouter(prefix="/api")

_state = {
    "transactions": None, "labels": None, "graph": None,
    "communities": None, "node_features": None, "cluster_features": None,
    "wallet_scores": None, "cluster_scores": None, "ml_metrics": None,
}


def set_state(key, value):
    _state[key] = value


@router.get("/stats")
def get_stats():
    txns = _state["transactions"]
    wallet_scores = _state["wallet_scores"]
    cluster_scores = _state["cluster_scores"]
    ml_metrics = _state["ml_metrics"]

    high_risk = sum(1 for s in wallet_scores.values() if s["score"] >= 70)
    medium_risk = sum(1 for s in wallet_scores.values() if 40 <= s["score"] < 70)
    critical_clusters = sum(1 for c in cluster_scores.values() if c["risk_level"] == "critical")

    return {
        "total_transactions": len(txns),
        "total_wallets": len(wallet_scores),
        "total_clusters": len(cluster_scores),
        "high_risk_wallets": high_risk,
        "medium_risk_wallets": medium_risk,
        "critical_clusters": critical_clusters,
        "ml_metrics": ml_metrics,
    }


@router.get("/network")
def get_network(min_score: float = Query(0, ge=0, le=100), max_nodes: int = Query(500, ge=10, le=5000)):
    wallet_scores = _state["wallet_scores"]
    graph = _state["graph"]
    communities = _state["communities"]

    scored_nodes = sorted(wallet_scores.items(), key=lambda x: x[1]["score"], reverse=True)
    filtered = [(addr, data) for addr, data in scored_nodes if data["score"] >= min_score][:max_nodes]
    filtered_addrs = {addr for addr, _ in filtered}

    nodes = []
    for addr, data in filtered:
        node_data = graph.nodes.get(addr, {})
        nodes.append({
            "id": addr, "score": data["score"],
            "risk_level": "critical" if data["score"] >= 70 else "high" if data["score"] >= 40 else "medium" if data["score"] >= 20 else "low",
            "flags": data["flags"], "community": communities.get(addr, -1),
            "total_sent": node_data.get("total_sent", 0),
            "total_received": node_data.get("total_received", 0),
            "tx_count": node_data.get("tx_count", 0),
        })

    edges = []
    for u, v, data in graph.edges(data=True):
        if u in filtered_addrs and v in filtered_addrs:
            edges.append({
                "source": u, "target": v,
                "total_amount": data.get("total_amount", 0),
                "tx_count": data.get("tx_count", 0),
            })

    return {"nodes": nodes, "edges": edges}


@router.get("/alerts")
def get_alerts(limit: int = Query(20, ge=1, le=100)):
    cluster_scores = _state["cluster_scores"]
    sorted_clusters = sorted(cluster_scores.values(), key=lambda x: x["score"], reverse=True)[:limit]
    return [{
        "cluster_id": c["cluster_id"], "score": c["score"], "risk_level": c["risk_level"],
        "size": c["size"], "total_volume": c["total_volume"],
        "flags": c["flags"], "top_wallets": c["top_wallets"],
    } for c in sorted_clusters]


@router.get("/cluster/{cluster_id}")
def get_cluster(cluster_id: int):
    cluster_scores = _state["cluster_scores"]
    if cluster_id not in cluster_scores:
        return {"error": "Cluster not found"}

    cluster = cluster_scores[cluster_id]
    members = cluster["members"]
    txns = _state["transactions"]
    wallet_scores = _state["wallet_scores"]

    member_set = set(members)
    cluster_txns = txns[txns["from_address"].isin(member_set) & txns["to_address"].isin(member_set)].copy()
    cluster_txns["timestamp"] = cluster_txns["timestamp"].astype(str)

    wallet_details = []
    for m in members:
        if m in wallet_scores:
            ws = wallet_scores[m]
            nd = _state["graph"].nodes.get(m, {})
            wallet_details.append({
                "address": m, "score": ws["score"], "flags": ws["flags"],
                "total_sent": nd.get("total_sent", 0),
                "total_received": nd.get("total_received", 0),
                "tx_count": nd.get("tx_count", 0),
            })
    wallet_details.sort(key=lambda x: x["score"], reverse=True)

    return {
        "cluster_id": cluster_id, "score": cluster["score"],
        "risk_level": cluster["risk_level"], "size": cluster["size"],
        "density": cluster["density"], "total_volume": cluster["total_volume"],
        "flags": cluster["flags"], "wallets": wallet_details,
        "transactions": cluster_txns.to_dict(orient="records"),
    }


@router.get("/wallet/{address}")
def get_wallet(address: str):
    wallet_scores = _state["wallet_scores"]
    if address not in wallet_scores:
        return {"error": "Wallet not found"}

    ws = wallet_scores[address]
    nd = _state["graph"].nodes.get(address, {})
    community = _state["communities"].get(address, -1)
    txns = _state["transactions"]

    wallet_txns = txns[(txns["from_address"] == address) | (txns["to_address"] == address)].copy()
    wallet_txns["timestamp"] = wallet_txns["timestamp"].astype(str)

    return {
        "address": address, "score": ws["score"],
        "rule_score": ws["rule_score"], "ml_score": ws["ml_score"],
        "ml_probability": ws["ml_probability"], "flags": ws["flags"],
        "community": community,
        "total_sent": nd.get("total_sent", 0),
        "total_received": nd.get("total_received", 0),
        "tx_count": nd.get("tx_count", 0),
        "first_active": nd.get("first_active"),
        "last_active": nd.get("last_active"),
        "transactions": wallet_txns.head(100).to_dict(orient="records"),
    }


@router.get("/timeline/{cluster_id}")
def get_timeline(cluster_id: int):
    cluster_scores = _state["cluster_scores"]
    if cluster_id not in cluster_scores:
        return {"error": "Cluster not found"}

    members = set(cluster_scores[cluster_id]["members"])
    txns = _state["transactions"]

    cluster_txns = txns[txns["from_address"].isin(members) & txns["to_address"].isin(members)].copy()
    if cluster_txns.empty:
        return {"cluster_id": cluster_id, "timeline": []}

    cluster_txns["timestamp"] = pd.to_datetime(cluster_txns["timestamp"])
    cluster_txns = cluster_txns.sort_values("timestamp")

    entries = []
    for _, row in cluster_txns.iterrows():
        entries.append({
            "timestamp": str(row["timestamp"]), "from": row["from_address"],
            "to": row["to_address"], "amount": row["amount"],
            "pattern_type": row.get("pattern_type"),
        })

    return {"cluster_id": cluster_id, "timeline": entries}


@router.get("/compare")
def get_compare():
    wallet_scores = _state["wallet_scores"]
    labels = _state["labels"]

    rule_tp = rule_fp = rule_fn = rule_tn = 0
    ml_tp = ml_fp = ml_fn = ml_tn = 0
    hybrid_tp = hybrid_fp = hybrid_fn = hybrid_tn = 0

    for addr, score_data in wallet_scores.items():
        if addr not in labels:
            continue
        actual = labels[addr] == "suspicious"
        rule_pred = score_data["rule_score"] >= 12
        ml_pred = score_data["ml_probability"] >= 0.5
        hybrid_pred = score_data["score"] >= 40

        if actual and rule_pred: rule_tp += 1
        elif not actual and rule_pred: rule_fp += 1
        elif actual and not rule_pred: rule_fn += 1
        else: rule_tn += 1

        if actual and ml_pred: ml_tp += 1
        elif not actual and ml_pred: ml_fp += 1
        elif actual and not ml_pred: ml_fn += 1
        else: ml_tn += 1

        if actual and hybrid_pred: hybrid_tp += 1
        elif not actual and hybrid_pred: hybrid_fp += 1
        elif actual and not hybrid_pred: hybrid_fn += 1
        else: hybrid_tn += 1

    def calc_metrics(tp, fp, fn, tn):
        precision = tp / (tp + fp) if (tp + fp) > 0 else 0
        recall = tp / (tp + fn) if (tp + fn) > 0 else 0
        f1 = 2 * precision * recall / (precision + recall) if (precision + recall) > 0 else 0
        accuracy = (tp + tn) / (tp + fp + fn + tn) if (tp + fp + fn + tn) > 0 else 0
        return {"precision": round(precision, 4), "recall": round(recall, 4),
                "f1": round(f1, 4), "accuracy": round(accuracy, 4),
                "true_positives": tp, "false_positives": fp}

    return {
        "rule_based": calc_metrics(rule_tp, rule_fp, rule_fn, rule_tn),
        "ml_only": calc_metrics(ml_tp, ml_fp, ml_fn, ml_tn),
        "hybrid": calc_metrics(hybrid_tp, hybrid_fp, hybrid_fn, hybrid_tn),
    }
