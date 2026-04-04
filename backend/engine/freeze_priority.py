"""Freeze priority scoring — time-sensitivity metric for investigator triage.

Ranks flagged clusters by how urgently they need human attention based on:
- Fund velocity (how fast money is moving)
- Recency (how recently the activity occurred)
- Volume at risk (total funds in motion)
- Pattern severity (some typologies demand faster response)
"""

from datetime import datetime
from typing import Optional

import numpy as np
import pandas as pd


def compute_freeze_priority(
    cluster_id: int,
    cluster_data: dict,
    wallet_scores: dict,
    transactions: pd.DataFrame,
    typology_info: dict,
    reference_time: Optional[datetime] = None,
) -> dict:
    """Compute a 0-100 freeze priority score for a cluster.

    Higher = more urgent. Returns dict with score, urgency_level, factors breakdown.
    """
    members = set(cluster_data.get("members", []))
    if not members:
        return {"score": 0, "urgency": "low", "factors": {}}

    cluster_txns = transactions[
        transactions["from_address"].isin(members) | transactions["to_address"].isin(members)
    ]

    if cluster_txns.empty:
        return {"score": 0, "urgency": "low", "factors": {}}

    timestamps = pd.to_datetime(cluster_txns["timestamp"])
    if reference_time is None:
        reference_time = timestamps.max()

    # --- Factor 1: Fund Velocity (0-25) ---
    # How many transactions per hour within the cluster?
    time_range_hours = max((timestamps.max() - timestamps.min()).total_seconds() / 3600, 0.01)
    txn_rate = len(cluster_txns) / time_range_hours
    velocity_score = min(txn_rate / 2 * 25, 25)  # 2+ txns/hour = max

    # --- Factor 2: Recency (0-25) ---
    # How recently did the last transaction occur?
    hours_since_last = (reference_time - timestamps.max()).total_seconds() / 3600
    if hours_since_last < 1:
        recency_score = 25
    elif hours_since_last < 24:
        recency_score = 20
    elif hours_since_last < 168:  # 1 week
        recency_score = 12
    else:
        recency_score = 5

    # --- Factor 3: Volume at Risk (0-25) ---
    total_volume = float(cluster_txns["amount"].sum())
    if total_volume > 500_000:
        volume_score = 25
    elif total_volume > 100_000:
        volume_score = 20
    elif total_volume > 50_000:
        volume_score = 15
    elif total_volume > 10_000:
        volume_score = 10
    else:
        volume_score = 5

    # --- Factor 4: Pattern Severity (0-25) ---
    risk_weight = typology_info.get("risk_weight", 0.5)
    severity_score = risk_weight * 25

    # Composite
    composite = round(velocity_score + recency_score + volume_score + severity_score, 1)
    composite = min(composite, 100)

    if composite >= 75:
        urgency = "critical"
        recommendation = "Immediate review required. Funds are actively moving through a high-risk pattern."
    elif composite >= 50:
        urgency = "high"
        recommendation = "Review within 4 hours. Significant suspicious activity with recent movement."
    elif composite >= 30:
        urgency = "medium"
        recommendation = "Review within 24 hours. Suspicious pattern detected but activity has slowed."
    else:
        urgency = "low"
        recommendation = "Queue for routine review. Low-velocity or dated activity."

    return {
        "score": composite,
        "urgency": urgency,
        "recommendation": recommendation,
        "factors": {
            "velocity": {"score": round(velocity_score, 1), "max": 25, "detail": f"{txn_rate:.1f} txns/hour"},
            "recency": {"score": round(recency_score, 1), "max": 25, "detail": f"{hours_since_last:.0f} hours since last activity"},
            "volume": {"score": round(volume_score, 1), "max": 25, "detail": f"${total_volume:,.0f} total volume"},
            "severity": {"score": round(severity_score, 1), "max": 25, "detail": typology_info.get("name", "Unknown")},
        },
        "total_volume": round(total_volume, 2),
        "txn_rate_per_hour": round(txn_rate, 2),
        "hours_since_last": round(hours_since_last, 1),
    }


def compute_all_freeze_priorities(cluster_scores, wallet_scores, transactions, typologies) -> dict:
    """Compute freeze priority for all clusters. Returns dict of cluster_id -> priority_info."""
    results = {}
    for cid, cdata in cluster_scores.items():
        typo = typologies.get(cid, {})
        results[cid] = compute_freeze_priority(cid, cdata, wallet_scores, transactions, typo)
    return results
