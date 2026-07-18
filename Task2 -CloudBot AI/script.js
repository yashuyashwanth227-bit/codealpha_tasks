// ── Config ──────────────────────────────────────────────
// Change this to your Render URL after deployment
const BACKEND = "http://localhost:5000";

// Generate a session ID so the bot remembers this conversation
const SESSION_ID = "session_" + Math.random().toString(36).slice(2, 9);

// ── State ────────────────────────────────────────────────
let msgCount = 0;
let queryCount = 0;
let topicsTouched = new Set();
let isWaiting = false;

// Topic keywords to auto-detect
const topicMap = {
  "aws": "AWS", "ec2": "AWS", "s3": "AWS", "lambda": "Lambda",
  "azure": "Azure", "gcp": "GCP", "google cloud": "GCP",
  "docker": "Docker", "container": "Docker",
  "kubernetes": "Kubernetes", "k8s": "Kubernetes",
  "serverless": "Serverless", "ci/cd": "CI/CD", "devops": "DevOps",
  "vpc": "Networking", "load balanc": "Load Balancing",
  "microservice": "Microservices", "database": "Databases",
  "storage": "Storage", "terraform": "IaC", "ansible": "IaC"
};

// ── DOM refs ─────────────────────────────────────────────
const messagesWrap = document.getElementById("messagesWrap");
const userInput    = document.getElementById("userInput");
const sendBtn      = document.getElementById("sendBtn");
const typingBar    = document.getElementById("typingBar");
const statusDot    = document.getElementById("statusDot");
const statusText   = document.getElementById("statusText");
const statMsgs     = document.getElementById("statMsgs");
const statQueries  = document.getElementById("statQueries");
const coverageList = document.getElementById("coverageList");

// ── On load: ping backend ────────────────────────────────
window.addEventListener("load", () => {
  fetch(BACKEND + "/")
    .then(() => {
      statusDot.classList.add("online");
      statusText.textContent = "Online";
    })
    .catch(() => {
      statusText.textContent = "Offline";
    });
});

// ── Send on Enter ────────────────────────────────────────
function handleKey(e) {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
}

// Auto-resize textarea
function autoResize(el) {
  el.style.height = "auto";
  el.style.height = Math.min(el.scrollHeight, 120) + "px";
}

// ── Quick topic chips ────────────────────────────────────
function sendQuick(text) {
  userInput.value = text;
  sendMessage();
}

// ── Main send function ───────────────────────────────────
async function sendMessage() {
  if (isWaiting) return;
  const text = userInput.value.trim();
  if (!text) return;

  // Hide welcome card if still showing
  const welcome = document.querySelector(".welcome-card");
  if (welcome) welcome.remove();

  // Render user message
  appendMessage("user", text);
  userInput.value = "";
  userInput.style.height = "auto";

  // Update stats
  queryCount++;
  statQueries.textContent = queryCount;
  detectTopics(text);

  // Show typing
  isWaiting = true;
  sendBtn.disabled = true;
  typingBar.style.display = "flex";
  scrollDown();

  try {
    const res = await fetch(BACKEND + "/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text, session_id: SESSION_ID })
    });

    const data = await res.json();

    typingBar.style.display = "none";

    if (data.error) {
      appendMessage("bot", "Sorry, something went wrong: " + data.error, data.timestamp);
    } else {
      appendMessage("bot", data.reply, data.timestamp);
      detectTopics(data.reply);
    }

  } catch (err) {
    typingBar.style.display = "none";
    appendMessage("bot", "Could not reach the server. Make sure the backend is running on port 5000.");
  }

  isWaiting = false;
  sendBtn.disabled = false;
  scrollDown();
}

// ── Render a message ─────────────────────────────────────
function appendMessage(role, text, time) {
  msgCount++;
  statMsgs.textContent = msgCount;

  const timestamp = time || getCurrentTime();
  const isBot = role === "bot";

  const row = document.createElement("div");
  row.className = "msg-row " + (isBot ? "" : "user-row");

  const avatar = document.createElement("div");
  avatar.className = "msg-avatar " + (isBot ? "bot-av" : "user-av");
  avatar.textContent = isBot ? "C" : "Y";

  const content = document.createElement("div");
  content.className = "msg-content";

  const bubble = document.createElement("div");
  bubble.className = "msg-bubble " + (isBot ? "bot-bubble" : "user-bubble");

  if (isBot) {
    bubble.innerHTML = renderMarkdown(text);
  } else {
    bubble.textContent = text;
  }

  const meta = document.createElement("div");
  meta.className = "msg-meta";

  const timeEl = document.createElement("span");
  timeEl.className = "msg-time";
  timeEl.textContent = timestamp;
  meta.appendChild(timeEl);

  if (isBot) {
    const copyBtn = document.createElement("button");
    copyBtn.className = "copy-btn";
    copyBtn.textContent = "Copy";
    copyBtn.onclick = () => {
      navigator.clipboard.writeText(text);
      copyBtn.textContent = "Copied!";
      setTimeout(() => { copyBtn.textContent = "Copy"; }, 1500);
    };
    meta.appendChild(copyBtn);
  }

  content.appendChild(bubble);
  content.appendChild(meta);
  row.appendChild(avatar);
  row.appendChild(content);
  messagesWrap.appendChild(row);
}

// ── Simple markdown renderer ─────────────────────────────
function renderMarkdown(text) {
  // Code blocks first (multi-line)
  text = text.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) => {
    return `<pre><code>${escapeHtml(code.trim())}</code></pre>`;
  });

  // Inline code
  text = text.replace(/`([^`]+)`/g, "<code>$1</code>");

  // Bold
  text = text.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");

  // Italic
  text = text.replace(/\*(.+?)\*/g, "<em>$1</em>");

  // Headings
  text = text.replace(/^### (.+)$/gm, "<strong style='display:block;margin-top:8px;color:#0f172a'>$1</strong>");
  text = text.replace(/^## (.+)$/gm,  "<strong style='display:block;margin-top:10px;font-size:14px;color:#0f172a'>$1</strong>");

  // Bullet lists
  text = text.replace(/^\s*[-*] (.+)$/gm, "<li>$1</li>");
  text = text.replace(/(<li>.*<\/li>)/s, "<ul>$1</ul>");

  // Numbered lists
  text = text.replace(/^\d+\. (.+)$/gm, "<li>$1</li>");

  // Line breaks
  text = text.replace(/\n\n/g, "<br><br>");
  text = text.replace(/\n/g, "<br>");

  return text;
}

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// ── Detect topics from text ──────────────────────────────
function detectTopics(text) {
  const lower = text.toLowerCase();
  for (const [key, label] of Object.entries(topicMap)) {
    if (lower.includes(key)) topicsTouched.add(label);
  }
  updateCoverage();
}

function updateCoverage() {
  if (topicsTouched.size === 0) return;
  coverageList.innerHTML = "";
  topicsTouched.forEach(label => {
    const tag = document.createElement("span");
    tag.className = "coverage-tag";
    tag.textContent = label;
    coverageList.appendChild(tag);
  });
}

// ── Clear chat ───────────────────────────────────────────
function clearChat() {
  if (!confirm("Clear this conversation?")) return;

  fetch(BACKEND + "/reset", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id: SESSION_ID })
  }).catch(() => {});

  messagesWrap.innerHTML = `
    <div class="welcome-card">
      <div class="welcome-icon">&#9729;</div>
      <h2>Welcome to CloudBot</h2>
      <p>Your expert guide to cloud computing, DevOps, and modern infrastructure.</p>
      <div class="welcome-chips">
        <span onclick="sendQuick('What can you help me with?')">What can you help me with?</span>
        <span onclick="sendQuick('Explain cloud computing to a beginner')">Explain cloud computing</span>
        <span onclick="sendQuick('How do I start learning AWS?')">How to learn AWS?</span>
      </div>
    </div>`;

  msgCount = 0;
  queryCount = 0;
  topicsTouched.clear();
  statMsgs.textContent = "0";
  statQueries.textContent = "0";
  coverageList.innerHTML = `<span class="coverage-tag empty">Waiting for questions...</span>`;
}

// ── Export chat as .txt ──────────────────────────────────
function exportChat() {
  const rows = messagesWrap.querySelectorAll(".msg-row");
  if (rows.length === 0) { alert("Nothing to export yet."); return; }

  let output = "CloudBot Conversation Export\n";
  output += "Generated: " + new Date().toLocaleString() + "\n";
  output += "─".repeat(40) + "\n\n";

  rows.forEach(row => {
    const isUser = row.classList.contains("user-row");
    const bubble = row.querySelector(".msg-bubble");
    const time   = row.querySelector(".msg-time")?.textContent || "";
    const label  = isUser ? "You" : "CloudBot";
    output += `[${time}] ${label}:\n${bubble.innerText}\n\n`;
  });

  const blob = new Blob([output], { type: "text/plain" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "cloudbot_chat_" + Date.now() + ".txt";
  a.click();
}

// ── Scroll to bottom ─────────────────────────────────────
function scrollDown() {
  setTimeout(() => {
    messagesWrap.scrollTop = messagesWrap.scrollHeight;
  }, 50);
}

function getCurrentTime() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
