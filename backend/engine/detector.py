"""Hybrid detection engine: rule-based flags + Random Forest classifier."""

from collections import defaultdict
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report
import networkx as nx


class RuleBasedDetector:
    def detect(self, G, transactions, node_features):
        flags = defaultdict(list)
        for node, feats in node_features.items():
            node_txns = transactions[
                (transactions["from_address"] == node) | (transactions["to_address"] == node)
            ]
            if len(node_txns) > 0:
                amounts = node_txns["amount"].values
                near_threshold = np.sum((amounts >= 8500) & (amounts <= 9999))
                if near_threshold >= 5:
                    flags[node].append("structuring_detected")

            if feats["activity_burst_score"] > 5.0:
                flags[node].append("rapid_fund_relay")
            if feats["out_degree"] > 15:
                flags[node].append("fan_out_pattern")
            if feats["in_degree"] > 15:
                flags[node].append("fan_in_pattern")

            if feats["total_sent"] > 10000 and feats["total_received"] > 10000:
                ratio = min(feats["total_sent"], feats["total_received"]) / max(feats["total_sent"], feats["total_received"])
                if ratio > 0.85:
                    flags[node].append("pass_through_behavior")

            predecessors = set(G.predecessors(node))
            successors = set(G.successors(node))
            bidirectional = predecessors & successors
            if len(bidirectional) >= 2:
                flags[node].append("circular_flow_detected")

        return dict(flags)


class MLDetector:
    def __init__(self):
        self.model = RandomForestClassifier(n_estimators=100, max_depth=10, random_state=42, class_weight="balanced")
        self.feature_names = [
            "in_degree", "out_degree", "total_sent", "total_received",
            "tx_count", "avg_tx_size", "in_out_ratio", "activity_burst_score", "active_hours",
        ]
        self.metrics = {}

    def train(self, node_features, labels):
        X, y = [], []
        for addr, feats in node_features.items():
            if addr in labels:
                X.append([feats[f] for f in self.feature_names])
                y.append(1 if labels[addr] == "suspicious" else 0)

        X, y = np.array(X), np.array(y)
        n_suspicious = int(y.sum())
        n_legitimate = len(y) - n_suspicious

        if n_suspicious < 20 or n_legitimate < 20:
            print(f"       ML skipped: insufficient labels ({n_suspicious} suspicious, {n_legitimate} legitimate)")
            self.metrics = {"precision": 0, "recall": 0, "f1": 0, "accuracy": 0, "skipped": True}
            self._skipped = True
            return self.metrics

        self._skipped = False
        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.3, random_state=42, stratify=y)
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

    def predict_proba(self, node_features):
        results = {}
        for addr, feats in node_features.items():
            feature_vec = np.array([[feats[f] for f in self.feature_names]])
            proba = self.model.predict_proba(feature_vec)[0]
            results[addr] = round(float(proba[1]) if len(proba) > 1 else 0.0, 4)
        return results


class HybridDetector:
    def __init__(self):
        self.rule_detector = RuleBasedDetector()
        self.ml_detector = MLDetector()

    def run(self, G, transactions, node_features, cluster_features, labels):
        rule_flags = self.rule_detector.detect(G, transactions, node_features)
        self.ml_detector.train(node_features, labels)
        ml_probas = self.ml_detector.predict_proba(node_features) if not getattr(self.ml_detector, '_skipped', False) else {}

        results = {}
        for addr in node_features:
            flags = rule_flags.get(addr, [])
            ml_prob = ml_probas.get(addr, 0.0)
            rule_score = min(len(flags) * 12, 50)
            ml_score = ml_prob * 50
            composite = min(round(rule_score + ml_score, 1), 100)

            results[addr] = {
                "score": composite, "rule_score": rule_score,
                "ml_score": round(ml_score, 1), "ml_probability": ml_prob,
                "flags": flags, "n_flags": len(flags),
            }
        return results

    @property
    def ml_metrics(self):
        return self.ml_detector.metrics
