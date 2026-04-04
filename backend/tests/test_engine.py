import pytest
from data.generator import generate_dataset
from engine.graph_builder import build_graph
from engine.community import detect_communities


@pytest.fixture
def small_dataset():
    return generate_dataset(n_wallets=100, n_legitimate_txns=300, n_laundering_rings=2, seed=99)


def test_build_graph_creates_nodes_and_edges(small_dataset):
    txns, labels = small_dataset
    G = build_graph(txns)
    assert G.number_of_nodes() > 0
    assert G.number_of_edges() > 0
    for node in list(G.nodes)[:5]:
        assert "total_sent" in G.nodes[node]
        assert "total_received" in G.nodes[node]
        assert "tx_count" in G.nodes[node]


def test_detect_communities_assigns_clusters(small_dataset):
    txns, labels = small_dataset
    G = build_graph(txns)
    communities = detect_communities(G)
    assert isinstance(communities, dict)
    assert len(communities) > 0
    for node in G.nodes:
        assert node in communities
    assert len(set(communities.values())) > 1
