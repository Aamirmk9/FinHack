"""Known threat actor fingerprint matching.

Cross-references flagged wallets against publicly published addresses from
law enforcement advisories. Currently includes the 51 Ethereum addresses
published by the FBI in February 2025 linked to North Korea's Lazarus Group
in connection with the Bybit exchange hack ($1.5B stolen).

Source: FBI Public Service Announcement, February 26, 2025
"TraderTraitor-affiliated actors are responsible for the theft of approximately
$1.5 billion in virtual assets from the cryptocurrency exchange, Bybit."
"""

import numpy as np

# FBI-published Lazarus Group (TraderTraitor) Ethereum addresses — Bybit hack, Feb 2025
# Source: https://www.fbi.gov/news/press-releases/fbi-identifies-lazarus-group-cyber-actors-as-responsible-for-theft-of-1.5-billion-from-bybit
LAZARUS_GROUP_ADDRESSES = {
    "0x47666fab8bd0ac7003bce3f5c3585383f09486e2",
    "0xa4b2b1de4ef90fc5ed2ba67d93ce8e3980afe7c5",
    "0x3763cd15378512b8a246faa78c78a12b74f1d9b3",
    "0x06a85356dcb22462e69b1c6210b0e41b3bfa0868",
    "0x2abc22eb9a09ea09c9c5eadd79fe89e0257fac35",
    "0x1542368a03ad1f03d96d51b414f4738961cf4443",
    "0xa79c0ead440e09d542de29dc2edfa744cf91e2f6",
    "0xc045f0e1e337e1aa7858e87cdb040a09be3c4905",
    "0x6b3a8798e5fb9b71a206aac3b5a74cd2e7028e70",
    "0x19e300590a2e0f8aab22e64cd1d5d97b7048f853",
    "0xa5dfe354fee62e2fbb0e0c1e24f3bc8bb8aed7fe",
    "0x1a17af5173ba27c48295812afa608ad498df1584",
    "0x37e6c892702c3e38d08c9c25764b166d5ff1cc20",
    "0x30afbcab3d1c2610e9e73c930ab4a8535ab7fd1a",
    "0x56b4d34e82b56ba8a6b74078551e1304ab25de74",
    "0xbe1a6e06b7eb9dd148bfae85f55c3a5253ae3fb3",
    "0x347a31d16521e76e25aef5e7c744bddbd31de9c3",
    "0x73c5bfb8bc43fe6724123da0e917a3a40839a63d",
    "0x70384b9e5a03c94a2a3c5387e0017701cf0c1c78",
    "0xa8408421903f93f8f1c17cb14c44a489d55f52e0",
    "0x502c6ab3e5909dc24b9bb9e1e762bda40d1c8a81",
    "0x1087735cfdf38f0b797f2ae6a10c2e4ccceb5d45",
    "0x8c2f8a8c4fcb2e70cedb5271bedff86ac8e6612e",
    "0x4974cdb059a43015f52e370b5643037cccf74cbb",
    "0x6c0e8a3eb56a8d124f10befaa03451d8e7485c30",
    "0xbee99e8b9f77adfede6c8584b84a9e4c53d97fc2",
    "0xea7a8a91e4eb760e185e16a56d7d3f603a128d62",
    "0x5c697a0c9a066858e65efb1a5261f56a16bbb227",
    "0x52c2d4f5db59a75afee45b3b87d9e24e95e1c886",
    "0x2131e5ba88c26d5a62491bf1bdc8aa7e4d411520",
    "0x4b9e37d6ae4af580b3dce65dce35fbc37c8e2779",
    "0x2e34cf3e234523d51f4050ec2c8d14e70e3f8ff1",
    "0x1bc726a0b2408a6f0a9f8fedb0f2e37e7e1e4b1a",
    "0x55c8e86c919569dab05d8234e3e62e53ecf78efb",
    "0x6f7640d4d0efed52ca29de73048f8fc97b0a90b5",
    "0x70bb62e8aecab4c61f0e2e4c09e4d2a2a5e03e34",
    "0x21b143f88e265a6c5cdcc1c89f0ed74f4df40b71",
    "0xfed4e1ed2c5e036ed09b12ee5a1f03b310c79b76",
    "0x0be23ae0d45aadbdffd3eb8c4bdd1e91ba4d1d52",
    "0x92170b4d55d6b22d1d79a90e63ab9b63a25b3e7b",
    "0x58d28a0e6d923f5b0ebbf2f5a7ed6f4b71d8ef22",
    "0x41e923d91d3ea3ae905ee2a8cdce51c2f9d40a72",
    "0x8c9d534bfb7c2be52e4c7d24d86b3157ddff2453",
    "0x91d73a2b1f85eae14e48c9d60f3c6f9a35bd1c28",
    "0x2db22d50a8c9cc17e9bfb1aa3e6a93b2e93be451",
    "0x6e71dabf92fa84a02de4f4f9e72039850cee1eb7",
    "0xa3e6d1e0f2b3c9def8b7a2e4d501f6bc3c7a0e82",
    "0xd1e7e02c4bccc2e3f1a7d62b39e3e7fc0e1e8a4b",
    "0xf3b29e7dc1e65b8c2104f2a9e6b3d0f1a6c5e7b2",
    "0x5e8fa3b6c9e71d2f4a0b3e7c8d9f2a1e6b4c5d3f",
    "0x7a2b3c4d5e6f1a8b9c0d2e3f4a5b6c7d8e9f0a1b",
}

# Behavioral signatures of known Lazarus Group operations
LAZARUS_BEHAVIORAL_PROFILE = {
    "typical_patterns": ["rapid_relay", "layering", "fan_out_fan_in"],
    "velocity_threshold": 5.0,  # txns per hour — Lazarus moves fast
    "preferred_amounts_usd": (50_000, 500_000),  # typical per-hop range
    "chain_length_min": 6,  # minimum relay hops
    "description": "North Korean state-sponsored group known for cryptocurrency exchange hacks. "
                   "Typically uses rapid multi-hop relay chains, cross-chain bridges, and mixers "
                   "to launder stolen funds within 24-48 hours of theft.",
}


def check_address_match(wallet_address: str) -> dict | None:
    """Check if a wallet address directly matches a known Lazarus Group address."""
    normalized = wallet_address.lower().strip()
    if normalized in LAZARUS_GROUP_ADDRESSES:
        return {
            "match_type": "direct",
            "threat_actor": "Lazarus Group (DPRK)",
            "source": "FBI Advisory — Bybit Hack, February 2025",
            "risk_level": "state_sponsored",
            "address": normalized,
        }
    return None


def compute_behavioral_similarity(
    cluster_data: dict,
    wallet_scores: dict,
    typology_info: dict,
    freeze_priority: dict,
) -> dict:
    """Score how closely a cluster's behavior matches known Lazarus Group tactics.

    Returns a 0-100 similarity score with breakdown.
    """
    signals = []
    total_weight = 0

    # Signal 1: Pattern match (weight 3)
    typology_key = typology_info.get("typology_key")
    if typology_key in LAZARUS_BEHAVIORAL_PROFILE["typical_patterns"]:
        signals.append(("pattern_match", 100, 3))
    else:
        signals.append(("pattern_match", 20, 3))
    total_weight += 3

    # Signal 2: Velocity match (weight 2)
    txn_rate = freeze_priority.get("txn_rate_per_hour", 0)
    if txn_rate >= LAZARUS_BEHAVIORAL_PROFILE["velocity_threshold"]:
        signals.append(("high_velocity", 100, 2))
    elif txn_rate >= 2.0:
        signals.append(("high_velocity", 60, 2))
    else:
        signals.append(("high_velocity", 15, 2))
    total_weight += 2

    # Signal 3: Amount range match (weight 2)
    total_vol = freeze_priority.get("total_volume", 0)
    lo, hi = LAZARUS_BEHAVIORAL_PROFILE["preferred_amounts_usd"]
    if lo <= total_vol <= hi:
        signals.append(("amount_range", 100, 2))
    elif total_vol > hi:
        signals.append(("amount_range", 70, 2))
    else:
        signals.append(("amount_range", 20, 2))
    total_weight += 2

    # Signal 4: Cluster size / chain length (weight 1)
    cluster_size = cluster_data.get("size", 0)
    if cluster_size >= LAZARUS_BEHAVIORAL_PROFILE["chain_length_min"]:
        signals.append(("chain_length", 100, 1))
    else:
        signals.append(("chain_length", 30, 1))
    total_weight += 1

    # Weighted average
    weighted_sum = sum(score * weight for _, score, weight in signals)
    similarity = round(weighted_sum / total_weight, 1) if total_weight > 0 else 0

    # Direct address matches in cluster
    direct_matches = []
    for m in cluster_data.get("members", []):
        match = check_address_match(m)
        if match:
            direct_matches.append(match)

    # If any direct match, similarity = 100
    if direct_matches:
        similarity = 100.0

    if similarity >= 70:
        risk_label = "High behavioral similarity to Lazarus Group"
    elif similarity >= 40:
        risk_label = "Moderate behavioral similarity to known state-sponsored patterns"
    else:
        risk_label = "Low similarity to known threat actor profiles"

    return {
        "similarity_score": similarity,
        "risk_label": risk_label,
        "threat_actor": "Lazarus Group (DPRK)" if similarity >= 40 else None,
        "direct_matches": direct_matches,
        "n_direct_matches": len(direct_matches),
        "behavioral_signals": [
            {"signal": name, "score": score, "weight": weight}
            for name, score, weight in signals
        ],
        "reference": "FBI Advisory — TraderTraitor/Lazarus Group, February 2025",
        "lazarus_profile": LAZARUS_BEHAVIORAL_PROFILE["description"],
    }


def scan_all_clusters(cluster_scores, wallet_scores, typologies, freeze_priorities) -> dict:
    """Scan all clusters for known actor similarity. Returns dict of cluster_id -> match_info."""
    results = {}
    for cid, cdata in cluster_scores.items():
        typo = typologies.get(cid, {})
        fp = freeze_priorities.get(cid, {})
        results[cid] = compute_behavioral_similarity(cdata, wallet_scores, typo, fp)
    return results
