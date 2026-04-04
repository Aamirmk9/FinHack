"""FastAPI application — runs the full detection pipeline on startup."""

import time
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from api.routes import router, set_state
from api.inject import inject_router
from api.websocket import manager
from data.generator import generate_dataset
from engine.graph_builder import build_graph
from engine.community import detect_communities
from engine.features import compute_node_features, compute_cluster_features
from engine.detector import HybridDetector
from engine.risk_scorer import score_clusters
from engine.typology import classify_all_clusters
from engine.freeze_priority import compute_all_freeze_priorities
from engine.known_actors import scan_all_clusters

app = FastAPI(title="ShadowTrace API", version="3.0.0")

app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"],
)

app.include_router(router)
app.include_router(inject_router)


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            # Keep connection alive, listen for pings
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)


@app.on_event("startup")
def run_pipeline():
    print("=" * 60)
    print("ShadowTrace — Running Detection Pipeline")
    print("=" * 60)

    t0 = time.time()

    print("[1/9] Generating synthetic blockchain data...")
    transactions, labels = generate_dataset(n_wallets=3000, n_legitimate_txns=50000, n_laundering_rings=12, seed=42)
    set_state("transactions", transactions)
    set_state("labels", labels)
    print(f"       {len(transactions)} transactions, {len(labels)} wallets")

    print("[2/9] Building transaction graph...")
    graph = build_graph(transactions)
    set_state("graph", graph)
    print(f"       {graph.number_of_nodes()} nodes, {graph.number_of_edges()} edges")

    print("[3/9] Detecting communities (Louvain)...")
    communities = detect_communities(graph)
    set_state("communities", communities)
    print(f"       {len(set(communities.values()))} communities detected")

    print("[4/9] Engineering features...")
    node_features = compute_node_features(graph, communities)
    cluster_features = compute_cluster_features(graph, communities, node_features)
    set_state("node_features", node_features)
    set_state("cluster_features", cluster_features)

    print("[5/9] Running hybrid detection (rules + Random Forest)...")
    detector = HybridDetector()
    wallet_scores = detector.run(graph, transactions, node_features, cluster_features, labels)
    set_state("wallet_scores", wallet_scores)
    set_state("ml_metrics", detector.ml_metrics)
    set_state("_detector", detector)  # Store for live re-scoring
    print(f"       ML metrics: {detector.ml_metrics}")

    print("[6/9] Scoring clusters...")
    cluster_scores = score_clusters(cluster_features, wallet_scores)
    set_state("cluster_scores", cluster_scores)

    critical = sum(1 for c in cluster_scores.values() if c["risk_level"] == "critical")
    high = sum(1 for c in cluster_scores.values() if c["risk_level"] == "high")
    print(f"       {critical} critical, {high} high-risk clusters")

    print("[7/9] Classifying FinCEN typologies...")
    typologies = classify_all_clusters(cluster_scores, wallet_scores, transactions)
    set_state("typologies", typologies)
    for cid, typo in typologies.items():
        if typo.get("typology_key"):
            print(f"       Cluster {cid}: {typo['name']} ({typo['confidence']}% confidence)")

    print("[8/9] Computing freeze priorities...")
    freeze_priorities = compute_all_freeze_priorities(cluster_scores, wallet_scores, transactions, typologies)
    set_state("freeze_priorities", freeze_priorities)
    urgent = sorted(freeze_priorities.items(), key=lambda x: x[1]["score"], reverse=True)
    for cid, fp in urgent[:3]:
        print(f"       Cluster {cid}: {fp['urgency'].upper()} priority (score {fp['score']})")

    print("[9/9] Scanning for known threat actor fingerprints...")
    known_actor_results = scan_all_clusters(cluster_scores, wallet_scores, typologies, freeze_priorities)
    set_state("known_actor_results", known_actor_results)
    for cid, ka in known_actor_results.items():
        if ka["similarity_score"] >= 40:
            print(f"       Cluster {cid}: {ka['risk_label']} (similarity {ka['similarity_score']}%)")

    elapsed = round(time.time() - t0, 1)
    print(f"\nPipeline complete in {elapsed}s")
    print(f"Live injection ready at POST /api/inject")
    print(f"WebSocket updates at ws://0.0.0.0:8000/ws")
    print("=" * 60)
