# ShadowTrace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a full-stack AI-powered money laundering network detection prototype for FinHack 2026 Case 1 — synthetic blockchain data, graph-based detection engine, and interactive React dashboard.

**Architecture:** Python FastAPI backend generates synthetic blockchain transactions with embedded laundering patterns, builds a NetworkX graph, runs Louvain community detection + feature engineering + hybrid (rule-based + Random Forest) detection, and exposes results via REST API. React frontend with react-force-graph renders an interactive network explorer, dashboard, investigation panel, and timeline view. Dark-themed professional UI with Tailwind CSS.

**Tech Stack:** Python 3.14, FastAPI, NetworkX, python-louvain, scikit-learn, pandas, numpy | React 18, Vite, Tailwind CSS, react-force-graph-2d, Recharts, Axios

---

## File Structure

```
backend/
├── requirements.txt
├── main.py                    # FastAPI app, CORS, startup hook to run pipeline
├── data/
│   ├── __init__.py
│   └── generator.py           # Synthetic blockchain transaction generator
├── engine/
│   ├── __init__.py
│   ├── graph_builder.py       # NetworkX directed graph from transactions
│   ├── community.py           # Louvain community detection
│   ├── features.py            # Node, edge, cluster feature engineering
│   ├── detector.py            # Rule-based flags + Random Forest classifier
│   └── risk_scorer.py         # Composite 0-100 risk score + explainability tags
├── api/
│   ├── __init__.py
│   └── routes.py              # All REST endpoints
└── tests/
    ├── __init__.py
    ├── test_generator.py
    ├── test_engine.py
    └── test_api.py

frontend/
├── package.json
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
├── index.html
└── src/
    ├── main.jsx               # React entry point
    ├── index.css              # Tailwind base + dark theme tokens
    ├── App.jsx                # Router + layout shell
    ├── api/
    │   └── client.js          # Axios instance + API functions
    ├── components/
    │   ├── Layout.jsx         # Sidebar nav + page container
    │   ├── Dashboard.jsx      # Overview: stats cards, risk chart, alert feed, model metrics
    │   ├── NetworkGraph.jsx   # Interactive force-directed graph with side panel
    │   ├── InvestigationPanel.jsx  # Cluster deep-dive: flow diagram, explainability, txn table
    │   ├── Timeline.jsx       # Temporal fund flow with scrubber
    │   └── StatsCard.jsx      # Reusable stat card component
    └── utils/
        └── formatters.js      # Address truncation, currency formatting, date formatting
```

---

### Task 1: Backend Scaffolding + Synthetic Data Generator

**Files:**
- Create: `backend/requirements.txt`
- Create: `backend/data/__init__.py`
- Create: `backend/data/generator.py`
- Create: `backend/engine/__init__.py`
- Create: `backend/api/__init__.py`
- Create: `backend/tests/__init__.py`
- Create: `backend/tests/test_generator.py`

- [ ] **Step 1: Create requirements.txt**

```
fastapi==0.115.12
uvicorn==0.34.2
networkx==3.4.2
python-louvain==0.16
scikit-learn==1.6.1
pandas==2.2.3
numpy==2.2.4
```

- [ ] **Step 2: Install dependencies**

Run: `cd backend && python3 -m venv venv && source venv/bin/activate && pip install -r requirements.txt`
Expected: All packages install successfully.

- [ ] **Step 3: Create empty __init__.py files**

Create empty files at:
- `backend/data/__init__.py`
- `backend/engine/__init__.py`
- `backend/api/__init__.py`
- `backend/tests/__init__.py`

- [ ] **Step 4: Write the data generator test**

`backend/tests/test_generator.py`:
```python
import pytest
from data.generator import generate_dataset


def test_generate_dataset_returns_transactions_and_labels():
    transactions, labels = generate_dataset(
        n_wallets=200, n_legitimate_txns=500, n_laundering_rings=3, seed=42
    )
    assert len(transactions) > 500  # legitimate + laundering txns
    assert "tx_hash" in transactions.columns
    assert "from_address" in transactions.columns
    assert "to_address" in transactions.columns
    assert "amount" in transactions.columns
    assert "timestamp" in transactions.columns
    assert isinstance(labels, dict)  # wallet_address -> "legitimate" | "suspicious"
    suspicious_count = sum(1 for v in labels.values() if v == "suspicious")
    assert suspicious_count > 0
    assert suspicious_count < len(labels)  # not all suspicious


def test_laundering_patterns_are_embedded():
    transactions, labels = generate_dataset(
        n_wallets=200, n_legitimate_txns=500, n_laundering_rings=3, seed=42
    )
    suspicious_wallets = {k for k, v in labels.items() if v == "suspicious"}
    # Suspicious wallets should appear in transactions
    txn_wallets = set(transactions["from_address"]) | set(transactions["to_address"])
    assert suspicious_wallets.issubset(txn_wallets)
    # Check pattern_type column exists for ground truth
    assert "pattern_type" in transactions.columns
    patterns = set(transactions["pattern_type"].dropna().unique())
    assert len(patterns) >= 2  # at least 2 different laundering patterns
```

- [ ] **Step 5: Run test to verify it fails**

Run: `cd backend && source venv/bin/activate && python -m pytest tests/test_generator.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'data.generator'`

- [ ] **Step 6: Implement the data generator**

`backend/data/generator.py`:
```python
"""Synthetic blockchain transaction generator with embedded laundering patterns."""

import hashlib
import random
from datetime import datetime, timedelta

import numpy as np
import pandas as pd


def _make_address(prefix: str, index: int) -> str:
    raw = f"{prefix}_{index}"
    return "0x" + hashlib.sha256(raw.encode()).hexdigest()[:40]


def _make_tx_hash() -> str:
    return "0x" + hashlib.sha256(random.randbytes(32)).hexdigest()


def _random_timestamp(start: datetime, end: datetime) -> datetime:
    delta = end - start
    random_seconds = random.randint(0, int(delta.total_seconds()))
    return start + timedelta(seconds=random_seconds)


def _generate_legitimate_transactions(
    wallets: list[str], n_txns: int, start: datetime, end: datetime
) -> list[dict]:
    """Generate normal-looking random transactions."""
    txns = []
    for _ in range(n_txns):
        sender, receiver = random.sample(wallets, 2)
        amount = round(random.lognormvariate(6, 2), 2)  # log-normal: most small, some large
        amount = min(amount, 500_000)  # cap at 500K
        txns.append(
            {
                "tx_hash": _make_tx_hash(),
                "from_address": sender,
                "to_address": receiver,
                "amount": amount,
                "timestamp": _random_timestamp(start, end),
                "pattern_type": None,
            }
        )
    return txns


def _generate_layering(
    ring_id: int, start: datetime
) -> tuple[list[dict], list[str]]:
    """Layering: source -> many intermediaries -> destination (split & merge)."""
    source = _make_address(f"layer_src_{ring_id}", 0)
    dest = _make_address(f"layer_dst_{ring_id}", 0)
    intermediaries = [_make_address(f"layer_mid_{ring_id}", i) for i in range(random.randint(6, 12))]
    total_amount = random.uniform(50_000, 200_000)
    txns = []
    t = start + timedelta(hours=random.randint(0, 48))

    # Fan-out from source
    splits = np.random.dirichlet(np.ones(len(intermediaries))) * total_amount
    for mid, amt in zip(intermediaries, splits):
        t += timedelta(minutes=random.randint(1, 15))
        txns.append(
            {
                "tx_hash": _make_tx_hash(),
                "from_address": source,
                "to_address": mid,
                "amount": round(float(amt), 2),
                "timestamp": t,
                "pattern_type": "layering",
            }
        )

    # Inter-intermediary hops (some move funds between each other)
    for _ in range(len(intermediaries) // 2):
        a, b = random.sample(intermediaries, 2)
        t += timedelta(minutes=random.randint(5, 30))
        txns.append(
            {
                "tx_hash": _make_tx_hash(),
                "from_address": a,
                "to_address": b,
                "amount": round(random.uniform(1000, 20000), 2),
                "timestamp": t,
                "pattern_type": "layering",
            }
        )

    # Fan-in to destination
    for mid in intermediaries:
        t += timedelta(minutes=random.randint(1, 20))
        txns.append(
            {
                "tx_hash": _make_tx_hash(),
                "from_address": mid,
                "to_address": dest,
                "amount": round(random.uniform(2000, 30000), 2),
                "timestamp": t,
                "pattern_type": "layering",
            }
        )

    all_wallets = [source, dest] + intermediaries
    return txns, all_wallets


def _generate_structuring(
    ring_id: int, start: datetime
) -> tuple[list[dict], list[str]]:
    """Structuring: many transactions just below $10K reporting threshold."""
    source = _make_address(f"struct_src_{ring_id}", 0)
    destinations = [_make_address(f"struct_dst_{ring_id}", i) for i in range(random.randint(5, 10))]
    txns = []
    t = start + timedelta(hours=random.randint(0, 72))

    for _ in range(random.randint(15, 30)):
        dest = random.choice(destinations)
        amount = round(random.uniform(8500, 9999), 2)  # just below 10K
        t += timedelta(hours=random.randint(4, 24))
        txns.append(
            {
                "tx_hash": _make_tx_hash(),
                "from_address": source,
                "to_address": dest,
                "amount": amount,
                "timestamp": t,
                "pattern_type": "structuring",
            }
        )

    all_wallets = [source] + destinations
    return txns, all_wallets


def _generate_round_tripping(
    ring_id: int, start: datetime
) -> tuple[list[dict], list[str]]:
    """Round-tripping: funds circle back to near-origin through a chain."""
    chain_len = random.randint(5, 10)
    wallets = [_make_address(f"round_{ring_id}", i) for i in range(chain_len)]
    txns = []
    t = start + timedelta(hours=random.randint(0, 48))
    amount = random.uniform(20_000, 100_000)

    for i in range(chain_len):
        sender = wallets[i]
        receiver = wallets[(i + 1) % chain_len]
        t += timedelta(minutes=random.randint(10, 60))
        # Slight amount variation to avoid exact match detection
        txn_amount = round(amount * random.uniform(0.95, 1.0), 2)
        txns.append(
            {
                "tx_hash": _make_tx_hash(),
                "from_address": sender,
                "to_address": receiver,
                "amount": txn_amount,
                "timestamp": t,
                "pattern_type": "round_tripping",
            }
        )

    return txns, wallets


def _generate_rapid_relay(
    ring_id: int, start: datetime
) -> tuple[list[dict], list[str]]:
    """Rapid relay: funds moving through 8+ wallets in under 1 hour."""
    chain_len = random.randint(8, 15)
    wallets = [_make_address(f"rapid_{ring_id}", i) for i in range(chain_len)]
    txns = []
    t = start + timedelta(hours=random.randint(0, 96))
    amount = random.uniform(10_000, 80_000)

    for i in range(chain_len - 1):
        t += timedelta(seconds=random.randint(15, 180))  # very fast
        txns.append(
            {
                "tx_hash": _make_tx_hash(),
                "from_address": wallets[i],
                "to_address": wallets[i + 1],
                "amount": round(amount * random.uniform(0.98, 1.0), 2),
                "timestamp": t,
                "pattern_type": "rapid_relay",
            }
        )

    return txns, wallets


def _generate_fan_out_fan_in(
    ring_id: int, start: datetime
) -> tuple[list[dict], list[str]]:
    """Fan-out/Fan-in: one wallet sends to 20+ wallets, then they converge to 1-2."""
    source = _make_address(f"fan_src_{ring_id}", 0)
    collectors = [_make_address(f"fan_collect_{ring_id}", i) for i in range(2)]
    middles = [_make_address(f"fan_mid_{ring_id}", i) for i in range(random.randint(15, 25))]
    txns = []
    t = start + timedelta(hours=random.randint(0, 48))
    total = random.uniform(100_000, 500_000)
    splits = np.random.dirichlet(np.ones(len(middles))) * total

    # Fan-out
    for mid, amt in zip(middles, splits):
        t += timedelta(minutes=random.randint(1, 10))
        txns.append(
            {
                "tx_hash": _make_tx_hash(),
                "from_address": source,
                "to_address": mid,
                "amount": round(float(amt), 2),
                "timestamp": t,
                "pattern_type": "fan_out_fan_in",
            }
        )

    # Fan-in
    t += timedelta(hours=random.randint(2, 12))
    for mid in middles:
        collector = random.choice(collectors)
        t += timedelta(minutes=random.randint(1, 10))
        txns.append(
            {
                "tx_hash": _make_tx_hash(),
                "from_address": mid,
                "to_address": collector,
                "amount": round(random.uniform(2000, 30000), 2),
                "timestamp": t,
                "pattern_type": "fan_out_fan_in",
            }
        )

    all_wallets = [source] + collectors + middles
    return txns, all_wallets


# Map of pattern generators — each returns (txns, wallets)
_PATTERN_GENERATORS = [
    _generate_layering,
    _generate_structuring,
    _generate_round_tripping,
    _generate_rapid_relay,
    _generate_fan_out_fan_in,
]


def generate_dataset(
    n_wallets: int = 3000,
    n_legitimate_txns: int = 50000,
    n_laundering_rings: int = 12,
    seed: int = 42,
) -> tuple[pd.DataFrame, dict[str, str]]:
    """Generate a synthetic blockchain dataset with embedded laundering patterns.

    Returns:
        transactions: DataFrame with columns [tx_hash, from_address, to_address, amount, timestamp, pattern_type]
        labels: dict mapping wallet_address -> "legitimate" | "suspicious"
    """
    random.seed(seed)
    np.random.seed(seed)

    start_date = datetime(2025, 1, 1)
    end_date = datetime(2025, 12, 31)

    # Create legitimate wallets
    legit_wallets = [_make_address("legit", i) for i in range(n_wallets)]
    labels = {w: "legitimate" for w in legit_wallets}

    # Generate legitimate transactions
    all_txns = _generate_legitimate_transactions(legit_wallets, n_legitimate_txns, start_date, end_date)

    # Generate laundering patterns
    for ring_id in range(n_laundering_rings):
        gen_fn = _PATTERN_GENERATORS[ring_id % len(_PATTERN_GENERATORS)]
        txns, suspicious_wallets = gen_fn(ring_id, start_date)
        all_txns.extend(txns)
        for w in suspicious_wallets:
            labels[w] = "suspicious"

    # Also sprinkle some legitimate transactions involving suspicious wallets
    # to make detection harder (realistic noise)
    suspicious_list = [w for w, l in labels.items() if l == "suspicious"]
    for _ in range(len(suspicious_list) * 2):
        s = random.choice(suspicious_list)
        l = random.choice(legit_wallets)
        if random.random() < 0.5:
            sender, receiver = s, l
        else:
            sender, receiver = l, s
        all_txns.append(
            {
                "tx_hash": _make_tx_hash(),
                "from_address": sender,
                "to_address": receiver,
                "amount": round(random.lognormvariate(5, 2), 2),
                "timestamp": _random_timestamp(start_date, end_date),
                "pattern_type": None,
            }
        )

    df = pd.DataFrame(all_txns)
    df = df.sort_values("timestamp").reset_index(drop=True)
    return df, labels
```

- [ ] **Step 7: Run test to verify it passes**

Run: `cd backend && source venv/bin/activate && python -m pytest tests/test_generator.py -v`
Expected: 2 tests PASS

- [ ] **Step 8: Commit**

```bash
git add backend/
git commit -m "feat: add synthetic blockchain data generator with 5 laundering patterns"
```

---

### Task 2: Graph Builder + Community Detection

**Files:**
- Create: `backend/engine/graph_builder.py`
- Create: `backend/engine/community.py`
- Create: `backend/tests/test_engine.py`

- [ ] **Step 1: Write the graph builder + community detection tests**

`backend/tests/test_engine.py`:
```python
import pytest
import pandas as pd
from datetime import datetime

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
    # Every node should have attributes
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
    # Every node should have a community assignment
    for node in G.nodes:
        assert node in communities
    # There should be multiple communities
    assert len(set(communities.values())) > 1
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && source venv/bin/activate && python -m pytest tests/test_engine.py -v`
Expected: FAIL — `ModuleNotFoundError`

- [ ] **Step 3: Implement graph_builder.py**

`backend/engine/graph_builder.py`:
```python
"""Build a NetworkX directed multigraph from transaction data."""

from collections import defaultdict

import networkx as nx
import pandas as pd


def build_graph(transactions: pd.DataFrame) -> nx.DiGraph:
    """Build a directed graph where nodes=wallets, edges=aggregated transaction flows.

    Node attributes: total_sent, total_received, tx_count, first_active, last_active
    Edge attributes: total_amount, tx_count, avg_amount, min_amount, max_amount,
                     first_tx, last_tx, time_span_hours
    """
    G = nx.DiGraph()

    # Aggregate transactions per (sender, receiver) pair
    edge_data: dict[tuple[str, str], list[dict]] = defaultdict(list)
    node_sent: dict[str, float] = defaultdict(float)
    node_received: dict[str, float] = defaultdict(float)
    node_tx_count: dict[str, int] = defaultdict(int)
    node_first: dict[str, pd.Timestamp] = {}
    node_last: dict[str, pd.Timestamp] = {}

    for _, row in transactions.iterrows():
        sender = row["from_address"]
        receiver = row["to_address"]
        amount = row["amount"]
        ts = row["timestamp"]

        edge_data[(sender, receiver)].append({"amount": amount, "timestamp": ts})

        node_sent[sender] += amount
        node_received[receiver] += amount
        node_tx_count[sender] += 1
        node_tx_count[receiver] += 1

        for addr in (sender, receiver):
            if addr not in node_first or ts < node_first[addr]:
                node_first[addr] = ts
            if addr not in node_last or ts > node_last[addr]:
                node_last[addr] = ts

    # Add nodes
    all_addresses = set(node_sent.keys()) | set(node_received.keys())
    for addr in all_addresses:
        first = node_first.get(addr)
        last = node_last.get(addr)
        active_hours = 0.0
        if first and last:
            active_hours = (last - first).total_seconds() / 3600

        G.add_node(
            addr,
            total_sent=round(node_sent.get(addr, 0), 2),
            total_received=round(node_received.get(addr, 0), 2),
            tx_count=node_tx_count.get(addr, 0),
            first_active=str(first) if first else None,
            last_active=str(last) if last else None,
            active_hours=round(active_hours, 2),
        )

    # Add edges
    for (sender, receiver), txn_list in edge_data.items():
        amounts = [t["amount"] for t in txn_list]
        timestamps = [t["timestamp"] for t in txn_list]
        first_tx = min(timestamps)
        last_tx = max(timestamps)
        time_span = (last_tx - first_tx).total_seconds() / 3600

        G.add_edge(
            sender,
            receiver,
            total_amount=round(sum(amounts), 2),
            tx_count=len(amounts),
            avg_amount=round(sum(amounts) / len(amounts), 2),
            min_amount=round(min(amounts), 2),
            max_amount=round(max(amounts), 2),
            first_tx=str(first_tx),
            last_tx=str(last_tx),
            time_span_hours=round(time_span, 2),
        )

    return G
```

- [ ] **Step 4: Implement community.py**

`backend/engine/community.py`:
```python
"""Community detection using Louvain algorithm."""

import community as community_louvain
import networkx as nx


def detect_communities(G: nx.DiGraph) -> dict[str, int]:
    """Run Louvain community detection on the graph.

    Converts to undirected for Louvain, then maps community IDs back.

    Returns: dict mapping node_address -> community_id
    """
    undirected = G.to_undirected()
    partition = community_louvain.best_partition(undirected, random_state=42)
    return partition
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd backend && source venv/bin/activate && python -m pytest tests/test_engine.py -v`
Expected: 2 tests PASS

- [ ] **Step 6: Commit**

```bash
git add backend/engine/graph_builder.py backend/engine/community.py backend/tests/test_engine.py
git commit -m "feat: add graph builder and Louvain community detection"
```

---

### Task 3: Feature Engineering

**Files:**
- Create: `backend/engine/features.py`
- Modify: `backend/tests/test_engine.py` — append tests

- [ ] **Step 1: Append feature engineering tests**

Add to `backend/tests/test_engine.py`:
```python
from engine.features import compute_node_features, compute_cluster_features


def test_compute_node_features(small_dataset):
    txns, labels = small_dataset
    G = build_graph(txns)
    communities = detect_communities(G)
    node_features = compute_node_features(G, communities)
    assert len(node_features) == G.number_of_nodes()
    # Check expected feature keys
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && source venv/bin/activate && python -m pytest tests/test_engine.py::test_compute_node_features -v`
Expected: FAIL — `ImportError`

- [ ] **Step 3: Implement features.py**

`backend/engine/features.py`:
```python
"""Feature engineering for nodes and clusters."""

from collections import defaultdict

import networkx as nx
import numpy as np


def compute_node_features(
    G: nx.DiGraph, communities: dict[str, int]
) -> dict[str, dict]:
    """Compute per-node features for classification.

    Features: in_degree, out_degree, total_sent, total_received, tx_count,
              avg_tx_size, in_out_ratio, activity_burst_score, community_id
    """
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

        # Activity burst: high tx count in short active window
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
    G: nx.DiGraph,
    communities: dict[str, int],
    node_features: dict[str, dict],
) -> dict[int, dict]:
    """Compute per-cluster aggregate features.

    Features: size, density, avg_tx_volume, fan_out_ratio, temporal_compactness,
              internal_tx_ratio, avg_burst_score
    """
    # Group nodes by community
    clusters: dict[int, list[str]] = defaultdict(list)
    for node, cid in communities.items():
        clusters[cid].append(node)

    cluster_features = {}
    for cid, members in clusters.items():
        if len(members) < 2:
            continue

        subgraph = G.subgraph(members)
        n_nodes = subgraph.number_of_nodes()
        n_edges = subgraph.number_of_edges()
        max_edges = n_nodes * (n_nodes - 1)  # directed
        density = n_edges / max_edges if max_edges > 0 else 0

        # Total volume within cluster
        total_volume = sum(
            d.get("total_amount", 0) for _, _, d in subgraph.edges(data=True)
        )
        avg_volume = total_volume / n_edges if n_edges > 0 else 0

        # Fan-out ratio: max out-degree / avg out-degree
        out_degrees = [subgraph.out_degree(n) for n in members]
        avg_out = np.mean(out_degrees) if out_degrees else 1
        max_out = max(out_degrees) if out_degrees else 0
        fan_out_ratio = max_out / avg_out if avg_out > 0 else 0

        # Temporal compactness: low = all activity in short window
        active_hours_list = [
            node_features[n]["active_hours"] for n in members if n in node_features
        ]
        temporal_compactness = 1.0 / (np.mean(active_hours_list) + 1) if active_hours_list else 0

        # Internal transaction ratio
        total_member_edges = sum(G.degree(n) for n in members)
        internal_ratio = (2 * n_edges) / total_member_edges if total_member_edges > 0 else 0

        # Average burst score
        burst_scores = [
            node_features[n]["activity_burst_score"] for n in members if n in node_features
        ]
        avg_burst = np.mean(burst_scores) if burst_scores else 0

        cluster_features[cid] = {
            "size": n_nodes,
            "density": round(density, 4),
            "avg_tx_volume": round(avg_volume, 2),
            "fan_out_ratio": round(fan_out_ratio, 4),
            "temporal_compactness": round(temporal_compactness, 4),
            "internal_tx_ratio": round(internal_ratio, 4),
            "avg_burst_score": round(avg_burst, 4),
            "total_volume": round(total_volume, 2),
            "n_edges": n_edges,
            "members": members,
        }

    return cluster_features
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && source venv/bin/activate && python -m pytest tests/test_engine.py -v`
Expected: 4 tests PASS

- [ ] **Step 5: Commit**

```bash
git add backend/engine/features.py backend/tests/test_engine.py
git commit -m "feat: add node and cluster feature engineering"
```

---

### Task 4: Detection Engine (Rule-Based + ML Hybrid)

**Files:**
- Create: `backend/engine/detector.py`
- Modify: `backend/tests/test_engine.py` — append tests

- [ ] **Step 1: Append detector tests**

Add to `backend/tests/test_engine.py`:
```python
from engine.detector import RuleBasedDetector, MLDetector, HybridDetector


def test_rule_based_detector_flags_suspicious(small_dataset):
    txns, labels = small_dataset
    G = build_graph(txns)
    communities = detect_communities(G)
    node_feats = compute_node_features(G, communities)
    rule_detector = RuleBasedDetector()
    flags = rule_detector.detect(G, txns, node_feats)
    assert isinstance(flags, dict)  # wallet -> list of rule violations
    # Should flag at least some wallets
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
    # Scores should be 0-100
    for addr, score_data in scores.items():
        assert 0 <= score_data["score"] <= 100
        assert "flags" in score_data
        assert "ml_probability" in score_data
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && source venv/bin/activate && python -m pytest tests/test_engine.py::test_rule_based_detector_flags_suspicious -v`
Expected: FAIL — `ImportError`

- [ ] **Step 3: Implement detector.py**

`backend/engine/detector.py`:
```python
"""Hybrid detection engine: rule-based flags + Random Forest classifier."""

from collections import defaultdict

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report
import networkx as nx


class RuleBasedDetector:
    """Flag wallets based on known laundering heuristics."""

    def detect(
        self,
        G: nx.DiGraph,
        transactions: pd.DataFrame,
        node_features: dict[str, dict],
    ) -> dict[str, list[str]]:
        """Return dict of wallet -> list of triggered rule names."""
        flags: dict[str, list[str]] = defaultdict(list)

        for node, feats in node_features.items():
            # Rule 1: Structuring — many transactions near $10K threshold
            node_txns = transactions[
                (transactions["from_address"] == node) | (transactions["to_address"] == node)
            ]
            if len(node_txns) > 0:
                amounts = node_txns["amount"].values
                near_threshold = np.sum((amounts >= 8500) & (amounts <= 9999))
                if near_threshold >= 5:
                    flags[node].append("structuring_detected")

            # Rule 2: Rapid relay — high burst score
            if feats["activity_burst_score"] > 5.0:
                flags[node].append("rapid_fund_relay")

            # Rule 3: Fan-out — very high out-degree
            if feats["out_degree"] > 15:
                flags[node].append("fan_out_pattern")

            # Rule 4: Fan-in — very high in-degree
            if feats["in_degree"] > 15:
                flags[node].append("fan_in_pattern")

            # Rule 5: Pass-through — sends and receives similar amounts
            if feats["total_sent"] > 10000 and feats["total_received"] > 10000:
                ratio = min(feats["total_sent"], feats["total_received"]) / max(
                    feats["total_sent"], feats["total_received"]
                )
                if ratio > 0.85:
                    flags[node].append("pass_through_behavior")

            # Rule 6: Round-tripping — check for cycles
            # (simplified: check if node has both in and out edges to same peers)
            predecessors = set(G.predecessors(node))
            successors = set(G.successors(node))
            bidirectional = predecessors & successors
            if len(bidirectional) >= 2:
                flags[node].append("circular_flow_detected")

        return dict(flags)


class MLDetector:
    """Random Forest classifier trained on node features with ground-truth labels."""

    def __init__(self):
        self.model = RandomForestClassifier(
            n_estimators=100, max_depth=10, random_state=42, class_weight="balanced"
        )
        self.feature_names = [
            "in_degree", "out_degree", "total_sent", "total_received",
            "tx_count", "avg_tx_size", "in_out_ratio", "activity_burst_score",
            "active_hours",
        ]
        self.metrics = {}

    def train(
        self,
        node_features: dict[str, dict],
        labels: dict[str, str],
    ) -> dict:
        """Train the model and return performance metrics."""
        X, y, addresses = [], [], []
        for addr, feats in node_features.items():
            if addr in labels:
                feature_vec = [feats[f] for f in self.feature_names]
                X.append(feature_vec)
                y.append(1 if labels[addr] == "suspicious" else 0)
                addresses.append(addr)

        X = np.array(X)
        y = np.array(y)

        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.3, random_state=42, stratify=y
        )
        self.model.fit(X_train, y_train)

        y_pred = self.model.predict(X_test)
        report = classification_report(y_test, y_pred, output_dict=True, zero_division=0)
        self.metrics = {
            "precision": round(report.get("1", {}).get("precision", 0), 4),
            "recall": round(report.get("1", {}).get("recall", 0), 4),
            "f1": round(report.get("1", {}).get("f1-score", 0), 4),
            "accuracy": round(report.get("accuracy", 0), 4),
        }
        return self.metrics

    def predict_proba(self, node_features: dict[str, dict]) -> dict[str, float]:
        """Return P(suspicious) for every node."""
        results = {}
        for addr, feats in node_features.items():
            feature_vec = np.array([[feats[f] for f in self.feature_names]])
            proba = self.model.predict_proba(feature_vec)[0]
            # Index 1 = P(suspicious)
            results[addr] = round(float(proba[1]) if len(proba) > 1 else 0.0, 4)
        return results


class HybridDetector:
    """Combines rule-based flags with ML probability into a unified score."""

    def __init__(self):
        self.rule_detector = RuleBasedDetector()
        self.ml_detector = MLDetector()

    def run(
        self,
        G: nx.DiGraph,
        transactions: pd.DataFrame,
        node_features: dict[str, dict],
        cluster_features: dict[int, dict],
        labels: dict[str, str],
    ) -> dict[str, dict]:
        """Run full detection pipeline. Returns per-wallet score data."""
        # Rule-based detection
        rule_flags = self.rule_detector.detect(G, transactions, node_features)

        # ML detection
        self.ml_detector.train(node_features, labels)
        ml_probas = self.ml_detector.predict_proba(node_features)

        # Combine into hybrid score (0-100)
        results = {}
        for addr in node_features:
            flags = rule_flags.get(addr, [])
            ml_prob = ml_probas.get(addr, 0.0)

            # Rule score: 0-50 based on number and severity of flags
            rule_score = min(len(flags) * 12, 50)

            # ML score: 0-50 based on probability
            ml_score = ml_prob * 50

            composite = round(rule_score + ml_score, 1)
            composite = min(composite, 100)

            results[addr] = {
                "score": composite,
                "rule_score": rule_score,
                "ml_score": round(ml_score, 1),
                "ml_probability": ml_prob,
                "flags": flags,
                "n_flags": len(flags),
            }

        return results

    @property
    def ml_metrics(self) -> dict:
        return self.ml_detector.metrics
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && source venv/bin/activate && python -m pytest tests/test_engine.py -v`
Expected: 6 tests PASS

- [ ] **Step 5: Commit**

```bash
git add backend/engine/detector.py backend/tests/test_engine.py
git commit -m "feat: add hybrid detection engine (rule-based + Random Forest)"
```

---

### Task 5: Risk Scorer + Full Pipeline

**Files:**
- Create: `backend/engine/risk_scorer.py`
- Create: `backend/main.py`
- Create: `backend/api/routes.py`
- Create: `backend/tests/test_api.py`

- [ ] **Step 1: Implement risk_scorer.py**

`backend/engine/risk_scorer.py`:
```python
"""Composite risk scoring with explainability for wallets and clusters."""


def score_clusters(
    cluster_features: dict[int, dict],
    wallet_scores: dict[str, dict],
) -> dict[int, dict]:
    """Compute per-cluster risk scores by aggregating wallet scores.

    Returns dict of cluster_id -> {score, risk_level, flags, top_wallets, ...}
    """
    cluster_scores = {}
    for cid, cfeats in cluster_features.items():
        members = cfeats.get("members", [])
        if not members:
            continue

        # Aggregate wallet scores
        member_scores = [
            wallet_scores[m]["score"] for m in members if m in wallet_scores
        ]
        if not member_scores:
            continue

        avg_score = sum(member_scores) / len(member_scores)
        max_score = max(member_scores)

        # Cluster-level risk adjustments
        cluster_risk = avg_score * 0.4 + max_score * 0.3

        # Bonus for suspicious cluster topology
        if cfeats["density"] > 0.3:
            cluster_risk += 10
        if cfeats["fan_out_ratio"] > 5:
            cluster_risk += 8
        if cfeats["temporal_compactness"] > 0.1:
            cluster_risk += 7

        cluster_risk = min(round(cluster_risk, 1), 100)

        # Collect all flags from members
        all_flags = set()
        for m in members:
            if m in wallet_scores:
                all_flags.update(wallet_scores[m].get("flags", []))

        # Risk level label
        if cluster_risk >= 70:
            risk_level = "critical"
        elif cluster_risk >= 40:
            risk_level = "high"
        elif cluster_risk >= 20:
            risk_level = "medium"
        else:
            risk_level = "low"

        # Top suspicious wallets in this cluster
        top_wallets = sorted(
            [(m, wallet_scores[m]["score"]) for m in members if m in wallet_scores],
            key=lambda x: x[1],
            reverse=True,
        )[:5]

        cluster_scores[cid] = {
            "cluster_id": cid,
            "score": cluster_risk,
            "risk_level": risk_level,
            "size": cfeats["size"],
            "density": cfeats["density"],
            "total_volume": cfeats["total_volume"],
            "flags": sorted(all_flags),
            "top_wallets": [{"address": addr, "score": s} for addr, s in top_wallets],
            "avg_wallet_score": round(avg_score, 1),
            "max_wallet_score": max_score,
            "members": members,
        }

    return cluster_scores
```

- [ ] **Step 2: Implement API routes**

`backend/api/routes.py`:
```python
"""FastAPI route definitions."""

from fastapi import APIRouter, Query

router = APIRouter(prefix="/api")

# These will be populated by main.py on startup
_state = {
    "transactions": None,
    "labels": None,
    "graph": None,
    "communities": None,
    "node_features": None,
    "cluster_features": None,
    "wallet_scores": None,
    "cluster_scores": None,
    "ml_metrics": None,
}


def set_state(key: str, value):
    _state[key] = value


@router.get("/stats")
def get_stats():
    txns = _state["transactions"]
    wallet_scores = _state["wallet_scores"]
    cluster_scores = _state["cluster_scores"]
    ml_metrics = _state["ml_metrics"]

    high_risk = sum(1 for s in wallet_scores.values() if s["score"] >= 70)
    medium_risk = sum(1 for s in wallet_scores.values() if 40 <= s["score"] < 70)

    critical_clusters = sum(
        1 for c in cluster_scores.values() if c["risk_level"] == "critical"
    )

    return {
        "total_transactions": len(txns),
        "total_wallets": len(wallet_scores),
        "total_clusters": len(cluster_scores),
        "high_risk_wallets": high_risk,
        "medium_risk_wallets": medium_risk,
        "critical_clusters": critical_clusters,
        "ml_metrics": ml_metrics,
    }


@router.get("/network")
def get_network(
    min_score: float = Query(0, ge=0, le=100),
    max_nodes: int = Query(500, ge=10, le=5000),
):
    """Return graph data for visualization. Filters by min risk score."""
    wallet_scores = _state["wallet_scores"]
    graph = _state["graph"]
    communities = _state["communities"]

    # Filter nodes by score, keep top N
    scored_nodes = sorted(
        wallet_scores.items(), key=lambda x: x[1]["score"], reverse=True
    )
    filtered = [
        (addr, data) for addr, data in scored_nodes if data["score"] >= min_score
    ][:max_nodes]
    filtered_addrs = {addr for addr, _ in filtered}

    nodes = []
    for addr, data in filtered:
        node_data = graph.nodes.get(addr, {})
        nodes.append({
            "id": addr,
            "score": data["score"],
            "risk_level": "critical" if data["score"] >= 70 else "high" if data["score"] >= 40 else "medium" if data["score"] >= 20 else "low",
            "flags": data["flags"],
            "community": communities.get(addr, -1),
            "total_sent": node_data.get("total_sent", 0),
            "total_received": node_data.get("total_received", 0),
            "tx_count": node_data.get("tx_count", 0),
        })

    edges = []
    for u, v, data in graph.edges(data=True):
        if u in filtered_addrs and v in filtered_addrs:
            edges.append({
                "source": u,
                "target": v,
                "total_amount": data.get("total_amount", 0),
                "tx_count": data.get("tx_count", 0),
            })

    return {"nodes": nodes, "edges": edges}


@router.get("/alerts")
def get_alerts(limit: int = Query(20, ge=1, le=100)):
    """Return top suspicious clusters ranked by risk score."""
    cluster_scores = _state["cluster_scores"]
    sorted_clusters = sorted(
        cluster_scores.values(), key=lambda x: x["score"], reverse=True
    )[:limit]

    # Don't send full member lists in alert summary
    results = []
    for c in sorted_clusters:
        results.append({
            "cluster_id": c["cluster_id"],
            "score": c["score"],
            "risk_level": c["risk_level"],
            "size": c["size"],
            "total_volume": c["total_volume"],
            "flags": c["flags"],
            "top_wallets": c["top_wallets"],
        })
    return results


@router.get("/cluster/{cluster_id}")
def get_cluster(cluster_id: int):
    """Detailed investigation data for a specific cluster."""
    cluster_scores = _state["cluster_scores"]
    if cluster_id not in cluster_scores:
        return {"error": "Cluster not found"}

    cluster = cluster_scores[cluster_id]
    members = cluster["members"]
    txns = _state["transactions"]
    wallet_scores = _state["wallet_scores"]

    # Get all transactions within this cluster
    member_set = set(members)
    cluster_txns = txns[
        txns["from_address"].isin(member_set) & txns["to_address"].isin(member_set)
    ].copy()
    cluster_txns["timestamp"] = cluster_txns["timestamp"].astype(str)

    # Wallet details
    wallet_details = []
    for m in members:
        if m in wallet_scores:
            ws = wallet_scores[m]
            nd = _state["graph"].nodes.get(m, {})
            wallet_details.append({
                "address": m,
                "score": ws["score"],
                "flags": ws["flags"],
                "total_sent": nd.get("total_sent", 0),
                "total_received": nd.get("total_received", 0),
                "tx_count": nd.get("tx_count", 0),
            })

    wallet_details.sort(key=lambda x: x["score"], reverse=True)

    return {
        "cluster_id": cluster_id,
        "score": cluster["score"],
        "risk_level": cluster["risk_level"],
        "size": cluster["size"],
        "density": cluster["density"],
        "total_volume": cluster["total_volume"],
        "flags": cluster["flags"],
        "wallets": wallet_details,
        "transactions": cluster_txns.to_dict(orient="records"),
    }


@router.get("/wallet/{address}")
def get_wallet(address: str):
    """Deep-dive on a single wallet."""
    wallet_scores = _state["wallet_scores"]
    if address not in wallet_scores:
        return {"error": "Wallet not found"}

    ws = wallet_scores[address]
    nd = _state["graph"].nodes.get(address, {})
    community = _state["communities"].get(address, -1)
    txns = _state["transactions"]

    wallet_txns = txns[
        (txns["from_address"] == address) | (txns["to_address"] == address)
    ].copy()
    wallet_txns["timestamp"] = wallet_txns["timestamp"].astype(str)

    return {
        "address": address,
        "score": ws["score"],
        "rule_score": ws["rule_score"],
        "ml_score": ws["ml_score"],
        "ml_probability": ws["ml_probability"],
        "flags": ws["flags"],
        "community": community,
        "total_sent": nd.get("total_sent", 0),
        "total_received": nd.get("total_received", 0),
        "tx_count": nd.get("tx_count", 0),
        "first_active": nd.get("first_active"),
        "last_active": nd.get("last_active"),
        "transactions": wallet_txns.head(100).to_dict(orient="records"),
    }


@router.get("/timeline/{cluster_id}")
def get_timeline(cluster_id: int):
    """Temporal transaction data for a cluster, bucketed by time."""
    cluster_scores = _state["cluster_scores"]
    if cluster_id not in cluster_scores:
        return {"error": "Cluster not found"}

    members = set(cluster_scores[cluster_id]["members"])
    txns = _state["transactions"]

    cluster_txns = txns[
        txns["from_address"].isin(members) & txns["to_address"].isin(members)
    ].copy()

    if cluster_txns.empty:
        return {"cluster_id": cluster_id, "timeline": []}

    cluster_txns["timestamp"] = pd.to_datetime(cluster_txns["timestamp"])
    cluster_txns = cluster_txns.sort_values("timestamp")

    # Build timeline entries
    entries = []
    for _, row in cluster_txns.iterrows():
        entries.append({
            "timestamp": str(row["timestamp"]),
            "from": row["from_address"],
            "to": row["to_address"],
            "amount": row["amount"],
            "pattern_type": row.get("pattern_type"),
        })

    return {"cluster_id": cluster_id, "timeline": entries}


@router.get("/compare")
def get_compare():
    """Compare rule-based vs ML vs hybrid detection performance."""
    wallet_scores = _state["wallet_scores"]
    labels = _state["labels"]
    ml_metrics = _state["ml_metrics"]

    # Rule-only performance
    rule_tp, rule_fp, rule_fn, rule_tn = 0, 0, 0, 0
    # ML-only performance
    ml_tp, ml_fp, ml_fn, ml_tn = 0, 0, 0, 0
    # Hybrid performance
    hybrid_tp, hybrid_fp, hybrid_fn, hybrid_tn = 0, 0, 0, 0

    for addr, score_data in wallet_scores.items():
        if addr not in labels:
            continue
        actual = labels[addr] == "suspicious"
        rule_pred = score_data["rule_score"] >= 12  # at least 1 flag
        ml_pred = score_data["ml_probability"] >= 0.5
        hybrid_pred = score_data["score"] >= 40

        if actual and rule_pred: rule_tp += 1
        elif not actual and rule_pred: rule_fp += 1
        elif actual and not rule_pred: rule_fn += 1
        else: rule_tn += 1

        if actual and ml_pred: ml_tp += 1
        elif not actual and ml_pred: ml_fp += 1
        elif actual and not ml_pred: ml_fn += 1
        else: ml_tn += 1

        if actual and hybrid_pred: hybrid_tp += 1
        elif not actual and hybrid_pred: hybrid_fp += 1
        elif actual and not hybrid_pred: hybrid_fn += 1
        else: hybrid_tn += 1

    def calc_metrics(tp, fp, fn, tn):
        precision = tp / (tp + fp) if (tp + fp) > 0 else 0
        recall = tp / (tp + fn) if (tp + fn) > 0 else 0
        f1 = 2 * precision * recall / (precision + recall) if (precision + recall) > 0 else 0
        accuracy = (tp + tn) / (tp + fp + fn + tn) if (tp + fp + fn + tn) > 0 else 0
        return {
            "precision": round(precision, 4),
            "recall": round(recall, 4),
            "f1": round(f1, 4),
            "accuracy": round(accuracy, 4),
            "true_positives": tp,
            "false_positives": fp,
        }

    return {
        "rule_based": calc_metrics(rule_tp, rule_fp, rule_fn, rule_tn),
        "ml_only": calc_metrics(ml_tp, ml_fp, ml_fn, ml_tn),
        "hybrid": calc_metrics(hybrid_tp, hybrid_fp, hybrid_fn, hybrid_tn),
    }


# Need pandas for timeline
import pandas as pd
```

- [ ] **Step 3: Implement main.py with startup pipeline**

`backend/main.py`:
```python
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
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)


@app.on_event("startup")
def run_pipeline():
    """Generate data and run the full detection pipeline."""
    print("=" * 60)
    print("ShadowTrace — Running Detection Pipeline")
    print("=" * 60)

    t0 = time.time()

    print("[1/6] Generating synthetic blockchain data...")
    transactions, labels = generate_dataset(
        n_wallets=3000, n_legitimate_txns=50000, n_laundering_rings=12, seed=42
    )
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
    n_communities = len(set(communities.values()))
    print(f"       {n_communities} communities detected")

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
```

- [ ] **Step 4: Write API test**

`backend/tests/test_api.py`:
```python
import pytest
from fastapi.testclient import TestClient
from main import app


@pytest.fixture(scope="module")
def client():
    # Startup event runs the pipeline
    with TestClient(app) as c:
        yield c


def test_stats_endpoint(client):
    resp = client.get("/api/stats")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total_transactions"] > 0
    assert data["total_wallets"] > 0
    assert "ml_metrics" in data


def test_network_endpoint(client):
    resp = client.get("/api/network?min_score=0&max_nodes=50")
    assert resp.status_code == 200
    data = resp.json()
    assert "nodes" in data
    assert "edges" in data
    assert len(data["nodes"]) <= 50


def test_alerts_endpoint(client):
    resp = client.get("/api/alerts?limit=5")
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    assert len(data) <= 5
    if data:
        assert "score" in data[0]
        assert "risk_level" in data[0]


def test_compare_endpoint(client):
    resp = client.get("/api/compare")
    assert resp.status_code == 200
    data = resp.json()
    assert "rule_based" in data
    assert "ml_only" in data
    assert "hybrid" in data
```

- [ ] **Step 5: Run all tests**

Run: `cd backend && source venv/bin/activate && python -m pytest tests/ -v`
Expected: All tests PASS

- [ ] **Step 6: Start the server and verify manually**

Run: `cd backend && source venv/bin/activate && uvicorn main:app --reload --port 8000`
Then open: `http://localhost:8000/api/stats`
Expected: JSON response with transaction/wallet/cluster counts

- [ ] **Step 7: Commit**

```bash
git add backend/
git commit -m "feat: add risk scorer, API layer, and full detection pipeline"
```

---

### Task 6: Frontend Scaffolding + Layout

**Files:**
- Create: `frontend/` (via Vite)
- Create: `frontend/src/index.css`
- Create: `frontend/src/App.jsx`
- Create: `frontend/src/api/client.js`
- Create: `frontend/src/components/Layout.jsx`
- Create: `frontend/src/utils/formatters.js`

- [ ] **Step 1: Scaffold React project with Vite**

Run:
```bash
cd /Users/Aamir/Documents/FinHack
npm create vite@latest frontend -- --template react
cd frontend
npm install
npm install react-router-dom axios recharts react-force-graph-2d tailwindcss @tailwindcss/vite
```

- [ ] **Step 2: Configure Tailwind with Vite plugin**

`frontend/vite.config.js`:
```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': 'http://localhost:8000',
    },
  },
})
```

- [ ] **Step 3: Create global CSS with dark theme**

`frontend/src/index.css`:
```css
@import "tailwindcss";

:root {
  --bg-primary: #0a0e17;
  --bg-secondary: #111827;
  --bg-card: #1a2236;
  --bg-card-hover: #1f2a40;
  --border: #2a3548;
  --text-primary: #e2e8f0;
  --text-secondary: #94a3b8;
  --accent-blue: #3b82f6;
  --accent-cyan: #06b6d4;
  --risk-critical: #ef4444;
  --risk-high: #f59e0b;
  --risk-medium: #eab308;
  --risk-low: #22c55e;
}

body {
  margin: 0;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
}

/* Scrollbar styling */
::-webkit-scrollbar { width: 6px; }
::-webkit-scrollbar-track { background: var(--bg-secondary); }
::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }
```

- [ ] **Step 4: Create API client**

`frontend/src/api/client.js`:
```js
import axios from 'axios';

const api = axios.create({ baseURL: '/api' });

export const fetchStats = () => api.get('/stats').then(r => r.data);
export const fetchNetwork = (minScore = 0, maxNodes = 500) =>
  api.get(`/network?min_score=${minScore}&max_nodes=${maxNodes}`).then(r => r.data);
export const fetchAlerts = (limit = 20) =>
  api.get(`/alerts?limit=${limit}`).then(r => r.data);
export const fetchCluster = (id) => api.get(`/cluster/${id}`).then(r => r.data);
export const fetchWallet = (address) => api.get(`/wallet/${address}`).then(r => r.data);
export const fetchTimeline = (clusterId) => api.get(`/timeline/${clusterId}`).then(r => r.data);
export const fetchCompare = () => api.get('/compare').then(r => r.data);
```

- [ ] **Step 5: Create utility formatters**

`frontend/src/utils/formatters.js`:
```js
export const truncateAddress = (addr) =>
  addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : '';

export const formatCurrency = (amount) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', maximumFractionDigits: 0,
  }).format(amount);

export const formatNumber = (n) =>
  new Intl.NumberFormat('en-US').format(n);

export const riskColor = (score) => {
  if (score >= 70) return 'var(--risk-critical)';
  if (score >= 40) return 'var(--risk-high)';
  if (score >= 20) return 'var(--risk-medium)';
  return 'var(--risk-low)';
};

export const riskLabel = (score) => {
  if (score >= 70) return 'Critical';
  if (score >= 40) return 'High';
  if (score >= 20) return 'Medium';
  return 'Low';
};
```

- [ ] **Step 6: Create Layout component**

`frontend/src/components/Layout.jsx`:
```jsx
import { NavLink, Outlet } from 'react-router-dom';

const navItems = [
  { to: '/', label: 'Dashboard', icon: '◉' },
  { to: '/network', label: 'Network Explorer', icon: '◎' },
  { to: '/investigation', label: 'Investigation', icon: '⚑' },
  { to: '/timeline', label: 'Timeline', icon: '◷' },
];

export default function Layout() {
  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <nav
        className="w-60 flex-shrink-0 flex flex-col border-r"
        style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border)' }}
      >
        <div className="p-5 border-b" style={{ borderColor: 'var(--border)' }}>
          <h1 className="text-xl font-bold tracking-tight" style={{ color: 'var(--accent-cyan)' }}>
            ShadowTrace
          </h1>
          <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
            AI Money Laundering Detection
          </p>
        </div>
        <div className="flex-1 py-4">
          {navItems.map(({ to, label, icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-5 py-3 text-sm transition-colors ${
                  isActive ? 'font-semibold' : ''
                }`
              }
              style={({ isActive }) => ({
                color: isActive ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                background: isActive ? 'rgba(6, 182, 212, 0.08)' : 'transparent',
                borderRight: isActive ? '2px solid var(--accent-cyan)' : '2px solid transparent',
              })}
            >
              <span className="text-lg">{icon}</span>
              {label}
            </NavLink>
          ))}
        </div>
        <div className="p-4 border-t text-xs" style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>
          FinHack 2026 — Case 1
        </div>
      </nav>

      {/* Main content */}
      <main className="flex-1 overflow-auto p-6" style={{ background: 'var(--bg-primary)' }}>
        <Outlet />
      </main>
    </div>
  );
}
```

- [ ] **Step 7: Create StatsCard component**

`frontend/src/components/StatsCard.jsx`:
```jsx
export default function StatsCard({ label, value, subtitle, color }) {
  return (
    <div
      className="rounded-xl p-5 border"
      style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
    >
      <p className="text-xs uppercase tracking-wider mb-1" style={{ color: 'var(--text-secondary)' }}>
        {label}
      </p>
      <p className="text-2xl font-bold" style={{ color: color || 'var(--text-primary)' }}>
        {value}
      </p>
      {subtitle && (
        <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>{subtitle}</p>
      )}
    </div>
  );
}
```

- [ ] **Step 8: Wire up App.jsx with router**

`frontend/src/App.jsx`:
```jsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import NetworkGraph from './components/NetworkGraph';
import InvestigationPanel from './components/InvestigationPanel';
import Timeline from './components/Timeline';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/network" element={<NetworkGraph />} />
          <Route path="/investigation" element={<InvestigationPanel />} />
          <Route path="/timeline" element={<Timeline />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
```

- [ ] **Step 9: Update main.jsx**

`frontend/src/main.jsx`:
```jsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);
```

- [ ] **Step 10: Commit**

```bash
git add frontend/
git commit -m "feat: scaffold frontend with React, Tailwind, routing, and dark theme"
```

---

### Task 7: Dashboard Page

**Files:**
- Create: `frontend/src/components/Dashboard.jsx`

- [ ] **Step 1: Implement Dashboard**

`frontend/src/components/Dashboard.jsx`:
```jsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';
import { fetchStats, fetchAlerts, fetchCompare } from '../api/client';
import { formatNumber, formatCurrency, truncateAddress, riskColor } from '../utils/formatters';
import StatsCard from './StatsCard';

const RISK_COLORS = {
  critical: 'var(--risk-critical)',
  high: 'var(--risk-high)',
  medium: 'var(--risk-medium)',
  low: 'var(--risk-low)',
};

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [compare, setCompare] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchStats().then(setStats);
    fetchAlerts(10).then(setAlerts);
    fetchCompare().then(setCompare);
  }, []);

  if (!stats) {
    return <div className="flex items-center justify-center h-full" style={{ color: 'var(--text-secondary)' }}>Loading pipeline results...</div>;
  }

  const riskDistribution = [
    { name: 'Critical', value: stats.critical_clusters, color: RISK_COLORS.critical },
    { name: 'High', value: stats.high_risk_wallets, color: RISK_COLORS.high },
    { name: 'Medium', value: stats.medium_risk_wallets, color: RISK_COLORS.medium },
  ];

  const compareData = compare ? [
    { name: 'Rule-Based', precision: compare.rule_based.precision, recall: compare.rule_based.recall, f1: compare.rule_based.f1 },
    { name: 'ML-Only', precision: compare.ml_only.precision, recall: compare.ml_only.recall, f1: compare.ml_only.f1 },
    { name: 'Hybrid', precision: compare.hybrid.precision, recall: compare.hybrid.recall, f1: compare.hybrid.f1 },
  ] : [];

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Dashboard</h2>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4">
        <StatsCard label="Transactions Analyzed" value={formatNumber(stats.total_transactions)} />
        <StatsCard label="Wallets Monitored" value={formatNumber(stats.total_wallets)} />
        <StatsCard label="High Risk Wallets" value={stats.high_risk_wallets} color="var(--risk-critical)" />
        <StatsCard label="Critical Clusters" value={stats.critical_clusters} color="var(--risk-critical)" />
      </div>

      <div className="grid grid-cols-3 gap-4">
        {/* Risk Distribution */}
        <div className="rounded-xl p-5 border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
          <h3 className="text-sm font-semibold mb-4">Risk Distribution</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={riskDistribution} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={40} outerRadius={80}>
                {riskDistribution.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8 }} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Model Comparison */}
        <div className="col-span-2 rounded-xl p-5 border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
          <h3 className="text-sm font-semibold mb-4">Detection Model Comparison</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={compareData}>
              <XAxis dataKey="name" stroke="var(--text-secondary)" fontSize={12} />
              <YAxis stroke="var(--text-secondary)" fontSize={12} domain={[0, 1]} />
              <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8 }} />
              <Bar dataKey="precision" fill="var(--accent-blue)" name="Precision" />
              <Bar dataKey="recall" fill="var(--accent-cyan)" name="Recall" />
              <Bar dataKey="f1" fill="#a78bfa" name="F1 Score" />
              <Legend />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Alert Feed */}
      <div className="rounded-xl border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
        <div className="p-5 border-b" style={{ borderColor: 'var(--border)' }}>
          <h3 className="text-sm font-semibold">Suspicious Cluster Alerts</h3>
        </div>
        <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
          {alerts.map((alert) => (
            <div
              key={alert.cluster_id}
              className="flex items-center justify-between px-5 py-3 cursor-pointer transition-colors"
              style={{ borderColor: 'var(--border)' }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-card-hover)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              onClick={() => navigate(`/investigation?cluster=${alert.cluster_id}`)}
            >
              <div className="flex items-center gap-4">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ background: RISK_COLORS[alert.risk_level] }}
                />
                <div>
                  <span className="text-sm font-medium">Cluster #{alert.cluster_id}</span>
                  <span className="text-xs ml-3" style={{ color: 'var(--text-secondary)' }}>
                    {alert.size} wallets · {formatCurrency(alert.total_volume)}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex gap-1">
                  {alert.flags.slice(0, 3).map((flag) => (
                    <span
                      key={flag}
                      className="text-xs px-2 py-0.5 rounded"
                      style={{ background: 'rgba(239, 68, 68, 0.15)', color: 'var(--risk-critical)' }}
                    >
                      {flag.replace(/_/g, ' ')}
                    </span>
                  ))}
                </div>
                <span className="text-sm font-bold" style={{ color: riskColor(alert.score) }}>
                  {alert.score}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ML Metrics */}
      {stats.ml_metrics && (
        <div className="grid grid-cols-4 gap-4">
          <StatsCard label="ML Precision" value={`${(stats.ml_metrics.precision * 100).toFixed(1)}%`} color="var(--accent-blue)" />
          <StatsCard label="ML Recall" value={`${(stats.ml_metrics.recall * 100).toFixed(1)}%`} color="var(--accent-cyan)" />
          <StatsCard label="ML F1 Score" value={`${(stats.ml_metrics.f1 * 100).toFixed(1)}%`} color="#a78bfa" />
          <StatsCard label="ML Accuracy" value={`${(stats.ml_metrics.accuracy * 100).toFixed(1)}%`} color="var(--risk-low)" />
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify it renders**

Run backend: `cd backend && source venv/bin/activate && uvicorn main:app --port 8000`
Run frontend: `cd frontend && npm run dev`
Open `http://localhost:5173` — should see dashboard with stats cards, charts, and alert feed.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/Dashboard.jsx
git commit -m "feat: add dashboard page with stats, risk charts, and alert feed"
```

---

### Task 8: Network Graph Explorer

**Files:**
- Create: `frontend/src/components/NetworkGraph.jsx`

- [ ] **Step 1: Implement NetworkGraph**

`frontend/src/components/NetworkGraph.jsx`:
```jsx
import { useState, useEffect, useCallback, useRef } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { fetchNetwork, fetchWallet } from '../api/client';
import { truncateAddress, formatCurrency, riskColor, riskLabel } from '../utils/formatters';

export default function NetworkGraph() {
  const [graphData, setGraphData] = useState({ nodes: [], links: [] });
  const [selectedNode, setSelectedNode] = useState(null);
  const [walletDetail, setWalletDetail] = useState(null);
  const [minScore, setMinScore] = useState(0);
  const [loading, setLoading] = useState(true);
  const graphRef = useRef();

  useEffect(() => {
    setLoading(true);
    fetchNetwork(minScore, 500).then((data) => {
      setGraphData({
        nodes: data.nodes.map((n) => ({
          ...n,
          val: Math.max(Math.sqrt(n.tx_count) * 2, 3),
          color: riskColor(n.score),
        })),
        links: data.edges.map((e) => ({
          source: e.source,
          target: e.target,
          value: e.total_amount,
          txCount: e.tx_count,
        })),
      });
      setLoading(false);
    });
  }, [minScore]);

  const handleNodeClick = useCallback((node) => {
    setSelectedNode(node);
    fetchWallet(node.id).then(setWalletDetail);
    // Center camera on clicked node
    if (graphRef.current) {
      graphRef.current.centerAt(node.x, node.y, 500);
      graphRef.current.zoom(3, 500);
    }
  }, []);

  const nodeCanvasObject = useCallback((node, ctx, globalScale) => {
    const radius = node.val;
    // Glow effect for high-risk nodes
    if (node.score >= 40) {
      ctx.beginPath();
      ctx.arc(node.x, node.y, radius + 4, 0, 2 * Math.PI);
      ctx.fillStyle = `${node.color}33`;
      ctx.fill();
    }
    // Node circle
    ctx.beginPath();
    ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI);
    ctx.fillStyle = node.color;
    ctx.fill();
    ctx.strokeStyle = selectedNode?.id === node.id ? '#fff' : 'rgba(255,255,255,0.1)';
    ctx.lineWidth = selectedNode?.id === node.id ? 2 : 0.5;
    ctx.stroke();
    // Label for zoomed-in view
    if (globalScale > 2) {
      ctx.font = `${10 / globalScale}px Inter, sans-serif`;
      ctx.fillStyle = 'var(--text-secondary)';
      ctx.textAlign = 'center';
      ctx.fillText(truncateAddress(node.id), node.x, node.y + radius + 8 / globalScale);
    }
  }, [selectedNode]);

  return (
    <div className="flex h-full gap-4">
      {/* Graph Area */}
      <div className="flex-1 flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold">Network Explorer</h2>
          <div className="flex items-center gap-3">
            <label className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              Min Risk Score:
            </label>
            <input
              type="range"
              min={0}
              max={80}
              value={minScore}
              onChange={(e) => setMinScore(Number(e.target.value))}
              className="w-32"
            />
            <span className="text-xs font-mono w-8">{minScore}</span>
            <div className="flex gap-2 ml-4">
              {['Low', 'Medium', 'High', 'Critical'].map((label, i) => (
                <div key={label} className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
                  <div className="w-2 h-2 rounded-full" style={{
                    background: [
                      'var(--risk-low)', 'var(--risk-medium)',
                      'var(--risk-high)', 'var(--risk-critical)'
                    ][i]
                  }} />
                  {label}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div
          className="flex-1 rounded-xl border overflow-hidden"
          style={{ background: '#060a12', borderColor: 'var(--border)' }}
        >
          {loading ? (
            <div className="flex items-center justify-center h-full" style={{ color: 'var(--text-secondary)' }}>
              Loading network...
            </div>
          ) : (
            <ForceGraph2D
              ref={graphRef}
              graphData={graphData}
              nodeCanvasObject={nodeCanvasObject}
              linkColor={() => 'rgba(59, 130, 246, 0.15)'}
              linkWidth={(link) => Math.max(Math.log(link.txCount + 1), 0.5)}
              linkDirectionalArrowLength={3}
              linkDirectionalArrowRelPos={1}
              onNodeClick={handleNodeClick}
              backgroundColor="#060a12"
              cooldownTicks={100}
              nodeRelSize={4}
            />
          )}
        </div>
      </div>

      {/* Side Panel */}
      {selectedNode && (
        <div
          className="w-80 rounded-xl border overflow-y-auto"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
        >
          <div className="p-4 border-b" style={{ borderColor: 'var(--border)' }}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Wallet Details</h3>
              <button
                onClick={() => { setSelectedNode(null); setWalletDetail(null); }}
                className="text-xs px-2 py-1 rounded"
                style={{ color: 'var(--text-secondary)' }}
              >
                Close
              </button>
            </div>
          </div>

          <div className="p-4 space-y-4">
            <div>
              <p className="text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Address</p>
              <p className="text-xs font-mono break-all">{selectedNode.id}</p>
            </div>

            <div className="flex gap-4">
              <div>
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Risk Score</p>
                <p className="text-xl font-bold" style={{ color: riskColor(selectedNode.score) }}>
                  {selectedNode.score}
                </p>
              </div>
              <div>
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Risk Level</p>
                <span
                  className="text-xs px-2 py-1 rounded font-semibold"
                  style={{ background: `${riskColor(selectedNode.score)}22`, color: riskColor(selectedNode.score) }}
                >
                  {riskLabel(selectedNode.score)}
                </span>
              </div>
            </div>

            {selectedNode.flags?.length > 0 && (
              <div>
                <p className="text-xs mb-2" style={{ color: 'var(--text-secondary)' }}>Flags</p>
                <div className="flex flex-wrap gap-1">
                  {selectedNode.flags.map((flag) => (
                    <span
                      key={flag}
                      className="text-xs px-2 py-0.5 rounded"
                      style={{ background: 'rgba(239, 68, 68, 0.15)', color: 'var(--risk-critical)' }}
                    >
                      {flag.replace(/_/g, ' ')}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Total Sent</p>
                <p className="text-sm font-semibold">{formatCurrency(selectedNode.total_sent)}</p>
              </div>
              <div>
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Total Received</p>
                <p className="text-sm font-semibold">{formatCurrency(selectedNode.total_received)}</p>
              </div>
              <div>
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Transactions</p>
                <p className="text-sm font-semibold">{selectedNode.tx_count}</p>
              </div>
              <div>
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Community</p>
                <p className="text-sm font-semibold">#{selectedNode.community}</p>
              </div>
            </div>

            {walletDetail && (
              <div>
                <p className="text-xs mb-2" style={{ color: 'var(--text-secondary)' }}>
                  Score Breakdown
                </p>
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span>Rule-based</span>
                    <span className="font-mono">{walletDetail.rule_score}</span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${walletDetail.rule_score}%`, background: 'var(--accent-blue)' }}
                    />
                  </div>
                  <div className="flex justify-between text-xs">
                    <span>ML Probability</span>
                    <span className="font-mono">{(walletDetail.ml_probability * 100).toFixed(1)}%</span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${walletDetail.ml_probability * 100}%`, background: 'var(--accent-cyan)' }}
                    />
                  </div>
                </div>
              </div>
            )}

            {walletDetail?.transactions?.length > 0 && (
              <div>
                <p className="text-xs mb-2" style={{ color: 'var(--text-secondary)' }}>
                  Recent Transactions ({walletDetail.transactions.length})
                </p>
                <div className="space-y-1 max-h-60 overflow-y-auto">
                  {walletDetail.transactions.slice(0, 20).map((tx, i) => (
                    <div
                      key={i}
                      className="text-xs p-2 rounded"
                      style={{ background: 'var(--bg-secondary)' }}
                    >
                      <div className="flex justify-between">
                        <span style={{ color: tx.from_address === selectedNode.id ? 'var(--risk-critical)' : 'var(--risk-low)' }}>
                          {tx.from_address === selectedNode.id ? 'SENT' : 'RECV'}
                        </span>
                        <span className="font-mono">{formatCurrency(tx.amount)}</span>
                      </div>
                      <div className="font-mono mt-0.5" style={{ color: 'var(--text-secondary)', fontSize: '10px' }}>
                        {tx.from_address === selectedNode.id
                          ? `→ ${truncateAddress(tx.to_address)}`
                          : `← ${truncateAddress(tx.from_address)}`
                        }
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify it renders**

Open `http://localhost:5173/network` — should see interactive force-directed graph with colored nodes. Click a node to see the side panel.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/NetworkGraph.jsx
git commit -m "feat: add interactive network graph explorer with wallet side panel"
```

---

### Task 9: Investigation Panel

**Files:**
- Create: `frontend/src/components/InvestigationPanel.jsx`

- [ ] **Step 1: Implement InvestigationPanel**

`frontend/src/components/InvestigationPanel.jsx`:
```jsx
import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  Treemap,
} from 'recharts';
import { fetchAlerts, fetchCluster } from '../api/client';
import { truncateAddress, formatCurrency, riskColor, riskLabel } from '../utils/formatters';

export default function InvestigationPanel() {
  const [searchParams] = useSearchParams();
  const [alerts, setAlerts] = useState([]);
  const [selectedClusterId, setSelectedClusterId] = useState(null);
  const [clusterData, setClusterData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchAlerts(20).then(setAlerts);
    const clusterId = searchParams.get('cluster');
    if (clusterId) {
      selectCluster(Number(clusterId));
    }
  }, []);

  const selectCluster = (id) => {
    setSelectedClusterId(id);
    setLoading(true);
    fetchCluster(id).then((data) => {
      setClusterData(data);
      setLoading(false);
    });
  };

  return (
    <div className="flex h-full gap-4">
      {/* Cluster List */}
      <div
        className="w-72 rounded-xl border overflow-y-auto flex-shrink-0"
        style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
      >
        <div className="p-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <h3 className="text-sm font-semibold">Flagged Clusters</h3>
          <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
            {alerts.length} clusters ranked by risk
          </p>
        </div>
        <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
          {alerts.map((alert) => (
            <div
              key={alert.cluster_id}
              className="px-4 py-3 cursor-pointer transition-colors"
              style={{
                background: selectedClusterId === alert.cluster_id ? 'var(--bg-card-hover)' : 'transparent',
                borderColor: 'var(--border)',
              }}
              onClick={() => selectCluster(alert.cluster_id)}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-card-hover)'}
              onMouseLeave={(e) => {
                if (selectedClusterId !== alert.cluster_id)
                  e.currentTarget.style.background = 'transparent';
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ background: riskColor(alert.score) }}
                  />
                  <span className="text-sm font-medium">Cluster #{alert.cluster_id}</span>
                </div>
                <span className="text-sm font-bold" style={{ color: riskColor(alert.score) }}>
                  {alert.score}
                </span>
              </div>
              <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                {alert.size} wallets · {formatCurrency(alert.total_volume)}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Investigation Detail */}
      <div className="flex-1 overflow-y-auto space-y-4">
        {!clusterData && !loading && (
          <div className="flex items-center justify-center h-full" style={{ color: 'var(--text-secondary)' }}>
            Select a cluster to investigate
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center h-full" style={{ color: 'var(--text-secondary)' }}>
            Loading cluster data...
          </div>
        )}

        {clusterData && !loading && (
          <>
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold">Cluster #{clusterData.cluster_id}</h2>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  Investigation Report
                </p>
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold" style={{ color: riskColor(clusterData.score) }}>
                  {clusterData.score}
                </p>
                <span
                  className="text-xs px-3 py-1 rounded font-semibold"
                  style={{
                    background: `${riskColor(clusterData.score)}22`,
                    color: riskColor(clusterData.score),
                  }}
                >
                  {clusterData.risk_level?.toUpperCase()}
                </span>
              </div>
            </div>

            {/* Cluster Stats */}
            <div className="grid grid-cols-4 gap-3">
              {[
                { label: 'Wallets', value: clusterData.size },
                { label: 'Total Volume', value: formatCurrency(clusterData.total_volume) },
                { label: 'Density', value: (clusterData.density * 100).toFixed(1) + '%' },
                { label: 'Internal Txns', value: clusterData.transactions?.length || 0 },
              ].map(({ label, value }) => (
                <div
                  key={label}
                  className="rounded-lg p-3 border"
                  style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
                >
                  <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{label}</p>
                  <p className="text-lg font-bold">{value}</p>
                </div>
              ))}
            </div>

            {/* Why Suspicious */}
            <div className="rounded-xl p-5 border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
              <h3 className="text-sm font-semibold mb-3">Why Is This Suspicious?</h3>
              <div className="flex flex-wrap gap-2">
                {clusterData.flags?.map((flag) => (
                  <div
                    key={flag}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm"
                    style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)' }}
                  >
                    <span style={{ color: 'var(--risk-critical)' }}>&#9888;</span>
                    <span>{flag.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Wallet Risk Breakdown */}
            <div className="rounded-xl p-5 border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
              <h3 className="text-sm font-semibold mb-3">Wallet Risk Scores</h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart
                  data={(clusterData.wallets || []).slice(0, 15).map((w) => ({
                    name: truncateAddress(w.address),
                    score: w.score,
                    fill: riskColor(w.score),
                  }))}
                >
                  <XAxis dataKey="name" stroke="var(--text-secondary)" fontSize={10} angle={-45} textAnchor="end" height={60} />
                  <YAxis stroke="var(--text-secondary)" fontSize={12} domain={[0, 100]} />
                  <Tooltip
                    contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8 }}
                  />
                  <Bar dataKey="score" name="Risk Score">
                    {(clusterData.wallets || []).slice(0, 15).map((w, i) => (
                      <Cell key={i} fill={riskColor(w.score)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Transaction Table */}
            <div className="rounded-xl border overflow-hidden" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
              <div className="p-4 border-b" style={{ borderColor: 'var(--border)' }}>
                <h3 className="text-sm font-semibold">
                  Cluster Transactions ({clusterData.transactions?.length || 0})
                </h3>
              </div>
              <div className="overflow-x-auto max-h-80">
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ background: 'var(--bg-secondary)' }}>
                      <th className="text-left px-4 py-2 font-medium" style={{ color: 'var(--text-secondary)' }}>From</th>
                      <th className="text-left px-4 py-2 font-medium" style={{ color: 'var(--text-secondary)' }}>To</th>
                      <th className="text-right px-4 py-2 font-medium" style={{ color: 'var(--text-secondary)' }}>Amount</th>
                      <th className="text-left px-4 py-2 font-medium" style={{ color: 'var(--text-secondary)' }}>Timestamp</th>
                      <th className="text-left px-4 py-2 font-medium" style={{ color: 'var(--text-secondary)' }}>Pattern</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(clusterData.transactions || []).slice(0, 50).map((tx, i) => (
                      <tr
                        key={i}
                        className="border-t"
                        style={{ borderColor: 'var(--border)' }}
                      >
                        <td className="px-4 py-2 font-mono">{truncateAddress(tx.from_address)}</td>
                        <td className="px-4 py-2 font-mono">{truncateAddress(tx.to_address)}</td>
                        <td className="px-4 py-2 text-right font-mono">{formatCurrency(tx.amount)}</td>
                        <td className="px-4 py-2" style={{ color: 'var(--text-secondary)' }}>
                          {tx.timestamp?.slice(0, 19)}
                        </td>
                        <td className="px-4 py-2">
                          {tx.pattern_type && (
                            <span
                              className="px-1.5 py-0.5 rounded text-xs"
                              style={{ background: 'rgba(239, 68, 68, 0.15)', color: 'var(--risk-critical)' }}
                            >
                              {tx.pattern_type}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// Need Cell for individual bar colors
import { Cell } from 'recharts';
```

- [ ] **Step 2: Verify it renders**

Open `http://localhost:5173/investigation` — should see cluster list on left, click one to see full investigation report.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/InvestigationPanel.jsx
git commit -m "feat: add investigation panel with cluster deep-dive and transaction table"
```

---

### Task 10: Timeline View

**Files:**
- Create: `frontend/src/components/Timeline.jsx`

- [ ] **Step 1: Implement Timeline**

`frontend/src/components/Timeline.jsx`:
```jsx
import { useState, useEffect } from 'react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  ScatterChart, Scatter, Cell, CartesianGrid,
} from 'recharts';
import { fetchAlerts, fetchTimeline } from '../api/client';
import { truncateAddress, formatCurrency, riskColor } from '../utils/formatters';

export default function Timeline() {
  const [alerts, setAlerts] = useState([]);
  const [selectedCluster, setSelectedCluster] = useState(null);
  const [timelineData, setTimelineData] = useState([]);
  const [playing, setPlaying] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    fetchAlerts(20).then((data) => {
      setAlerts(data);
      if (data.length > 0) loadTimeline(data[0].cluster_id);
    });
  }, []);

  const loadTimeline = (clusterId) => {
    setSelectedCluster(clusterId);
    setCurrentIndex(0);
    setPlaying(false);
    fetchTimeline(clusterId).then((data) => {
      setTimelineData(data.timeline || []);
    });
  };

  // Auto-play animation
  useEffect(() => {
    if (!playing || timelineData.length === 0) return;
    if (currentIndex >= timelineData.length) {
      setPlaying(false);
      return;
    }
    const timer = setTimeout(() => setCurrentIndex((i) => i + 1), 300);
    return () => clearTimeout(timer);
  }, [playing, currentIndex, timelineData.length]);

  // Build cumulative volume chart data
  const cumulativeData = timelineData.slice(0, currentIndex || timelineData.length).reduce(
    (acc, tx, i) => {
      const prev = acc.length > 0 ? acc[acc.length - 1].cumulative : 0;
      acc.push({
        index: i,
        amount: tx.amount,
        cumulative: prev + tx.amount,
        timestamp: tx.timestamp?.slice(0, 16),
        from: truncateAddress(tx.from),
        to: truncateAddress(tx.to),
        pattern: tx.pattern_type,
      });
      return acc;
    },
    []
  );

  const visibleTxns = timelineData.slice(0, currentIndex || timelineData.length);

  return (
    <div className="space-y-4 h-full flex flex-col">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Timeline Analysis</h2>
        <div className="flex items-center gap-3">
          <select
            className="text-sm px-3 py-1.5 rounded-lg border"
            style={{
              background: 'var(--bg-card)',
              borderColor: 'var(--border)',
              color: 'var(--text-primary)',
            }}
            value={selectedCluster || ''}
            onChange={(e) => loadTimeline(Number(e.target.value))}
          >
            {alerts.map((a) => (
              <option key={a.cluster_id} value={a.cluster_id}>
                Cluster #{a.cluster_id} — Score: {a.score}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Playback Controls */}
      <div
        className="flex items-center gap-4 rounded-xl p-4 border"
        style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
      >
        <button
          onClick={() => {
            if (currentIndex >= timelineData.length) setCurrentIndex(0);
            setPlaying(!playing);
          }}
          className="px-4 py-2 rounded-lg text-sm font-semibold"
          style={{ background: 'var(--accent-cyan)', color: '#000' }}
        >
          {playing ? 'Pause' : currentIndex >= timelineData.length ? 'Replay' : 'Play'}
        </button>
        <button
          onClick={() => { setCurrentIndex(0); setPlaying(false); }}
          className="px-3 py-2 rounded-lg text-sm border"
          style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
        >
          Reset
        </button>
        <div className="flex-1">
          <input
            type="range"
            min={0}
            max={timelineData.length}
            value={currentIndex || timelineData.length}
            onChange={(e) => {
              setPlaying(false);
              setCurrentIndex(Number(e.target.value));
            }}
            className="w-full"
          />
        </div>
        <span className="text-xs font-mono" style={{ color: 'var(--text-secondary)' }}>
          {currentIndex || timelineData.length} / {timelineData.length} txns
        </span>
      </div>

      {/* Cumulative Volume Chart */}
      <div
        className="rounded-xl p-5 border"
        style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
      >
        <h3 className="text-sm font-semibold mb-3">Cumulative Fund Flow</h3>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={cumulativeData}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="index" stroke="var(--text-secondary)" fontSize={11} />
            <YAxis stroke="var(--text-secondary)" fontSize={11} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`} />
            <Tooltip
              contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8 }}
              formatter={(value) => [formatCurrency(value)]}
              labelFormatter={(i) => cumulativeData[i]?.timestamp || ''}
            />
            <Line type="monotone" dataKey="cumulative" stroke="var(--accent-cyan)" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="amount" stroke="var(--accent-blue)" strokeWidth={1} dot={{ r: 2 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Transaction Flow List */}
      <div
        className="flex-1 rounded-xl border overflow-y-auto"
        style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
      >
        <div className="p-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <h3 className="text-sm font-semibold">Transaction Flow</h3>
        </div>
        <div className="p-4 space-y-2">
          {visibleTxns.map((tx, i) => (
            <div
              key={i}
              className="flex items-center gap-3 p-3 rounded-lg text-xs"
              style={{
                background: i === (currentIndex || timelineData.length) - 1
                  ? 'rgba(6, 182, 212, 0.1)'
                  : 'var(--bg-secondary)',
                border: i === (currentIndex || timelineData.length) - 1
                  ? '1px solid var(--accent-cyan)'
                  : '1px solid transparent',
              }}
            >
              <span className="font-mono w-6 text-center" style={{ color: 'var(--text-secondary)' }}>
                {i + 1}
              </span>
              <span className="font-mono" style={{ color: 'var(--accent-blue)' }}>
                {truncateAddress(tx.from)}
              </span>
              <span style={{ color: 'var(--text-secondary)' }}>→</span>
              <span className="font-mono" style={{ color: 'var(--accent-cyan)' }}>
                {truncateAddress(tx.to)}
              </span>
              <span className="font-mono font-semibold ml-auto">{formatCurrency(tx.amount)}</span>
              {tx.pattern_type && (
                <span
                  className="px-1.5 py-0.5 rounded"
                  style={{ background: 'rgba(239, 68, 68, 0.15)', color: 'var(--risk-critical)' }}
                >
                  {tx.pattern_type}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify it renders**

Open `http://localhost:5173/timeline` — should see cluster selector, play/pause controls, cumulative chart, and transaction flow list. Click Play to animate.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/Timeline.jsx
git commit -m "feat: add animated timeline view with cumulative fund flow chart"
```

---

### Task 11: Integration, Polish, and Final Push

**Files:**
- Modify: various files for bug fixes / polish

- [ ] **Step 1: Fix the Cell import in InvestigationPanel.jsx**

Move the `Cell` import to the top of `frontend/src/components/InvestigationPanel.jsx`:
```jsx
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  Treemap, Cell,
} from 'recharts';
```
Remove the duplicate `import { Cell } from 'recharts';` at the bottom.

- [ ] **Step 2: Delete boilerplate files from Vite scaffold**

Run:
```bash
rm frontend/src/App.css frontend/src/assets/react.svg frontend/public/vite.svg
```

- [ ] **Step 3: Verify full app end-to-end**

Run backend: `cd backend && source venv/bin/activate && uvicorn main:app --port 8000`
Run frontend: `cd frontend && npm run dev`

Check each page:
- `http://localhost:5173/` — Dashboard with stats, charts, alerts
- `http://localhost:5173/network` — Network graph with clickable nodes
- `http://localhost:5173/investigation` — Cluster investigation with transaction table
- `http://localhost:5173/timeline` — Animated timeline with fund flow

- [ ] **Step 4: Run all backend tests**

Run: `cd backend && source venv/bin/activate && python -m pytest tests/ -v`
Expected: All tests PASS

- [ ] **Step 5: Commit and push**

```bash
git add -A
git commit -m "feat: complete ShadowTrace prototype — full detection pipeline and dashboard"
git push origin main
```

---

## Post-Implementation Checklist

- [ ] Backend pipeline runs without errors on startup
- [ ] All 7 API endpoints return valid JSON
- [ ] Dashboard renders stats, charts, and alerts
- [ ] Network graph is interactive — nodes are clickable, colors match risk
- [ ] Investigation panel shows cluster details, flags, and transactions
- [ ] Timeline animates with play/pause and scrubber
- [ ] All backend tests pass
- [ ] No console errors in browser
