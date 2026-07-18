from flask import Flask, request, jsonify
from flask_cors import CORS
from groq import Groq
import time
import os
app = Flask(__name__)
CORS(app)
API_KEY = os.getenv("GROQ_API_KEY")

client = Groq(api_key=API_KEY)
sessions = {}

SYSTEM_PROMPT = "You are CloudBot, a cloud computing expert assistant built for NimbusCloud Suite by CodeAlpha. Answer questions about AWS, Azure, GCP, Docker, Kubernetes, serverless, CI/CD, networking, and DevOps. Be clear, friendly, and use bullet points. If asked something outside tech, politely redirect."

@app.route("/")
def index():
    return "CloudBot backend is live."

@app.route("/chat", methods=["POST"])
def chat():
    body = request.get_json()
    user_msg = body.get("message", "").strip()
    session_id = body.get("session_id", "default")

    if not user_msg:
        return jsonify({"error": "Empty message"}), 400

    if session_id not in sessions:
        sessions[session_id] = [{"role": "system", "content": SYSTEM_PROMPT}]

    history = sessions[session_id]
    history.append({"role": "user", "content": user_msg})

    if len(history) > 21:
        history = [history[0]] + history[-20:]

    try:
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=history,
            max_tokens=800,
            temperature=0.7
        )
        reply = response.choices[0].message.content

    except Exception as e:
        return jsonify({"error": str(e)}), 500

    history.append({"role": "assistant", "content": reply})
    sessions[session_id] = history

    return jsonify({"reply": reply, "timestamp": time.strftime("%H:%M")})

@app.route("/reset", methods=["POST"])
def reset():
    body = request.get_json()
    session_id = body.get("session_id", "default")
    if session_id in sessions:
        sessions.pop(session_id)
    return jsonify({"status": "cleared"})

if __name__ == "__main__":
    app.run(debug=True, port=5000)