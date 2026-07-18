# NimbusCloud Suite — Data Redundancy Removal System

**Task 1 · CodeAlpha Internship**

A full-stack system that validates incoming data against a cloud database,
classifies it as **unique**, **duplicate**, or a **possible duplicate**
awaiting human review, and only ever appends verified, unique entries to
the database.

Built with **Python (Flask) + SQLite/PostgreSQL** on the backend and a
custom **HTML/CSS/JS** console-style dashboard on the frontend, with
**Chart.js** for live charts and **RapidFuzz** for fuzzy matching.

---

## ✨ Features

| Category | Feature |
|---|---|
| **Validation engine** | SHA-256 exact-hash matching + RapidFuzz fuzzy (near-duplicate) matching |
| **Decision engine** | Classifies every record as `unique`, `duplicate`, or `pending review` |
| **False-positive log** | Review queue with side-by-side comparison and one-click restore |
| **Cloud database** | SQLite by default, one env var away from PostgreSQL |
| **Live dashboard** | Auto-refreshing stats + donut and bar charts |
| **CSV bulk upload** | Drag-and-drop, handles thousands of rows, client-side parsed |
| **Manual entry** | Dynamic key/value form for one-off records |
| **Adjustable threshold** | Live similarity-percentage slider, applied instantly |
| **Search & filter** | Instant search across all records, filter by classification |
| **Export** | Download the cleaned, verified dataset as CSV or JSON |
| **Activity log** | Every action timestamped and listed |
| **Dark / light mode** | Futuristic dark console theme by default |

---

## 🗂 Project structure

```
nimbuscloud-redundancy/
├── app.py                  # Flask app & all API routes
├── engine.py                # Validation & decision engine (hashing + fuzzy matching)
├── models.py                 # SQLAlchemy models (Record, FlaggedRecord, ActivityLog, Setting)
├── config.py                  # App configuration (DB URL, defaults)
├── requirements.txt
├── sample_data/
│   └── sample_dataset.csv    # Ready-made CSV with intentional dupes, for demoing
├── static/
│   ├── css/style.css          # Design system + all UI styling
│   └── js/
│       ├── app.js              # All frontend logic
│       └── vendor/              # Chart.js + PapaParse, vendored locally (no CDN needed)
└── templates/
    └── index.html               # Single-page dashboard
```

---

## 🚀 Getting started (VS Code)

1. **Open the folder** `nimbuscloud-redundancy` in VS Code.
2. **Create a virtual environment** (recommended) and install dependencies:

   ```bash
   python -m venv .venv
   # Windows:
   .venv\Scripts\activate
   # macOS/Linux:
   source .venv/bin/activate

   pip install -r requirements.txt
   ```

3. **Run the app:**

   ```bash
   python app.py
   ```

4. Open **http://127.0.0.1:5000** in your browser.

That's it — a local SQLite database file (`nimbuscloud.db`) is created
automatically on first run. No further setup is required.

### Trying it out fast

From the **Ingest Data** page, click *"Download sample dataset to try it
out"*, then drag that CSV straight back into the upload zone. It contains
intentional exact duplicates, near-duplicates (typos, formatting
differences), and unique rows, so you'll immediately see all three
decision paths in action, plus records waiting in the **Review Queue**.

---

## 🔁 Switching to PostgreSQL

No code changes needed — just set an environment variable before running:

```bash
export DATABASE_URL="postgresql://user:password@localhost:5432/nimbuscloud"
python app.py
```

(On Windows, use `set DATABASE_URL=...` or configure it in your `.env` /
launch settings.) You'll also need `psycopg2-binary` installed:

```bash
pip install psycopg2-binary
```

---

## 🧠 How the validation & decision engine works

1. **Normalize** — every incoming record (CSV row or manual entry) is
   normalized into a single comparison string, built from either the
   fields you choose to match on, or all fields if none are chosen.
   Whitespace and casing differences are ignored so formatting alone
   never causes a false mismatch.

2. **Exact check (SHA-256)** — the normalized string is hashed. If the
   hash matches an existing verified record exactly, the incoming record
   is an **exact duplicate** and is auto-rejected — it never touches the
   cloud database, and the action is logged.

3. **Fuzzy check (RapidFuzz token-sort ratio)** — if there's no exact
   hash match, the record is compared against every existing verified
   record using fuzzy string similarity (resilient to word order and
   small typos, e.g. "Jon Doe" vs "John Doe"). If the best score is at
   or above your adjustable **similarity threshold** (default 85%), the
   record is flagged as a **possible duplicate** and placed in the
   **Review Queue** instead of being silently added or dropped.

4. **Human review** — from the Review Queue, you see the new record and
   its matched existing record side by side, with differing fields
   highlighted. You can:
   - **Confirm duplicate** → the record stays rejected.
   - **Mark as false positive** → the system was wrong to flag it; it's
     restored and added to the cloud database as a genuine unique record.

5. **Unique** — anything with no exact hash hit and no fuzzy match above
   the threshold is classified **unique** and appended directly to the
   cloud database.

This three-way classification (unique / duplicate / false-positive
candidate) is exactly what prevents both **data pollution** (duplicates
sneaking in) and **data loss** (legitimate records being wrongly dropped).

---

## 📡 API reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Health check |
| `GET` / `POST` | `/api/settings` | Get / set the similarity threshold |
| `POST` | `/api/records/manual` | Submit a single record: `{ "data": {...}, "key_fields": [...] }` |
| `POST` | `/api/records/batch` | Submit a batch: `{ "records": [...], "key_fields": [...] }` |
| `GET` | `/api/records` | List records — query params: `status`, `search`, `page`, `per_page` |
| `DELETE` | `/api/records/<id>` | Delete a verified record |
| `POST` | `/api/flagged/<id>/resolve` | Resolve a flagged record: `{ "action": "confirm_duplicate" \| "mark_false_positive" }` |
| `GET` | `/api/stats` | Dashboard stats + chart data |
| `GET` | `/api/activity` | Paginated activity log |
| `GET` | `/api/export?format=csv\|json` | Download the cleaned, verified dataset |
| `GET` | `/api/sample` | Download the bundled sample CSV |
| `POST` | `/api/reset` | Clear all records and activity history |

`status` filter values for `/api/records`: `all`, `unique`, `duplicate`,
`pending_review`, `false_positive`.

---

## 🛠 Notes & design decisions

- **Schema-agnostic by design.** Records are arbitrary key/value data —
  upload any CSV with any columns. You choose which fields matter for
  matching (e.g. just `email`) or leave it on "all fields."
- **Vendored frontend libraries.** Chart.js and PapaParse are bundled
  locally under `static/js/vendor/`, so the app works fully offline once
  dependencies are installed — no CDN required at runtime.
- **Scale.** RapidFuzz's C-accelerated matching comfortably handles
  batches of several thousand rows. For extremely large datasets (100k+
  records), consider adding a blocking/indexing strategy before fuzzy
  comparison — the `ValidationEngine` class in `engine.py` is the single
  place to extend that.
- **Single-user, local-first.** There's no authentication layer, by
  design — this is a self-contained internship deliverable meant to run
  on one machine. Add Flask-Login or similar if you need multi-user
  access control later.

---

NimbusCloud Suite · Task 1 · Data Redundancy Removal System · CodeAlpha 2026
