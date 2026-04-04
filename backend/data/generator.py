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
    txns = []
    for _ in range(n_txns):
        sender, receiver = random.sample(wallets, 2)
        amount = round(random.lognormvariate(6, 2), 2)
        amount = min(amount, 500_000)
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


def _generate_layering(ring_id: int, start: datetime) -> tuple[list[dict], list[str]]:
    source = _make_address(f"layer_src_{ring_id}", 0)
    dest = _make_address(f"layer_dst_{ring_id}", 0)
    intermediaries = [_make_address(f"layer_mid_{ring_id}", i) for i in range(random.randint(6, 12))]
    total_amount = random.uniform(50_000, 200_000)
    txns = []
    t = start + timedelta(hours=random.randint(0, 48))

    splits = np.random.dirichlet(np.ones(len(intermediaries))) * total_amount
    for mid, amt in zip(intermediaries, splits):
        t += timedelta(minutes=random.randint(1, 15))
        txns.append({
            "tx_hash": _make_tx_hash(), "from_address": source, "to_address": mid,
            "amount": round(float(amt), 2), "timestamp": t, "pattern_type": "layering",
        })

    for _ in range(len(intermediaries) // 2):
        a, b = random.sample(intermediaries, 2)
        t += timedelta(minutes=random.randint(5, 30))
        txns.append({
            "tx_hash": _make_tx_hash(), "from_address": a, "to_address": b,
            "amount": round(random.uniform(1000, 20000), 2), "timestamp": t, "pattern_type": "layering",
        })

    for mid in intermediaries:
        t += timedelta(minutes=random.randint(1, 20))
        txns.append({
            "tx_hash": _make_tx_hash(), "from_address": mid, "to_address": dest,
            "amount": round(random.uniform(2000, 30000), 2), "timestamp": t, "pattern_type": "layering",
        })

    return txns, [source, dest] + intermediaries


def _generate_structuring(ring_id: int, start: datetime) -> tuple[list[dict], list[str]]:
    source = _make_address(f"struct_src_{ring_id}", 0)
    destinations = [_make_address(f"struct_dst_{ring_id}", i) for i in range(random.randint(5, 10))]
    txns = []
    t = start + timedelta(hours=random.randint(0, 72))

    for _ in range(random.randint(15, 30)):
        dest = random.choice(destinations)
        amount = round(random.uniform(8500, 9999), 2)
        t += timedelta(hours=random.randint(4, 24))
        txns.append({
            "tx_hash": _make_tx_hash(), "from_address": source, "to_address": dest,
            "amount": amount, "timestamp": t, "pattern_type": "structuring",
        })

    return txns, [source] + destinations


def _generate_round_tripping(ring_id: int, start: datetime) -> tuple[list[dict], list[str]]:
    chain_len = random.randint(5, 10)
    wallets = [_make_address(f"round_{ring_id}", i) for i in range(chain_len)]
    txns = []
    t = start + timedelta(hours=random.randint(0, 48))
    amount = random.uniform(20_000, 100_000)

    for i in range(chain_len):
        sender = wallets[i]
        receiver = wallets[(i + 1) % chain_len]
        t += timedelta(minutes=random.randint(10, 60))
        txn_amount = round(amount * random.uniform(0.95, 1.0), 2)
        txns.append({
            "tx_hash": _make_tx_hash(), "from_address": sender, "to_address": receiver,
            "amount": txn_amount, "timestamp": t, "pattern_type": "round_tripping",
        })

    return txns, wallets


def _generate_rapid_relay(ring_id: int, start: datetime) -> tuple[list[dict], list[str]]:
    chain_len = random.randint(8, 15)
    wallets = [_make_address(f"rapid_{ring_id}", i) for i in range(chain_len)]
    txns = []
    t = start + timedelta(hours=random.randint(0, 96))
    amount = random.uniform(10_000, 80_000)

    for i in range(chain_len - 1):
        t += timedelta(seconds=random.randint(15, 180))
        txns.append({
            "tx_hash": _make_tx_hash(), "from_address": wallets[i], "to_address": wallets[i + 1],
            "amount": round(amount * random.uniform(0.98, 1.0), 2), "timestamp": t, "pattern_type": "rapid_relay",
        })

    return txns, wallets


def _generate_fan_out_fan_in(ring_id: int, start: datetime) -> tuple[list[dict], list[str]]:
    source = _make_address(f"fan_src_{ring_id}", 0)
    collectors = [_make_address(f"fan_collect_{ring_id}", i) for i in range(2)]
    middles = [_make_address(f"fan_mid_{ring_id}", i) for i in range(random.randint(15, 25))]
    txns = []
    t = start + timedelta(hours=random.randint(0, 48))
    total = random.uniform(100_000, 500_000)
    splits = np.random.dirichlet(np.ones(len(middles))) * total

    for mid, amt in zip(middles, splits):
        t += timedelta(minutes=random.randint(1, 10))
        txns.append({
            "tx_hash": _make_tx_hash(), "from_address": source, "to_address": mid,
            "amount": round(float(amt), 2), "timestamp": t, "pattern_type": "fan_out_fan_in",
        })

    t += timedelta(hours=random.randint(2, 12))
    for mid in middles:
        collector = random.choice(collectors)
        t += timedelta(minutes=random.randint(1, 10))
        txns.append({
            "tx_hash": _make_tx_hash(), "from_address": mid, "to_address": collector,
            "amount": round(random.uniform(2000, 30000), 2), "timestamp": t, "pattern_type": "fan_out_fan_in",
        })

    return txns, [source] + collectors + middles


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
    random.seed(seed)
    np.random.seed(seed)

    start_date = datetime(2025, 1, 1)
    end_date = datetime(2025, 12, 31)

    legit_wallets = [_make_address("legit", i) for i in range(n_wallets)]
    labels = {w: "legitimate" for w in legit_wallets}

    all_txns = _generate_legitimate_transactions(legit_wallets, n_legitimate_txns, start_date, end_date)

    for ring_id in range(n_laundering_rings):
        gen_fn = _PATTERN_GENERATORS[ring_id % len(_PATTERN_GENERATORS)]
        txns, suspicious_wallets = gen_fn(ring_id, start_date)
        all_txns.extend(txns)
        for w in suspicious_wallets:
            labels[w] = "suspicious"

    suspicious_list = [w for w, l in labels.items() if l == "suspicious"]
    for _ in range(len(suspicious_list) * 2):
        s = random.choice(suspicious_list)
        l = random.choice(legit_wallets)
        if random.random() < 0.5:
            sender, receiver = s, l
        else:
            sender, receiver = l, s
        all_txns.append({
            "tx_hash": _make_tx_hash(), "from_address": sender, "to_address": receiver,
            "amount": round(random.lognormvariate(5, 2), 2),
            "timestamp": _random_timestamp(start_date, end_date), "pattern_type": None,
        })

    df = pd.DataFrame(all_txns)
    df = df.sort_values("timestamp").reset_index(drop=True)
    return df, labels
