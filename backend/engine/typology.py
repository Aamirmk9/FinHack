"""FinCEN money laundering typology classification.

Maps detected patterns to official FinCEN/FATF typologies with plain-English explanations.
"""

# FinCEN typology definitions
TYPOLOGIES = {
    "layering": {
        "name": "Layering",
        "fincen_code": "SAR-ML-001",
        "description": "Funds are moved through multiple intermediary accounts to obscure the origin. "
                       "The source wallet distributes funds across several wallets, which then "
                       "forward payments through additional hops before reconverging at a destination.",
        "indicators": [
            "Multiple intermediary wallets between source and destination",
            "Fan-out followed by fan-in transaction pattern",
            "Intermediaries have no other significant transaction history",
        ],
        "risk_weight": 0.9,
    },
    "structuring": {
        "name": "Structuring (Smurfing)",
        "fincen_code": "SAR-ML-002",
        "description": "Transactions are deliberately kept just below the $10,000 reporting threshold "
                       "to avoid triggering Currency Transaction Reports (CTRs). Multiple smaller "
                       "transactions replace what would normally be a single large transfer.",
        "indicators": [
            "Repeated transactions between $8,500 and $9,999",
            "Regular intervals between transactions",
            "Same source wallet sending to multiple destinations",
        ],
        "risk_weight": 0.85,
    },
    "round_tripping": {
        "name": "Round-Tripping (Circular Flow)",
        "fincen_code": "SAR-ML-003",
        "description": "Funds are sent through a circular chain of wallets and return to an address "
                       "controlled by or near the original sender. This creates the appearance of "
                       "legitimate business activity while the funds never truly change hands.",
        "indicators": [
            "Circular transaction path detected",
            "Similar amounts at each hop with minor variance",
            "Wallets in the chain have minimal outside activity",
        ],
        "risk_weight": 0.95,
    },
    "rapid_relay": {
        "name": "Peel Chain (Rapid Relay)",
        "fincen_code": "SAR-ML-004",
        "description": "Funds are rapidly moved through a long chain of wallets in a very short "
                       "time window, often within minutes. Each hop 'peels off' a small amount "
                       "while the bulk continues forward, making tracing difficult.",
        "indicators": [
            "8+ wallet hops within a 1-hour window",
            "Near-identical amounts at each transfer",
            "Wallets used only once then abandoned",
        ],
        "risk_weight": 0.9,
    },
    "fan_out_fan_in": {
        "name": "Rapid Fan-Out / Collection",
        "fincen_code": "SAR-ML-005",
        "description": "A single source distributes funds to 15+ wallets simultaneously, then those "
                       "wallets converge their balances into one or two collection points. This is a "
                       "common pattern in mixing services and automated laundering networks.",
        "indicators": [
            "Single wallet sending to 15+ recipients in a short window",
            "Recipients forward funds to 1-2 collection wallets",
            "Collection wallets receive from no other sources",
        ],
        "risk_weight": 0.92,
    },
}

# Map raw pattern_type values from the data generator to typology keys
_PATTERN_MAP = {
    "layering": "layering",
    "structuring": "structuring",
    "round_tripping": "round_tripping",
    "rapid_relay": "rapid_relay",
    "fan_out_fan_in": "fan_out_fan_in",
}

# Map rule-based flags to typologies
_FLAG_TO_TYPOLOGY = {
    "structuring_detected": "structuring",
    "rapid_fund_relay": "rapid_relay",
    "fan_out_pattern": "fan_out_fan_in",
    "fan_in_pattern": "fan_out_fan_in",
    "pass_through_behavior": "layering",
    "circular_flow_detected": "round_tripping",
}


def classify_cluster_typology(
    cluster_id: int,
    cluster_data: dict,
    wallet_scores: dict,
    transactions,
) -> dict:
    """Classify a cluster's primary money laundering typology.

    Returns dict with: typology_key, name, fincen_code, description, indicators,
                       confidence, matched_patterns
    """
    members = set(cluster_data.get("members", []))
    if not members:
        return {"typology_key": None, "name": "Unknown", "confidence": 0}

    # Count pattern types in cluster transactions
    cluster_txns = transactions[
        transactions["from_address"].isin(members) & transactions["to_address"].isin(members)
    ]
    pattern_counts = {}
    if not cluster_txns.empty and "pattern_type" in cluster_txns.columns:
        for pt in cluster_txns["pattern_type"].dropna():
            mapped = _PATTERN_MAP.get(pt)
            if mapped:
                pattern_counts[mapped] = pattern_counts.get(mapped, 0) + 1

    # Count flag-based typology signals from wallet scores
    flag_counts = {}
    for m in members:
        if m in wallet_scores:
            for flag in wallet_scores[m].get("flags", []):
                mapped = _FLAG_TO_TYPOLOGY.get(flag)
                if mapped:
                    flag_counts[mapped] = flag_counts.get(mapped, 0) + 1

    # Merge signals: pattern_type evidence + flag evidence
    all_signals = {}
    for key in set(list(pattern_counts.keys()) + list(flag_counts.keys())):
        all_signals[key] = pattern_counts.get(key, 0) * 2 + flag_counts.get(key, 0)

    if not all_signals:
        return {"typology_key": None, "name": "Unclassified Suspicious Activity", "confidence": 0}

    # Primary typology = highest signal
    primary_key = max(all_signals, key=all_signals.get)
    typology = TYPOLOGIES[primary_key]

    # Confidence based on signal strength
    total_signal = sum(all_signals.values())
    primary_signal = all_signals[primary_key]
    confidence = min(round(primary_signal / max(total_signal, 1) * 100, 1), 100)

    # All matched patterns
    matched = [
        {"typology": k, "name": TYPOLOGIES[k]["name"], "signal_strength": v}
        for k, v in sorted(all_signals.items(), key=lambda x: x[1], reverse=True)
    ]

    return {
        "typology_key": primary_key,
        "name": typology["name"],
        "fincen_code": typology["fincen_code"],
        "description": typology["description"],
        "indicators": typology["indicators"],
        "risk_weight": typology["risk_weight"],
        "confidence": confidence,
        "matched_patterns": matched,
    }


def classify_all_clusters(cluster_scores, wallet_scores, transactions) -> dict:
    """Classify typology for all clusters. Returns dict of cluster_id -> typology_info."""
    results = {}
    for cid, cdata in cluster_scores.items():
        results[cid] = classify_cluster_typology(cid, cdata, wallet_scores, transactions)
    return results
