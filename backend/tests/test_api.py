import pytest
from fastapi.testclient import TestClient
from main import app


@pytest.fixture(scope="module")
def client():
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
