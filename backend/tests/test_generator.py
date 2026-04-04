import pytest
from data.generator import generate_dataset


def test_generate_dataset_returns_transactions_and_labels():
    transactions, labels = generate_dataset(
        n_wallets=200, n_legitimate_txns=500, n_laundering_rings=3, seed=42
    )
    assert len(transactions) > 500
    assert "tx_hash" in transactions.columns
    assert "from_address" in transactions.columns
    assert "to_address" in transactions.columns
    assert "amount" in transactions.columns
    assert "timestamp" in transactions.columns
    assert isinstance(labels, dict)
    suspicious_count = sum(1 for v in labels.values() if v == "suspicious")
    assert suspicious_count > 0
    assert suspicious_count < len(labels)


def test_laundering_patterns_are_embedded():
    transactions, labels = generate_dataset(
        n_wallets=200, n_legitimate_txns=500, n_laundering_rings=3, seed=42
    )
    suspicious_wallets = {k for k, v in labels.items() if v == "suspicious"}
    txn_wallets = set(transactions["from_address"]) | set(transactions["to_address"])
    assert suspicious_wallets.issubset(txn_wallets)
    assert "pattern_type" in transactions.columns
    patterns = set(transactions["pattern_type"].dropna().unique())
    assert len(patterns) >= 2
