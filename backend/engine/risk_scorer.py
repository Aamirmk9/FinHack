"""Composite risk scoring with explainability for wallets and clusters."""


def score_clusters(cluster_features, wallet_scores):
    cluster_scores = {}
    for cid, cfeats in cluster_features.items():
        members = cfeats.get("members", [])
        if not members:
            continue

        member_scores = [wallet_scores[m]["score"] for m in members if m in wallet_scores]
        if not member_scores:
            continue

        avg_score = sum(member_scores) / len(member_scores)
        max_score = max(member_scores)
        cluster_risk = avg_score * 0.4 + max_score * 0.3

        if cfeats["density"] > 0.3:
            cluster_risk += 10
        if cfeats["fan_out_ratio"] > 5:
            cluster_risk += 8
        if cfeats["temporal_compactness"] > 0.1:
            cluster_risk += 7

        cluster_risk = min(round(cluster_risk, 1), 100)

        all_flags = set()
        for m in members:
            if m in wallet_scores:
                all_flags.update(wallet_scores[m].get("flags", []))

        if cluster_risk >= 70:
            risk_level = "critical"
        elif cluster_risk >= 40:
            risk_level = "high"
        elif cluster_risk >= 20:
            risk_level = "medium"
        else:
            risk_level = "low"

        top_wallets = sorted(
            [(m, wallet_scores[m]["score"]) for m in members if m in wallet_scores],
            key=lambda x: x[1], reverse=True,
        )[:5]

        cluster_scores[cid] = {
            "cluster_id": cid, "score": cluster_risk, "risk_level": risk_level,
            "size": cfeats["size"], "density": cfeats["density"],
            "total_volume": cfeats["total_volume"], "flags": sorted(all_flags),
            "top_wallets": [{"address": addr, "score": s} for addr, s in top_wallets],
            "avg_wallet_score": round(avg_score, 1), "max_wallet_score": max_score,
            "members": members,
        }

    return cluster_scores
