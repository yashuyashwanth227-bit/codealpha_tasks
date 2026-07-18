"""
NimbusCloud Suite — Task 1: Data Redundancy Removal System
================================================================
CodeAlpha Internship

A self-contained Flask application implementing:
  - A validation engine (SHA-256 exact match + RapidFuzz fuzzy matching)
  - A decision engine that classifies incoming data as unique / duplicate /
    possible-duplicate (false-positive candidate)
  - A cloud database (SQLite by default, PostgreSQL-ready) that only ever
    receives unique, verified entries
  - A false-positive review queue with restore capability
  - A full activity log
  - A JSON API consumed by the dashboard UI in templates/index.html

Run with:  python app.py
Then open: http://127.0.0.1:5000
"""

import csv
import io
import json
from datetime import datetime, timedelta, timezone

from flask import Flask, request, jsonify, render_template, send_file, send_from_directory

from config import Config
from models import (
    db, Record, FlaggedRecord, ActivityLog,
    log_activity, get_setting, set_setting, utcnow,
)
from engine import ValidationEngine

app = Flask(__name__)
app.config.from_object(Config)
db.init_app(app)

with app.app_context():
    db.create_all()
    if get_setting("similarity_threshold") is None:
        set_setting("similarity_threshold", app.config["DEFAULT_SIMILARITY_THRESHOLD"])
        db.session.commit()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def current_threshold():
    return float(get_setting("similarity_threshold", app.config["DEFAULT_SIMILARITY_THRESHOLD"]))


def build_existing_index():
    return [
        {"id": r.id, "hash": r.record_hash, "key_string": r.key_string}
        for r in Record.query.all()
    ]


def process_record(raw, key_fields, threshold, engine):
    """
    Runs a single record through the validation + decision engine and
    persists the outcome. Returns a small dict describing what happened.
    Does NOT commit — caller is responsible for committing the session.
    """
    result = engine.evaluate(raw, key_fields, threshold)
    payload = json.dumps(raw)

    if result["decision"] == "unique":
        rec = Record(
            data_json=payload,
            key_string=result["key_string"],
            record_hash=result["hash"],
            source="upload",
        )
        db.session.add(rec)
        db.session.flush()
        engine.register_unique(rec.id, result["hash"], result["key_string"])
        log_activity(
            "record_added",
            f"Added unique record #{rec.id} to the cloud database",
            {"record_id": rec.id},
        )
        return {"decision": "unique", "id": rec.id}

    if result["decision"] == "duplicate":
        flagged = FlaggedRecord(
            data_json=payload,
            key_string=result["key_string"],
            record_hash=result["hash"],
            matched_record_id=result["matched_id"],
            similarity_score=result["similarity"],
            match_type="exact_duplicate",
            resolution_status="auto_rejected",
            resolved_at=utcnow(),
        )
        db.session.add(flagged)
        db.session.flush()
        log_activity(
            "duplicate_rejected",
            f"Blocked exact duplicate — matches verified record #{result['matched_id']}",
            {"flagged_id": flagged.id, "matched_id": result["matched_id"]},
        )
        return {"decision": "duplicate", "id": flagged.id}

    # possible_duplicate -> needs human review
    flagged = FlaggedRecord(
        data_json=payload,
        key_string=result["key_string"],
        record_hash=result["hash"],
        matched_record_id=result["matched_id"],
        similarity_score=result["similarity"],
        match_type="near_duplicate",
        resolution_status="pending",
    )
    db.session.add(flagged)
    db.session.flush()
    log_activity(
        "flagged_for_review",
        f"Flagged possible duplicate ({result['similarity']:.1f}% match with record #{result['matched_id']}) for review",
        {"flagged_id": flagged.id, "matched_id": result["matched_id"], "similarity": result["similarity"]},
    )
    return {"decision": "possible_duplicate", "id": flagged.id}


# ---------------------------------------------------------------------------
# Page route
# ---------------------------------------------------------------------------

@app.route("/")
def index():
    return render_template("index.html")


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------

@app.route("/api/health")
def api_health():
    return jsonify({"status": "ok", "service": "NimbusCloud Data Redundancy Removal System"})


# ---------------------------------------------------------------------------
# Settings (adjustable similarity threshold)
# ---------------------------------------------------------------------------

@app.route("/api/settings", methods=["GET", "POST"])
def api_settings():
    if request.method == "POST":
        payload = request.get_json(force=True, silent=True) or {}
        threshold = payload.get("similarity_threshold")
        if threshold is not None:
            try:
                threshold = float(threshold)
            except (TypeError, ValueError):
                return jsonify({"error": "similarity_threshold must be a number"}), 400
            if not (0 <= threshold <= 100):
                return jsonify({"error": "similarity_threshold must be between 0 and 100"}), 400
            set_setting("similarity_threshold", threshold)
            log_activity("settings_updated", f"Similarity threshold updated to {threshold:.0f}%")
            db.session.commit()
    return jsonify({"similarity_threshold": current_threshold()})


# ---------------------------------------------------------------------------
# Ingest: manual single-record entry
# ---------------------------------------------------------------------------

@app.route("/api/records/manual", methods=["POST"])
def api_add_manual():
    payload = request.get_json(force=True, silent=True) or {}
    raw = payload.get("data")
    key_fields = payload.get("key_fields") or None

    if not isinstance(raw, dict) or not raw:
        return jsonify({"error": "Provide a non-empty 'data' object with at least one field."}), 400

    threshold = current_threshold()
    engine = ValidationEngine(build_existing_index())
    outcome = process_record(raw, key_fields, threshold, engine)
    db.session.commit()

    return jsonify({"outcome": outcome})


# ---------------------------------------------------------------------------
# Ingest: bulk batch (parsed client-side from CSV, sent as JSON)
# ---------------------------------------------------------------------------

@app.route("/api/records/batch", methods=["POST"])
def api_add_batch():
    payload = request.get_json(force=True, silent=True) or {}
    records = payload.get("records")
    key_fields = payload.get("key_fields") or None

    if not isinstance(records, list) or not records:
        return jsonify({"error": "Provide a non-empty 'records' array."}), 400

    max_allowed = app.config["MAX_RECORDS_PER_UPLOAD"]
    if len(records) > max_allowed:
        return jsonify({"error": f"Batch of {len(records)} exceeds the {max_allowed}-record limit."}), 400

    threshold = current_threshold()
    engine = ValidationEngine(build_existing_index())

    summary = {"unique": 0, "duplicate": 0, "possible_duplicate": 0, "errors": 0}

    for raw in records:
        if not isinstance(raw, dict) or not raw:
            summary["errors"] += 1
            continue
        try:
            outcome = process_record(raw, key_fields, threshold, engine)
            summary[outcome["decision"]] += 1
        except Exception:
            summary["errors"] += 1
            db.session.rollback()
            continue

    log_activity(
        "batch_processed",
        f"Processed batch of {len(records)} rows — "
        f"{summary['unique']} unique, {summary['duplicate']} duplicate, "
        f"{summary['possible_duplicate']} flagged for review"
        + (f", {summary['errors']} skipped" if summary["errors"] else ""),
        summary,
    )
    db.session.commit()

    return jsonify({"summary": summary, "total": len(records)})


# ---------------------------------------------------------------------------
# Records: unified read model across unique + flagged records
# ---------------------------------------------------------------------------

@app.route("/api/records")
def api_records():
    status = request.args.get("status", "all")
    search = request.args.get("search", "").strip()
    page = max(1, int(request.args.get("page", 1)))
    per_page = min(200, max(1, int(request.args.get("per_page", app.config["RECORDS_PAGE_SIZE"]))))

    items = []

    if status in ("all", "unique"):
        q = Record.query
        if search:
            q = q.filter(Record.data_json.ilike(f"%{search}%"))
        items.extend(r.to_dict() for r in q.order_by(Record.created_at.desc()).all())

    if status in ("all", "duplicate", "pending_review", "false_positive"):
        q = FlaggedRecord.query
        if search:
            q = q.filter(FlaggedRecord.data_json.ilike(f"%{search}%"))
        flagged = [f.to_dict() for f in q.order_by(FlaggedRecord.created_at.desc()).all()]
        if status != "all":
            flagged = [f for f in flagged if f["status"] == status]
        items.extend(flagged)

    items.sort(key=lambda r: r["created_at"], reverse=True)

    total = len(items)
    start = (page - 1) * per_page
    page_items = items[start:start + per_page]
    total_pages = max(1, (total + per_page - 1) // per_page)

    return jsonify({
        "items": page_items,
        "total": total,
        "page": page,
        "per_page": per_page,
        "total_pages": total_pages,
    })


@app.route("/api/records/<int:record_id>", methods=["DELETE"])
def api_delete_record(record_id):
    rec = Record.query.get_or_404(record_id)
    log_activity("record_deleted", f"Deleted verified record #{record_id} from the cloud database", {"record_id": record_id})
    db.session.delete(rec)
    db.session.commit()
    return jsonify({"success": True})


# ---------------------------------------------------------------------------
# False-positive review queue
# ---------------------------------------------------------------------------

@app.route("/api/flagged/<int:flagged_id>/resolve", methods=["POST"])
def api_resolve_flagged(flagged_id):
    payload = request.get_json(force=True, silent=True) or {}
    action = payload.get("action")

    flagged = FlaggedRecord.query.get_or_404(flagged_id)
    if flagged.resolution_status != "pending":
        return jsonify({"error": "This record has already been resolved."}), 400

    if action == "confirm_duplicate":
        flagged.resolution_status = "confirmed_duplicate"
        flagged.resolved_at = utcnow()
        log_activity(
            "duplicate_confirmed",
            f"Confirmed record #{flagged.id} as a true duplicate of #{flagged.matched_record_id}",
            {"flagged_id": flagged.id, "matched_id": flagged.matched_record_id},
        )
    elif action == "mark_false_positive":
        restored = Record(
            data_json=flagged.data_json,
            key_string=flagged.key_string,
            record_hash=flagged.record_hash,
            source="restored",
        )
        db.session.add(restored)
        db.session.flush()
        flagged.resolution_status = "false_positive"
        flagged.resolved_at = utcnow()
        log_activity(
            "false_positive_restored",
            f"Marked #{flagged.id} as a false positive and restored it as verified record #{restored.id}",
            {"flagged_id": flagged.id, "new_record_id": restored.id},
        )
    else:
        return jsonify({"error": "Unknown action. Use 'confirm_duplicate' or 'mark_false_positive'."}), 400

    db.session.commit()
    return jsonify({"success": True, "flagged": flagged.to_dict()})


# ---------------------------------------------------------------------------
# Live dashboard stats + chart data
# ---------------------------------------------------------------------------

@app.route("/api/stats")
def api_stats():
    unique_count = Record.query.count()
    exact_dup_count = FlaggedRecord.query.filter_by(match_type="exact_duplicate").count()
    confirmed_dup_count = FlaggedRecord.query.filter_by(resolution_status="confirmed_duplicate").count()
    pending_count = FlaggedRecord.query.filter_by(resolution_status="pending").count()
    false_positive_count = FlaggedRecord.query.filter_by(resolution_status="false_positive").count()

    duplicates_blocked = exact_dup_count + confirmed_dup_count
    total_processed = unique_count + duplicates_blocked + pending_count + false_positive_count

    reviewed = confirmed_dup_count + false_positive_count
    review_accuracy = round((false_positive_count / reviewed) * 100, 1) if reviewed else None

    today = utcnow().date()
    daily_activity = []
    for i in range(6, -1, -1):
        day = today - timedelta(days=i)
        day_start = datetime(day.year, day.month, day.day, tzinfo=timezone.utc)
        day_end = day_start + timedelta(days=1)
        count = Record.query.filter(Record.created_at >= day_start, Record.created_at < day_end).count()
        count += FlaggedRecord.query.filter(FlaggedRecord.created_at >= day_start, FlaggedRecord.created_at < day_end).count()
        daily_activity.append({"date": day.strftime("%b %d"), "count": count})

    return jsonify({
        "unique_count": unique_count,
        "duplicates_blocked": duplicates_blocked,
        "pending_review": pending_count,
        "false_positives_restored": false_positive_count,
        "total_processed": total_processed,
        "review_accuracy": review_accuracy,
        "threshold": current_threshold(),
        "daily_activity": daily_activity,
        "breakdown": {
            "unique": unique_count,
            "duplicate": duplicates_blocked,
            "pending_review": pending_count,
            "false_positive": false_positive_count,
        },
    })


# ---------------------------------------------------------------------------
# Activity log
# ---------------------------------------------------------------------------

@app.route("/api/activity")
def api_activity():
    page = max(1, int(request.args.get("page", 1)))
    per_page = min(100, max(1, int(request.args.get("per_page", app.config["ACTIVITY_PAGE_SIZE"]))))

    q = ActivityLog.query.order_by(ActivityLog.timestamp.desc())
    total = q.count()
    items = q.offset((page - 1) * per_page).limit(per_page).all()

    return jsonify({
        "items": [a.to_dict() for a in items],
        "total": total,
        "page": page,
        "per_page": per_page,
        "total_pages": max(1, (total + per_page - 1) // per_page),
    })


# ---------------------------------------------------------------------------
# Export cleaned data
# ---------------------------------------------------------------------------

@app.route("/api/export")
def api_export():
    fmt = request.args.get("format", "csv").lower()
    records = Record.query.order_by(Record.created_at.asc()).all()
    data = [json.loads(r.data_json) for r in records]

    log_activity("data_exported", f"Exported {len(data)} verified record(s) as {fmt.upper()}")
    db.session.commit()

    if fmt == "json":
        buf = io.BytesIO(json.dumps(data, indent=2).encode("utf-8"))
        buf.seek(0)
        return send_file(buf, mimetype="application/json", as_attachment=True,
                          download_name="nimbuscloud_cleaned_data.json")

    fieldnames, seen = [], set()
    for d in data:
        for k in d.keys():
            if k not in seen:
                seen.add(k)
                fieldnames.append(k)

    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=fieldnames or ["value"], extrasaction="ignore")
    writer.writeheader()
    for d in data:
        writer.writerow(d)

    buf = io.BytesIO(output.getvalue().encode("utf-8"))
    buf.seek(0)
    return send_file(buf, mimetype="text/csv", as_attachment=True,
                      download_name="nimbuscloud_cleaned_data.csv")


# ---------------------------------------------------------------------------
# Sample dataset (for quickly demoing the system)
# ---------------------------------------------------------------------------

@app.route("/api/sample")
def api_sample():
    return send_from_directory("sample_data", "sample_dataset.csv", as_attachment=True)


# ---------------------------------------------------------------------------
# Danger zone: reset everything
# ---------------------------------------------------------------------------

@app.route("/api/reset", methods=["POST"])
def api_reset():
    FlaggedRecord.query.delete()
    Record.query.delete()
    ActivityLog.query.delete()
    db.session.commit()
    log_activity("system_reset", "All records and activity history were cleared.")
    db.session.commit()
    return jsonify({"success": True})


if __name__ == "__main__":
    app.run(debug=True, host="127.0.0.1", port=5000)
