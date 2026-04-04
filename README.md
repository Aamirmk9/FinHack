# ShadowTrace

**AI-Powered Money Laundering Network Detection**

Built for FinHack 2026 — Case 1: Detecting Autonomous AI Money Laundering Networks

---

## Overview

ShadowTrace is a prototype detection platform that helps financial intelligence units identify suspicious blockchain transaction networks involved in money laundering. It combines graph analytics, community detection, rule-based heuristics, and machine learning into a hybrid detection engine — surfaced through an interactive investigation dashboard.

### Key Results

| Approach | Precision | Recall | F1 Score |
|----------|-----------|--------|----------|
| Rule-Based Only | 1.9% | 33.8% | 3.5% |
| ML Only | 99.3% | 99.3% | 99.3% |
| **Hybrid (Ours)** | **97.9%** | **98.6%** | **98.3%** |

The hybrid approach catches more laundering patterns than rules alone while maintaining far fewer false positives than either method independently.

---

## Architecture

```
                        +-------------------+
                        |   React Frontend  |
                        | (Vite + Tailwind) |
                        +--------+----------+
                                 |
                            REST API
                                 |
                        +--------+----------+
                        |  FastAPI Backend   |
                        +--------+----------+
                                 |
              +------------------+------------------+
              |                  |                   |
     +--------+------+  +-------+-------+  +--------+--------+
     | Data Generator |  | Graph Engine  |  | Detection Engine |
     | (5 patterns)   |  | (NetworkX +   |  | (Rules + Random  |
     |                |  |  Louvain)     |  |  Forest Hybrid)  |
     +----------------+  +---------------+  +-----------------+
```

### Detection Pipeline

1. **Synthetic Data Generation** — 50K+ transactions across 3K+ wallets with 5 embedded laundering patterns
2. **Graph Construction** — Directed graph with per-node and per-edge features
3. **Community Detection** — Louvain algorithm identifies wallet clusters
4. **Feature Engineering** — 10 node-level and 8 cluster-level features
5. **Hybrid Detection** — Rule-based flags + Random Forest classifier combined into a 0-100 risk score
6. **Cluster Risk Scoring** — Aggregate scores with explainability tags

### Laundering Patterns Detected

- **Layering** — Funds split across intermediaries then merged at destination
- **Structuring** — Transactions kept just below the $10K reporting threshold
- **Round-Tripping** — Funds circling back to near-origin through a chain of wallets
- **Rapid Relay** — Funds moving through 8+ wallets in under 1 hour
- **Fan-Out / Fan-In** — One source disperses to 20+ wallets, then converges to 1-2 collectors

---

## Dashboard

### Pages

- **Dashboard** — Overview stats, risk distribution chart, model comparison (rule vs ML vs hybrid), alert feed
- **Network Explorer** — Interactive force-directed graph with color-coded risk nodes, click-to-inspect wallet details, score breakdown
- **Investigation Panel** — Cluster deep-dive with explainability ("Why is this suspicious?"), wallet risk bar chart, full transaction table
- **Timeline** — Animated playback of fund flows within a cluster, cumulative volume chart, transaction-by-transaction walkthrough

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Python 3.14, FastAPI, uvicorn |
| Graph Analytics | NetworkX, python-louvain |
| Machine Learning | scikit-learn (Random Forest) |
| Data | pandas, numpy |
| Frontend | React 18, Vite, Tailwind CSS |
| Graph Visualization | react-force-graph-2d |
| Charts | Recharts |
| API Client | Axios |

---

## Getting Started

### Prerequisites

- Python 3.11+
- Node.js 18+

### Backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --port 8000
```

The detection pipeline runs automatically on startup (~16 seconds). You'll see progress output in the terminal.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

---

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/stats` | Dashboard summary (totals, risk counts, ML metrics) |
| `GET /api/network?min_score=0&max_nodes=500` | Graph data for visualization |
| `GET /api/alerts?limit=20` | Top suspicious clusters ranked by risk |
| `GET /api/cluster/{id}` | Cluster investigation detail with transactions |
| `GET /api/wallet/{address}` | Single wallet deep-dive |
| `GET /api/timeline/{cluster_id}` | Temporal transaction data for a cluster |
| `GET /api/compare` | Rule-based vs ML vs hybrid performance comparison |

---

## Tests

```bash
cd backend
source venv/bin/activate
python -m pytest tests/ -v
```

12 tests covering data generation, graph construction, community detection, feature engineering, detection engine, and API endpoints.

---

## Team

FinHack 2026 — UTD JSOM Finance Lab
