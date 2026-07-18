"""
NimbusCloud Suite — Task 1: Data Redundancy Removal System
Database models.

Three core tables map directly onto the architecture brief:

  Record         -> the "Cloud database" of verified, unique entries.
  FlaggedRecord  -> the "False positive log" / duplicate review queue.
                    Holds both auto-rejected exact duplicates AND
                    near-duplicates awaiting human review.
  ActivityLog    -> every action taken by the system, timestamped.
  Setting        -> small key/value store for live-tunable settings
                    (e.g. the similarity threshold).
"""

from datetime import datetime, timezone
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()


def utcnow():
    return datetime.now(timezone.utc)


class Record(db.Model):
    """A verified, unique record living in the cloud database."""
    __tablename__ = "records"

    id = db.Column(db.Integer, primary_key=True)
    data_json = db.Column(db.Text, nullable=False)          # original record, JSON-encoded
    key_string = db.Column(db.Text, nullable=False)          # normalized string used for matching
    record_hash = db.Column(db.String(64), nullable=False, index=True)  # SHA-256 of key_string
    source = db.Column(db.String(20), default="upload")      # 'upload' | 'manual' | 'restored'
    created_at = db.Column(db.DateTime, default=utcnow, index=True)

    def to_dict(self):
        import json
        return {
            "id": self.id,
            "status": "unique",
            "data": json.loads(self.data_json),
            "source": self.source,
            "created_at": self.created_at.isoformat(),
        }


class FlaggedRecord(db.Model):
    """
    A record that was NOT added directly to the cloud database because the
    validation engine detected a match against an existing record.

    match_type:
        'exact_duplicate'  -> SHA-256 hash matched an existing record exactly.
        'near_duplicate'   -> fuzzy similarity >= threshold, but not identical.

    resolution_status:
        'auto_rejected'       -> exact duplicate, rejected automatically (no review needed).
        'pending'             -> near-duplicate awaiting human review.
        'confirmed_duplicate' -> human reviewed and confirmed it IS a duplicate.
        'false_positive'      -> human reviewed and determined it is NOT a duplicate;
                                  the record was restored into the cloud database.
    """
    __tablename__ = "flagged_records"

    id = db.Column(db.Integer, primary_key=True)
    data_json = db.Column(db.Text, nullable=False)
    key_string = db.Column(db.Text, nullable=False)
    record_hash = db.Column(db.String(64), nullable=False, index=True)

    matched_record_id = db.Column(db.Integer, db.ForeignKey("records.id"), nullable=True)
    similarity_score = db.Column(db.Float, default=0.0)
    match_type = db.Column(db.String(20), nullable=False)
    resolution_status = db.Column(db.String(24), default="pending", index=True)

    created_at = db.Column(db.DateTime, default=utcnow, index=True)
    resolved_at = db.Column(db.DateTime, nullable=True)

    matched_record = db.relationship("Record", foreign_keys=[matched_record_id])

    def to_dict(self):
        import json
        matched = None
        if self.matched_record is not None:
            matched = self.matched_record.to_dict()
        status_map = {
            "auto_rejected": "duplicate",
            "confirmed_duplicate": "duplicate",
            "pending": "pending_review",
            "false_positive": "false_positive",
        }
        return {
            "id": self.id,
            "status": status_map.get(self.resolution_status, "pending_review"),
            "resolution_status": self.resolution_status,
            "match_type": self.match_type,
            "similarity_score": round(self.similarity_score, 2),
            "data": json.loads(self.data_json),
            "matched_record": matched,
            "created_at": self.created_at.isoformat(),
            "resolved_at": self.resolved_at.isoformat() if self.resolved_at else None,
        }


class ActivityLog(db.Model):
    __tablename__ = "activity_log"

    id = db.Column(db.Integer, primary_key=True)
    action = db.Column(db.String(64), nullable=False)   # machine-readable action code
    message = db.Column(db.Text, nullable=False)         # human-readable description
    meta_json = db.Column(db.Text, nullable=True)         # optional extra structured data
    timestamp = db.Column(db.DateTime, default=utcnow, index=True)

    def to_dict(self):
        import json
        return {
            "id": self.id,
            "action": self.action,
            "message": self.message,
            "meta": json.loads(self.meta_json) if self.meta_json else None,
            "timestamp": self.timestamp.isoformat(),
        }


class Setting(db.Model):
    __tablename__ = "settings"

    key = db.Column(db.String(64), primary_key=True)
    value = db.Column(db.String(256), nullable=False)


def log_activity(action, message, meta=None):
    """Convenience helper used throughout the app to append to the activity log."""
    import json
    entry = ActivityLog(
        action=action,
        message=message,
        meta_json=json.dumps(meta) if meta is not None else None,
    )
    db.session.add(entry)
    return entry


def get_setting(key, default=None):
    row = Setting.query.get(key)
    return row.value if row else default


def set_setting(key, value):
    row = Setting.query.get(key)
    if row:
        row.value = str(value)
    else:
        row = Setting(key=key, value=str(value))
        db.session.add(row)
    return row
