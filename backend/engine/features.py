"""Feature engineering for nodes and clusters."""

from collections import defaultdict
import networkx as nx
import numpy as np


def compute_node_features(G: nx.DiGraph, communities: dict[str, int]) -> dict[str, dict]:
    features = {}
    for node, data in G.nodes(data=True):
        in_deg = G.in_degree(node)
        out_deg = G.out_degree(node)
        total_sent = data.get("total_sent", 0)
        total_received = data.get("total_received", 0)
        tx_count = data.get("tx_count", 0)
        active_hours = data.get("active_hours", 0)

        total_volume = total_sent + total_received
        avg_tx_size = total_volume / tx_count if tx_count > 0 else 0
        in_out_ratio = in_deg / out_deg if out_deg > 0 else float(in_deg)
        burst_score = tx_count / (active_hours + 1)

        features[node] = {
            "in_degree": in_deg,
            "out_degree": out_deg,
            "total_sent": total_sent,
            "total_received": total_received,
            "tx_count": tx_count,
            "avg_tx_size": round(avg_tx_size, 2),
            "in_out_ratio": round(in_out_ratio, 4),
            "activity_burst_score": round(burst_score, 4),
            "active_hours": active_hours,
            "community_id": communities.get(node, -1),
        }
    return features


def compute_cluster_features(
    G: nx.DiGraph, communities: dict[str, int], node_features: dict[str, dict],
) -> dict[int, dict]:
    clusters = defaultdict(list)
    for node, cid in communities.items():
        clusters[cid].append(node)

    cluster_features = {}
    for cid, members in clusters.items():
        if len(members) < 2:
            continue

        subgraph = G.subgraph(members)
        n_nodes = subgraph.number_of_nodes()
        n_edges = subgraph.number_of_edges()
        max_edges = n_nodes * (n_nodes - 1)
        density = n_edges / max_edges if max_edges > 0 else 0

        total_volume = sum(d.get("total_amount", 0) for _, _, d in subgraph.edges(data=True))
        avg_volume = total_volume / n_edges if n_edges > 0 else 0

        out_degrees = [subgraph.out_degree(n) for n in members]
        avg_out = np.mean(out_degrees) if out_degrees else 1
        max_out = max(out_degrees) if out_degrees else 0
        fan_out_ratio = max_out / avg_out if avg_out > 0 else 0

        active_hours_list = [node_features[n]["active_hours"] for n in members if n in node_features]
        temporal_compactness = 1.0 / (np.mean(active_hours_list) + 1) if active_hours_list else 0

        total_member_edges = sum(G.degree(n) for n in members)
        internal_ratio = (2 * n_edges) / total_member_edges if total_member_edges > 0 else 0

        burst_scores = [node_features[n]["activity_burst_score"] for n in members if n in node_features]
        avg_burst = np.mean(burst_scores) if burst_scores else 0

        cluster_features[cid] = {
            "size": n_nodes, "density": round(density, 4),
            "avg_tx_volume": round(avg_volume, 2), "fan_out_ratio": round(fan_out_ratio, 4),
            "temporal_compactness": round(temporal_compactness, 4),
            "internal_tx_ratio": round(internal_ratio, 4),
            "avg_burst_score": round(avg_burst, 4),
            "total_volume": round(total_volume, 2), "n_edges": n_edges, "members": members,
        }

    return cluster_features
