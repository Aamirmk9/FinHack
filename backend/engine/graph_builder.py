"""Build a NetworkX directed multigraph from transaction data."""

from collections import defaultdict
import networkx as nx
import pandas as pd


def build_graph(transactions: pd.DataFrame) -> nx.DiGraph:
    G = nx.DiGraph()
    edge_data = defaultdict(list)
    node_sent = defaultdict(float)
    node_received = defaultdict(float)
    node_tx_count = defaultdict(int)
    node_first = {}
    node_last = {}

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

    for (sender, receiver), txn_list in edge_data.items():
        amounts = [t["amount"] for t in txn_list]
        timestamps = [t["timestamp"] for t in txn_list]
        first_tx = min(timestamps)
        last_tx = max(timestamps)
        time_span = (last_tx - first_tx).total_seconds() / 3600

        G.add_edge(
            sender, receiver,
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
