"""Community detection using Louvain algorithm."""

import community as community_louvain
import networkx as nx


def detect_communities(G: nx.DiGraph) -> dict[str, int]:
    undirected = G.to_undirected()
    partition = community_louvain.best_partition(undirected, random_state=42)
    return partition
