"""FastAPI route definitions."""

import os

import pandas as pd
from fastapi import APIRouter, Query

router = APIRouter(prefix="/api")

_state = {
    "transactions": None, "labels": None, "graph": None,
    "communities": None, "node_features": None, "cluster_features": None,
    "wallet_scores": None, "cluster_scores": None, "ml_metrics": None,
    "typologies": None, "freeze_priorities": None, "known_actor_results": None,
}


def set_state(key, value):
    _state[key] = value


@router.get("/stats")
def get_stats():
    txns = _state["transactions"]
    wallet_scores = _state["wallet_scores"]
    cluster_scores = _state["cluster_scores"]
    ml_metrics = _state["ml_metrics"]
    freeze_priorities = _state["freeze_priorities"] or {}

    high_risk = sum(1 for s in wallet_scores.values() if s["score"] >= 70)
    medium_risk = sum(1 for s in wallet_scores.values() if 40 <= s["score"] < 70)
    critical_clusters = sum(1 for c in cluster_scores.values() if c["risk_level"] == "critical")
    urgent_cases = sum(1 for fp in freeze_priorities.values() if fp.get("urgency") in ("critical", "high"))

    return {
        "total_transactions": len(txns),
        "total_wallets": len(wallet_scores),
        "total_clusters": len(cluster_scores),
        "high_risk_wallets": high_risk,
        "medium_risk_wallets": medium_risk,
        "critical_clusters": critical_clusters,
        "urgent_cases": urgent_cases,
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
    typologies = _state["typologies"] or {}
    freeze_priorities = _state["freeze_priorities"] or {}
    known_actor_results = _state["known_actor_results"] or {}

    sorted_clusters = sorted(cluster_scores.values(), key=lambda x: x["score"], reverse=True)[:limit]
    results = []
    for c in sorted_clusters:
        cid = c["cluster_id"]
        typo = typologies.get(cid, {})
        fp = freeze_priorities.get(cid, {})
        ka = known_actor_results.get(cid, {})

        results.append({
            "cluster_id": cid, "score": c["score"], "risk_level": c["risk_level"],
            "size": c["size"], "total_volume": c["total_volume"],
            "flags": c["flags"], "top_wallets": c["top_wallets"],
            # New fields
            "typology": typo.get("name", "Unclassified"),
            "typology_code": typo.get("fincen_code"),
            "typology_confidence": typo.get("confidence", 0),
            "freeze_priority": fp.get("score", 0),
            "freeze_urgency": fp.get("urgency", "low"),
            "freeze_recommendation": fp.get("recommendation", ""),
            "known_actor_similarity": ka.get("similarity_score", 0),
            "known_actor_label": ka.get("threat_actor"),
        })

    return results


@router.get("/cluster/{cluster_id}")
def get_cluster(cluster_id: int):
    cluster_scores = _state["cluster_scores"]
    if cluster_id not in cluster_scores:
        return {"error": "Cluster not found"}

    cluster = cluster_scores[cluster_id]
    members = cluster["members"]
    txns = _state["transactions"]
    wallet_scores = _state["wallet_scores"]
    typologies = _state["typologies"] or {}
    freeze_priorities = _state["freeze_priorities"] or {}
    known_actor_results = _state["known_actor_results"] or {}

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

    typo = typologies.get(cluster_id, {})
    fp = freeze_priorities.get(cluster_id, {})
    ka = known_actor_results.get(cluster_id, {})

    return {
        "cluster_id": cluster_id, "score": cluster["score"],
        "risk_level": cluster["risk_level"], "size": cluster["size"],
        "density": cluster["density"], "total_volume": cluster["total_volume"],
        "flags": cluster["flags"], "wallets": wallet_details,
        "transactions": cluster_txns.to_dict(orient="records"),
        # Typology
        "typology": typo,
        # Freeze priority
        "freeze_priority": fp,
        # Known actor matching
        "known_actor": ka,
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

    # Check known actor direct match
    from engine.known_actors import check_address_match
    actor_match = check_address_match(address)

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
        "known_actor_match": actor_match,
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


@router.post("/sar/{cluster_id}")
async def generate_sar(cluster_id: int):
    """Generate a Suspicious Activity Report narrative using Claude API."""
    cluster_scores = _state["cluster_scores"]
    if cluster_id not in cluster_scores:
        return {"error": "Cluster not found"}

    cluster = cluster_scores[cluster_id]
    typologies = _state["typologies"] or {}
    freeze_priorities = _state["freeze_priorities"] or {}
    known_actor_results = _state["known_actor_results"] or {}
    wallet_scores = _state["wallet_scores"]
    txns = _state["transactions"]

    typo = typologies.get(cluster_id, {})
    fp = freeze_priorities.get(cluster_id, {})
    ka = known_actor_results.get(cluster_id, {})

    members = set(cluster.get("members", []))
    cluster_txns = txns[txns["from_address"].isin(members) & txns["to_address"].isin(members)]
    n_txns = len(cluster_txns)
    total_volume = float(cluster_txns["amount"].sum()) if not cluster_txns.empty else 0

    # Top wallets
    top_wallets = sorted(
        [(m, wallet_scores[m]["score"]) for m in members if m in wallet_scores],
        key=lambda x: x[1], reverse=True,
    )[:5]

    # Build context for the SAR
    context = f"""CLUSTER INVESTIGATION SUMMARY
Cluster ID: {cluster_id}
Risk Score: {cluster['score']}/100 ({cluster['risk_level'].upper()})
Wallets Involved: {cluster['size']}
Internal Transactions: {n_txns}
Total Volume: ${total_volume:,.2f}
Network Density: {cluster.get('density', 0):.1%}

TYPOLOGY CLASSIFICATION:
Type: {typo.get('name', 'Unclassified')}
FinCEN Code: {typo.get('fincen_code', 'N/A')}
Confidence: {typo.get('confidence', 0)}%
Description: {typo.get('description', 'N/A')}
Indicators: {'; '.join(typo.get('indicators', []))}

FREEZE PRIORITY:
Urgency: {fp.get('urgency', 'N/A').upper()} (Score: {fp.get('score', 0)}/100)
Recommendation: {fp.get('recommendation', 'N/A')}

KNOWN ACTOR ANALYSIS:
Behavioral Similarity: {ka.get('similarity_score', 0)}%
Assessment: {ka.get('risk_label', 'N/A')}
Threat Actor: {ka.get('threat_actor', 'None identified')}

FLAGGED INDICATORS:
{chr(10).join(f'- {flag}' for flag in cluster.get('flags', []))}

TOP SUSPICIOUS WALLETS:
{chr(10).join(f'- {addr[:10]}...{addr[-4:]} (score: {score})' for addr, score in top_wallets)}
"""

    api_key = os.environ.get("ANTHROPIC_API_KEY", "").strip()
    if not api_key or api_key == "" or not api_key.startswith("sk-"):
        return _generate_template_sar(cluster_id, cluster, typo, fp, ka, total_volume, n_txns, top_wallets)

    try:
        import anthropic
        client = anthropic.Anthropic(api_key=api_key)

        message = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=2000,
            messages=[{
                "role": "user",
                "content": f"""You are an expert financial crime investigator writing a Suspicious Activity Report (SAR) narrative for a blockchain-based money laundering case. Using the investigation data below, produce a structured SAR narrative suitable for filing with FinCEN.

{context}

Write the SAR narrative with these sections:
1. SUBJECT IDENTIFICATION — Who/what is being reported
2. SUSPICIOUS ACTIVITY DESCRIPTION — What was detected and why it's suspicious
3. FUND FLOW SUMMARY — How the money moved through the network
4. TYPOLOGY ASSESSMENT — The specific money laundering technique identified
5. THREAT ASSESSMENT — Any known threat actor connections
6. RECOMMENDED ACTIONS — Specific next steps for investigators

Write in plain English, legally precise, in the third person. Be specific about amounts, wallet counts, and patterns. This should be ready to file.""",
            }],
        )
        sar_text = message.content[0].text

        return {
            "cluster_id": cluster_id,
            "sar_narrative": sar_text,
            "generated_by": "ai",
            "model": "claude-sonnet-4-20250514",
        }

    except Exception as e:
        return _generate_template_sar(cluster_id, cluster, typo, fp, ka, total_volume, n_txns, top_wallets)


def _generate_template_sar(cluster_id, cluster, typo, fp, ka, total_volume, n_txns, top_wallets):
    """Generate a structured SAR using templates when API is unavailable."""
    typology_name = typo.get("name", "Unclassified Suspicious Activity")
    fincen_code = typo.get("fincen_code", "N/A")
    flags = cluster.get("flags", [])
    risk_level = cluster.get("risk_level", "unknown").upper()
    urgency = fp.get("urgency", "unknown").upper()
    actor_label = ka.get("risk_label", "No known threat actor match")
    similarity = ka.get("similarity_score", 0)

    wallet_lines = "\n".join(
        f"  - Wallet {addr[:10]}...{addr[-4:]} — Risk Score: {score}/100"
        for addr, score in top_wallets
    )

    sar = f"""SUSPICIOUS ACTIVITY REPORT — CLUSTER #{cluster_id}
{'=' * 60}

1. SUBJECT IDENTIFICATION
   This report concerns a network of {cluster['size']} blockchain wallets
   operating as a coordinated cluster (Cluster #{cluster_id}) identified
   by automated detection systems. The cluster has been assessed as
   {risk_level} risk with a composite score of {cluster['score']}/100.

2. SUSPICIOUS ACTIVITY DESCRIPTION
   Automated monitoring detected {n_txns} internal transactions totaling
   ${total_volume:,.2f} within this wallet cluster. The following suspicious
   indicators were flagged:
{chr(10).join(f'   - {flag.replace("_", " ").title()}' for flag in flags)}

   The transaction patterns are inconsistent with legitimate commercial
   activity and exhibit characteristics commonly associated with money
   laundering operations.

3. FUND FLOW SUMMARY
   Funds flowed through {cluster['size']} interconnected wallets with a
   network density of {cluster.get('density', 0):.1%}. The total volume
   of ${total_volume:,.2f} was processed through {n_txns} transactions.

   Key wallets of interest:
{wallet_lines}

4. TYPOLOGY ASSESSMENT
   Classification: {typology_name} (FinCEN Code: {fincen_code})
   Confidence: {typo.get('confidence', 0)}%

   {typo.get('description', 'No typology description available.')}

5. THREAT ASSESSMENT
   Known Actor Analysis: {actor_label}
   Behavioral Similarity Score: {similarity}%
   {"This cluster exhibits behavioral patterns consistent with known state-sponsored threat actors. Enhanced due diligence is recommended." if similarity >= 40 else "No significant match to known threat actor profiles was identified."}

6. RECOMMENDED ACTIONS
   Priority: {urgency}
   {fp.get('recommendation', 'Standard review recommended.')}

   Recommended next steps:
   - Freeze suspect wallets pending investigation
   - Issue subpoenas for exchange KYC records associated with entry/exit points
   - Cross-reference wallet addresses with other ongoing investigations
   - {"Escalate to national security division due to state-sponsored threat indicators" if similarity >= 40 else "Continue monitoring for additional suspicious activity"}
   - File this SAR with FinCEN within 30 days of detection

{'=' * 60}
Generated by ShadowTrace Detection Platform
Classification: {typology_name} | Priority: {urgency} | Risk: {risk_level}
"""

    return {
        "cluster_id": cluster_id,
        "sar_narrative": sar,
        "generated_by": "template",
    }
