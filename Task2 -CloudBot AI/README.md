# CloudBot — NimbusCloud Suite · Task 4

AI-powered cloud computing expert chatbot built for the CodeAlpha Cloud Computing Internship.

## What it does
- Answers questions on AWS, Azure, GCP, Docker, Kubernetes, Serverless, CI/CD, VPC, and more
- Maintains full conversation memory per session
- Renders formatted responses (code blocks, bullet points, headings)
- Real-time typing indicator and message timestamps
- Export conversation as .txt file
- Live topic tracking in right panel
- Auto-detects topics discussed and shows coverage stats

## Tech Stack
| Layer | Technology |
|---|---|
| Frontend | HTML5, CSS3, Vanilla JS |
| Backend | Python 3, Flask, Flask-CORS |
| AI Engine | Google Gemini 1.5 Flash |
| Deployment | Render (free tier) |

## Setup Instructions

### 1. Get a free Gemini API key
Visit https://aistudio.google.com/app/apikey and create a key.

### 2. Backend setup
```bash
cd backend
python -m venv venv
venv\Scripts\activate        # Windows
pip install -r requirements.txt
```

Create a `.env` file inside `backend/`:
```
GEMINI_API_KEY=your_actual_key_here
```

Run the server:
```bash
python app.py
```

### 3. Frontend
Open `frontend/index.html` in your browser. That's it.

### 4. Deploy to Render
- Push to GitHub
- Connect repo on render.com
- Root directory: `backend`
- Build: `pip install -r requirements.txt`
- Start: `gunicorn app:app`
- Add `GEMINI_API_KEY` in Environment Variables

Then update `BACKEND` in `frontend/script.js` to your Render URL.

## Project by
Yashu — CodeAlpha Cloud Computing Internship
NimbusCloud Suite · Task 4 of 3
