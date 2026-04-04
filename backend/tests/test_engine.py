import pytest
from data.generator import generate_dataset
from engine.graph_builder import build_graph
from engine.community import detect_communities
from engine.features import compute_node_features, compute_cluster_features
from engine.detector import RuleBasedDetector, MLDetector, HybridDetector


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


def test_compute_node_features(small_dataset):
    txns, labels = small_dataset
    G = build_graph(txns)
    communities = detect_communities(G)
    node_features = compute_node_features(G, communities)
    assert len(node_features) == G.number_of_nodes()
    sample = list(node_features.values())[0]
    expected_keys = {
        "in_degree", "out_degree", "total_sent", "total_received",
        "tx_count", "avg_tx_size", "in_out_ratio", "activity_burst_score",
        "community_id",
    }
    assert expected_keys.issubset(set(sample.keys()))


def test_compute_cluster_features(small_dataset):
    txns, labels = small_dataset
    G = build_graph(txns)
    communities = detect_communities(G)
    node_features = compute_node_features(G, communities)
    cluster_features = compute_cluster_features(G, communities, node_features)
    assert len(cluster_features) > 0
    sample = list(cluster_features.values())[0]
    expected_keys = {"size", "density", "avg_tx_volume", "fan_out_ratio", "temporal_compactness"}
    assert expected_keys.issubset(set(sample.keys()))


def test_rule_based_detector_flags_suspicious(small_dataset):
    txns, labels = small_dataset
    G = build_graph(txns)
    communities = detect_communities(G)
    node_feats = compute_node_features(G, communities)
    rule_detector = RuleBasedDetector()
    flags = rule_detector.detect(G, txns, node_feats)
    assert isinstance(flags, dict)
    flagged = {k for k, v in flags.items() if len(v) > 0}
    assert len(flagged) > 0


def test_hybrid_detector_produces_scores(small_dataset):
    txns, labels = small_dataset
    G = build_graph(txns)
    communities = detect_communities(G)
    node_feats = compute_node_features(G, communities)
    cluster_feats = compute_cluster_features(G, communities, node_feats)
    detector = HybridDetector()
    scores = detector.run(G, txns, node_feats, cluster_feats, labels)
    assert isinstance(scores, dict)
    for addr, score_data in scores.items():
        assert 0 <= score_data["score"] <= 100
        assert "flags" in score_data
        assert "ml_probability" in score_data
