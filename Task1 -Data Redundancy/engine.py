"""
NimbusCloud Suite — Task 1: Data Redundancy Removal System
Validation & Decision Engine.

This is the heart of the system described in the architecture brief:

    Data input -> Validation engine (hash + fuzzy matching) -> Decision engine
    (unique / duplicate / false positive) -> Cloud database / False positive log

Design notes
------------
* Records are schema-agnostic dicts (CSV columns can be anything). Each
  record is normalized into a single "key string" by concatenating the
  chosen key fields (or all fields, if none are chosen), lower-cased and
  stripped of incidental whitespace, so that formatting differences alone
  never cause false mismatches.

* Stage 1 — Exact check: SHA-256 of the normalized key string is compared
  against every existing record's stored hash. A hit is a 100%-confidence
  exact duplicate and is auto-rejected without needing human review.

* Stage 2 — Fuzzy check: if no exact hash hit, RapidFuzz's token-sort-ratio
  is used to find the best-matching existing record. Token-sort-ratio is
  resilient to word order (e.g. "Doe, John" vs "John Doe") and small typos.
  If the best score clears the adjustable similarity threshold, the record
  is flagged as a *near duplicate* pending human review rather than being
  silently dropped or silently added — this is what prevents both data
  pollution AND accidental data loss.

* Everything below the threshold, with no exact hash hit, is classified
  unique and is safe to append to the cloud database directly.
"""

import hashlib
import json
from rapidfuzz import fuzz, process


def normalize_record(record: dict, key_fields=None) -> str:
    """Builds a stable, comparison-ready string from a record dict."""
    if key_fields:
        values = [str(record.get(f, "")).strip().lower() for f in key_fields]
    else:
        # Use all fields, in a stable (sorted-by-key) order so that dict
        # ordering differences never affect the hash.
        values = [str(record[k]).strip().lower() for k in sorted(record.keys())]
    # Collapse internal whitespace so "John  Doe" == "John Doe"
    values = [" ".join(v.split()) for v in values]
    return "|".join(values)


def compute_hash(key_string: str) -> str:
    return hashlib.sha256(key_string.encode("utf-8")).hexdigest()


class ValidationEngine:
    """
    Wraps the matching logic against an in-memory index of existing records
    so a whole CSV batch can be validated efficiently without re-querying
    the database for every single row.
    """

    def __init__(self, existing_index):
        """
        existing_index: list of dicts, each with keys:
            'id', 'hash', 'key_string'
        representing every currently-unique record in the cloud database.
        This list is mutated in place as new unique records are accepted,
        so duplicates *within* the same upload batch are also caught.
        """
        self.index = existing_index
        self.hash_lookup = {row["hash"]: row["id"] for row in existing_index}

    def evaluate(self, record: dict, key_fields, threshold: float) -> dict:
        key_string = normalize_record(record, key_fields)
        record_hash = compute_hash(key_string)

        # --- Stage 1: exact duplicate check (O(1) hash lookup) ---
        if record_hash in self.hash_lookup:
            return {
                "decision": "duplicate",
                "match_type": "exact_duplicate",
                "matched_id": self.hash_lookup[record_hash],
                "similarity": 100.0,
                "hash": record_hash,
                "key_string": key_string,
            }

        # --- Stage 2: fuzzy near-duplicate check ---
        best_score = 0.0
        best_id = None
        if self.index:
            choices = {row["id"]: row["key_string"] for row in self.index}
            match = process.extractOne(
                key_string, choices, scorer=fuzz.token_sort_ratio
            )
            if match is not None:
                _, best_score, best_id = match

        if best_score >= threshold:
            return {
                "decision": "possible_duplicate",
                "match_type": "near_duplicate",
                "matched_id": best_id,
                "similarity": float(best_score),
                "hash": record_hash,
                "key_string": key_string,
            }

        return {
            "decision": "unique",
            "match_type": None,
            "matched_id": None,
            "similarity": float(best_score),
            "hash": record_hash,
            "key_string": key_string,
        }

    def register_unique(self, new_id: int, record_hash: str, key_string: str):
        """Call after a record is accepted, so later rows in the same
        batch are validated against it too."""
        self.index.append({"id": new_id, "hash": record_hash, "key_string": key_string})
        self.hash_lookup[record_hash] = new_id
