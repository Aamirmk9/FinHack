# FinHack 2026 - Case 1: "ShadowTrace" - AI Money Laundering Network Detection

## Context
Competing in FinHack 2026 (UTD JSOM Finance Lab hackathon). Team of 4-5, ~24 hours to build. All 5 judging criteria weighted equally at 20%: **Innovation, User Experience, Presentation, Feasibility, Effectiveness**. The goal is to build a prototype that helps a government financial intelligence unit detect suspicious blockchain transaction networks involved in AI-driven money laundering.

---

## Architecture

```
ShadowTrace/
├── backend/                    # Python FastAPI
│   ├── main.py                 # API server
│   ├── data/
│   │   └── generator.py        # Synthetic blockchain transaction generator
│   ├── engine/
│   │   ├── graph_builder.py    # NetworkX graph construction
│   │   ├── features.py         # Feature engineering (node + edge + cluster)
│   │   ├── detector.py         # ML model (Random Forest + rule-based hybrid)
│   │   ├── community.py        # Louvain community detection
│   │   └── risk_scorer.py      # Composite risk scoring
│   └── api/
│       └── routes.py           # REST endpoints
├── frontend/                   # React + Vite + Tailwind
│   ├── src/
│   │   ├── components/
│   │   │   ├── NetworkGraph.jsx      # Force-directed graph (react-force-graph)
│   │   │   ├── Dashboard.jsx         # Overview stats + alert feed
│   │   │   ├── InvestigationPanel.jsx # Drill-down on flagged clusters
│   │   │   ├── Timeline.jsx          # Temporal fund flow animation
│   │   │   ├── RiskHeatmap.jsx       # Risk distribution visualization
│   │   │   └── AlertFeed.jsx         # Live suspicious activity feed
│   │   └── App.jsx
│   └── ...
└── data/                       # Generated datasets
```

---

## Implementation Plan

### Phase 1: Data Foundation (~2 hours)
**Files:** `backend/data/generator.py`

Generate realistic synthetic blockchain data with **embedded laundering patterns**:
- **Legitimate transactions** (~85%): Random wallet-to-wallet, realistic amounts, varied timing
- **Layering pattern**: Source wallet → many intermediaries → destination (split + merge)
- **Structuring**: Transactions just below $10K threshold, regular intervals
- **Round-tripping**: Funds circling back to near-origin through 5-10 hops
- **Fan-out/Fan-in**: One wallet → 20+ wallets → reconverge to 1-2 wallets
- **Rapid relay**: Funds moving through 8+ wallets in < 1 hour
- **Dormant activation**: Long-idle wallets suddenly bursting with activity

Output: ~50K-100K transactions across ~5K wallets with ground-truth labels.

### Phase 2: Detection Engine (~3 hours)
**Files:** `backend/engine/graph_builder.py`, `features.py`, `community.py`, `detector.py`, `risk_scorer.py`

1. **Graph Construction** (NetworkX): Wallets as nodes, transactions as weighted/timed edges
2. **Community Detection** (Louvain algorithm): Identify wallet clusters acting in concert
3. **Feature Engineering** (per-node, per-edge, per-cluster):
   - Node: in/out degree, volume, avg transaction size, activity burst score, dormancy ratio
   - Edge: transaction frequency, amount variance, time regularity, bidirectionality
   - Cluster: density, diameter, flow-through ratio, fan-out/fan-in ratio, temporal compactness
4. **Hybrid Detection**:
   - Rule-based flags (structuring threshold, rapid relay, round-trip detection)
   - Random Forest classifier on engineered features
   - Ensemble score combining both
5. **Risk Scoring**: 0-100 composite score per wallet and per cluster, with explainability tags (e.g., "structuring detected", "rapid fund relay", "fan-out pattern")

### Phase 3: API Layer (~1 hour)
**Files:** `backend/main.py`, `backend/api/routes.py`

FastAPI endpoints:
- `GET /api/network` — full graph data (nodes + edges with risk scores)
- `GET /api/alerts` — top flagged clusters with risk scores and explanations
- `GET /api/cluster/{id}` — detailed cluster investigation data
- `GET /api/wallet/{address}` — single wallet deep-dive
- `GET /api/timeline/{cluster_id}` — temporal fund flow for a cluster
- `GET /api/stats` — dashboard summary statistics
- `GET /api/compare` — rule-based vs ML performance comparison

### Phase 4: Frontend Dashboard (~6 hours)
**Files:** `frontend/src/**`

Dark-themed, professional financial UI (Tailwind + custom design tokens).

**4 main views:**

1. **Overview Dashboard**
   - Total wallets monitored, transactions analyzed, alerts generated
   - Risk distribution chart (pie/bar)
   - Top 5 suspicious clusters with quick-view cards
   - Live alert feed sidebar
   - Model performance metrics (precision, recall, F1)

2. **Network Explorer** (the showstopper)
   - Interactive force-directed graph (react-force-graph-3d or 2d)
   - Nodes colored by risk score (green → yellow → red)
   - Node size by transaction volume
   - Click node → side panel with wallet details
   - Click cluster → highlight all connected nodes
   - Zoom, pan, filter by risk level
   - Toggle between full network and suspicious-only view

3. **Investigation Panel**
   - Select a flagged cluster → see full transaction flow diagram
   - Sankey diagram showing fund flow through the cluster
   - Explainability panel: "Why is this suspicious?" with tagged reasons
   - Transaction table with timestamps, amounts, risk flags
   - "Generate Report" button → LLM-generated investigation summary

4. **Timeline View**
   - Animated timeline showing how a laundering network evolved
   - Scrub bar to see network state at any point in time
   - Highlight moments of peak suspicious activity

### Phase 5: Integration & Polish (~2 hours)
- Connect frontend to backend API
- End-to-end testing with generated data
- Loading states, error handling, responsive design
- Performance optimization for graph rendering
- Add sample investigation walkthrough (guided demo mode)

---

## Tech Stack
| Layer | Technology |
|-------|-----------|
| Backend | Python 3.11+, FastAPI, uvicorn |
| Graph Analytics | NetworkX, python-louvain |
| ML | scikit-learn (Random Forest), numpy, pandas |
| Frontend | React 18, Vite, Tailwind CSS |
| Graph Viz | react-force-graph-2d (or 3d for extra wow) |
| Charts | Recharts |
| API Communication | Axios |

---

## What Wins Each Category

| Criteria (20% each) | How We Win |
|---|---|
| **Innovation** | Hybrid GNN-inspired detection + explainable AI + temporal pattern analysis. Not just rules, not just ML — both combined with graph-structural features. LLM-generated investigation reports. |
| **User Experience** | Interactive 3D/2D network graph that judges can click through. Dark professional theme. Guided investigation flow. One-click report generation. |
| **Presentation** | Live demo of catching a synthetic laundering ring. Start with "Every year, $800B+ is laundered globally..." → show the problem → demo the solution → show the investigation → quantify impact. |
| **Feasibility** | Everything runs locally. Python + React. Standard libraries. Synthetic data included. Could be deployed with real blockchain API integration. |
| **Effectiveness** | Show precision/recall/F1 metrics. Compare rule-only vs ML-only vs hybrid. Demonstrate catching patterns that rules alone miss. Show false positive reduction. |

---

## Team Role Allocation
- **Person 1-2**: Presentation deck + script + practice delivery
- **Person 3**: Research real money laundering case studies for the presentation narrative
- **Person 4**: Test the dashboard, find UX issues, prepare demo script
- **Everyone**: Final rehearsal of live demo + presentation

---

## Verification & Demo Plan
1. Start backend: `cd backend && uvicorn main:app --reload`
2. Start frontend: `cd frontend && npm run dev`
3. Verify: dashboard loads with stats → network graph renders → click wallet → see details → click cluster → see investigation → timeline animates
4. Demo script: Overview → zoom into suspicious cluster → investigate → show explainability → generate report → show metrics comparison
