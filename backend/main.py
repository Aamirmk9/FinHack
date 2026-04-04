"""FastAPI application — runs the full detection pipeline on startup."""

import time
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.routes import router, set_state
from data.generator import generate_dataset
from engine.graph_builder import build_graph
from engine.community import detect_communities
from engine.features import compute_node_features, compute_cluster_features
from engine.detector import HybridDetector
from engine.risk_scorer import score_clusters

app = FastAPI(title="ShadowTrace API", version="1.0.0")

app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"],
)

app.include_router(router)


@app.on_event("startup")
def run_pipeline():
    print("=" * 60)
    print("ShadowTrace — Running Detection Pipeline")
    print("=" * 60)

    t0 = time.time()

    print("[1/6] Generating synthetic blockchain data...")
    transactions, labels = generate_dataset(n_wallets=3000, n_legitimate_txns=50000, n_laundering_rings=12, seed=42)
    set_state("transactions", transactions)
    set_state("labels", labels)
    print(f"       {len(transactions)} transactions, {len(labels)} wallets")

    print("[2/6] Building transaction graph...")
    graph = build_graph(transactions)
    set_state("graph", graph)
    print(f"       {graph.number_of_nodes()} nodes, {graph.number_of_edges()} edges")

    print("[3/6] Detecting communities (Louvain)...")
    communities = detect_communities(graph)
    set_state("communities", communities)
    print(f"       {len(set(communities.values()))} communities detected")

    print("[4/6] Engineering features...")
    node_features = compute_node_features(graph, communities)
    cluster_features = compute_cluster_features(graph, communities, node_features)
    set_state("node_features", node_features)
    set_state("cluster_features", cluster_features)

    print("[5/6] Running hybrid detection (rules + Random Forest)...")
    detector = HybridDetector()
    wallet_scores = detector.run(graph, transactions, node_features, cluster_features, labels)
    set_state("wallet_scores", wallet_scores)
    set_state("ml_metrics", detector.ml_metrics)
    print(f"       ML metrics: {detector.ml_metrics}")

    print("[6/6] Scoring clusters...")
    cluster_scores = score_clusters(cluster_features, wallet_scores)
    set_state("cluster_scores", cluster_scores)

    critical = sum(1 for c in cluster_scores.values() if c["risk_level"] == "critical")
    high = sum(1 for c in cluster_scores.values() if c["risk_level"] == "high")
    print(f"       {critical} critical, {high} high-risk clusters")

    elapsed = round(time.time() - t0, 1)
    print(f"\nPipeline complete in {elapsed}s")
    print("=" * 60)
