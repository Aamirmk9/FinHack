"""Fetch real Ethereum blockchain transactions from Blockscout public API."""

import json
import os
import time
from datetime import datetime
from pathlib import Path

import httpx
import numpy as np
import pandas as pd

from engine.known_actors import LAZARUS_GROUP_ADDRESSES

BLOCKSCOUT_BASE = "https://eth.blockscout.com/api/v2"

# OFAC-sanctioned and exploit-linked addresses with active transaction history
SUSPICIOUS_SEED_ADDRESSES = {
    "0xd90e2f925DA726b50C4Ed8D0Fb90Ad053324F31b",  # Tornado Cash Router
    "0x722122dF12D4e14e13Ac3b6895a86e84145b6967",  # Tornado Cash Proxy
    "0xDD4c48C0B24039969fC16D1cdF626eaB821d3384",  # Tornado Cash 100 ETH pool
    "0x910Cbd523D972eb0a6f4cAe4618aD62622b39DbF",  # Ronin Bridge Exploiter
    "0xba214c1c1928a32Bffe790263E38B4Af9bFCD659",  # Multichain exploiter
    "0x098B716B8Aaf21512996dC57EB0615e2383E2f96",  # Ronin bridge hacker 2
    "0xA7e4Fecddc20D83f36971b67e13F1ABC98Dfcfa6",  # Wintermute exploiter
    "0x3Cffd56B47B7b41c56258D9C7731ABaDc360E073",  # Wormhole exploiter
    "0x23b6fCc2Da6B1be0F23B9918acE4477efeacab59",  # KuCoin hacker
    "0xb541fc07bC7619fD4062A54d96268525cBC6FfEF",  # Upbit hacker (Lazarus-linked)
}

# Known legitimate addresses (exchanges, protocols, well-known wallets)
LEGITIMATE_SEED_ADDRESSES = {
    "0xE592427A0AEce92De3Edee1F18E0157C05861564",  # Uniswap V3 Router
    "0x71660c4005BA85c37ccec55d0C4493E66Fe775d3",  # Coinbase hot wallet
    "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",  # Vitalik.eth
    "0x28C6c06298d514Db089934071355E5743bf21d60",  # Binance hot wallet
    "0xDFd5293D8e347dFe59E90eFd55b2956a1343963d",  # Binance hot wallet 2
    "0x56Eddb7aa87536c09CCc2793473599fD21A8b17F",  # Binance 16
    "0x21a31Ee1afC51d94C2eFcCAa2092aD1028285549",  # Binance 15
    "0x3f5CE5FBFe3E9af3971dD833D26bA9b5C936f0bE",  # Binance 1
    "0xF977814e90dA44bFA03b6295A0616a897441aceC",  # Binance 8
    "0x267be1C1D684F78cb4F6a176C4911b741E4Ffdc0",  # Kraken 4
}

CACHE_DIR = Path(__file__).parent / "cache"
CACHE_TXN_FILE = CACHE_DIR / "ethereum_txns.parquet"
CACHE_LABELS_FILE = CACHE_DIR / "ethereum_labels.json"


def _normalize_address(addr: str) -> str:
    return addr.lower().strip() if addr else ""


def fetch_address_transactions(address: str, max_pages: int = 5) -> list[dict]:
    """Fetch transactions for an address from Blockscout API."""
    txns = []
    url = f"{BLOCKSCOUT_BASE}/addresses/{address}/transactions"
    params = {}

    with httpx.Client(timeout=30) as client:
        for _ in range(max_pages):
            try:
                resp = client.get(url, params=params)
                resp.raise_for_status()
                data = resp.json()
            except (httpx.HTTPError, json.JSONDecodeError) as e:
                print(f"       API error for {address[:10]}...: {e}")
                break

            items = data.get("items", [])
            if not items:
                break
            txns.extend(items)

            next_page = data.get("next_page_params")
            if not next_page:
                break
            params = next_page
            time.sleep(0.5)

    return txns


def normalize_transaction(raw_tx: dict) -> dict | None:
    """Convert Blockscout API response to project schema."""
    try:
        from_addr = raw_tx.get("from", {})
        to_addr = raw_tx.get("to", {})

        if not from_addr or not to_addr:
            return None
        if isinstance(from_addr, dict):
            from_addr = from_addr.get("hash", "")
        if isinstance(to_addr, dict):
            to_addr = to_addr.get("hash", "")
        if not from_addr or not to_addr:
            return None

        value_wei = int(raw_tx.get("value", "0"))
        amount = round(value_wei / 1e18, 6)
        if amount <= 0:
            return None

        ts_str = raw_tx.get("timestamp") or raw_tx.get("block", {}).get("timestamp", "")
        if ts_str:
            timestamp = datetime.fromisoformat(ts_str.replace("Z", "+00:00"))
        else:
            return None

        return {
            "tx_hash": raw_tx.get("hash", ""),
            "from_address": _normalize_address(from_addr),
            "to_address": _normalize_address(to_addr),
            "amount": amount,
            "timestamp": timestamp,
            "pattern_type": None,
        }
    except (ValueError, KeyError, TypeError):
        return None


def _build_labels(df: pd.DataFrame, suspicious_seeds: set, legitimate_seeds: set) -> dict[str, str]:
    """Build tiered labels from seed addresses and transaction graph."""
    labels = {}
    sus_lower = {_normalize_address(a) for a in suspicious_seeds}
    legit_lower = {_normalize_address(a) for a in legitimate_seeds}

    all_addrs = set(df["from_address"].unique()) | set(df["to_address"].unique())

    # Tier 1: direct seed labels
    for addr in all_addrs:
        if addr in sus_lower:
            labels[addr] = "suspicious"
        elif addr in legit_lower:
            labels[addr] = "legitimate"

    # Tier 2: proximity labels
    # Addresses that ONLY transact with suspicious seeds -> suspicious
    sus_counterparties = set()
    for _, row in df.iterrows():
        if row["from_address"] in sus_lower:
            sus_counterparties.add(row["to_address"])
        if row["to_address"] in sus_lower:
            sus_counterparties.add(row["from_address"])

    legit_counterparties = set()
    for _, row in df.iterrows():
        if row["from_address"] in legit_lower:
            legit_counterparties.add(row["to_address"])
        if row["to_address"] in legit_lower:
            legit_counterparties.add(row["from_address"])

    for addr in sus_counterparties:
        if addr not in labels:
            labels[addr] = "suspicious"

    for addr in legit_counterparties:
        if addr not in labels:
            labels[addr] = "legitimate"

    # All remaining addresses default to legitimate (they're unlabeled background)
    for addr in all_addrs:
        if addr not in labels:
            labels[addr] = "legitimate"

    return labels


def save_cache(df: pd.DataFrame, labels: dict):
    """Save fetched data to disk cache."""
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    df.to_parquet(CACHE_TXN_FILE, index=False)
    with open(CACHE_LABELS_FILE, "w") as f:
        json.dump(labels, f)
    print(f"       Cached {len(df)} transactions to {CACHE_TXN_FILE}")


def load_cached_dataset() -> tuple[pd.DataFrame, dict] | None:
    """Load cached dataset if it exists."""
    if CACHE_TXN_FILE.exists() and CACHE_LABELS_FILE.exists():
        df = pd.read_parquet(CACHE_TXN_FILE)
        with open(CACHE_LABELS_FILE) as f:
            labels = json.load(f)
        print(f"       Loaded {len(df)} transactions from cache")
        return df, labels
    return None


def fetch_ethereum_dataset(
    n_suspicious: int = 10,
    n_legitimate: int = 10,
    max_txns_per_address: int = 200,
) -> tuple[pd.DataFrame, dict[str, str]]:
    """Fetch real Ethereum transactions and build labeled dataset.

    Returns (DataFrame, labels_dict) matching generate_dataset() signature.
    """
    suspicious_seeds = list(SUSPICIOUS_SEED_ADDRESSES)[:n_suspicious]
    legitimate_seeds = list(LEGITIMATE_SEED_ADDRESSES)[:n_legitimate]

    all_raw_txns = []
    max_pages = max(1, max_txns_per_address // 50)

    # Fetch suspicious address transactions
    print(f"       Fetching transactions for {len(suspicious_seeds)} suspicious addresses...")
    for i, addr in enumerate(suspicious_seeds):
        print(f"       [{i+1}/{len(suspicious_seeds)}] {addr[:10]}...")
        raw = fetch_address_transactions(addr, max_pages=max_pages)
        all_raw_txns.extend(raw)
        print(f"         -> {len(raw)} raw transactions")

    # Fetch legitimate address transactions
    print(f"       Fetching transactions for {len(legitimate_seeds)} legitimate addresses...")
    for i, addr in enumerate(legitimate_seeds):
        print(f"       [{i+1}/{len(legitimate_seeds)}] {addr[:10]}...")
        raw = fetch_address_transactions(addr, max_pages=max_pages)
        all_raw_txns.extend(raw)
        print(f"         -> {len(raw)} raw transactions")

    # Normalize and deduplicate
    print(f"       Normalizing {len(all_raw_txns)} raw transactions...")
    normalized = []
    seen_hashes = set()
    for raw in all_raw_txns:
        tx = normalize_transaction(raw)
        if tx and tx["tx_hash"] not in seen_hashes:
            seen_hashes.add(tx["tx_hash"])
            normalized.append(tx)

    if not normalized:
        raise RuntimeError("No transactions fetched from Blockscout API. Check network connectivity.")

    df = pd.DataFrame(normalized)
    df = df.sort_values("timestamp").reset_index(drop=True)

    # Build labels
    labels = _build_labels(df, set(suspicious_seeds), set(legitimate_seeds))

    print(f"       {len(df)} unique transactions, {len(labels)} labeled addresses")
    print(f"       Suspicious: {sum(1 for v in labels.values() if v == 'suspicious')}")
    print(f"       Legitimate: {sum(1 for v in labels.values() if v == 'legitimate')}")

    # Cache for next startup
    save_cache(df, labels)

    return df, labels
