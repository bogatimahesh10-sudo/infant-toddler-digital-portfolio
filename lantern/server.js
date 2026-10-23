// Lantern server: serves the site, stores shared thoughts, and relays companion chats to Claude.
// No framework; Node 18+ and the Anthropic SDK are the only requirements.
//
//   PORT           port to listen on (default 3000)
//   LANTERN_DATA   where shared thoughts are saved (default ./data/lantern.json)
//   ANTHROPIC_API_KEY  enables the AI companion (any credential the Anthropic SDK accepts works)
"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");
const C = require("./public/core.js");
const S = require("./store.js");

let Anthropic = null;
try {
  Anthropic = require("@anthropic-ai/sdk");
} catch (e) {
  console.warn("Anthropic SDK not installed (run npm install in lantern/). The companion will run offline.");
}

const PORT = Number(process.env.PORT) || 3000;
const PUBLIC_DIR = path.join(__dirname, "public");
const store = S.createFileStore(process.env.LANTERN_DATA || path.join(__dirname, "data", "lantern.json"));
const MODEL = "claude-opus-5-5";
// The companion goes live when the SDK is installed and a credential is configured. LANTERN_AI=on
// forces it on for credentials the SDK finds by itself (such as an `ant auth login` profile).
const AI_READY =
  Boolean(Anthropic) &&
  Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN || process.env.ANTHROPIC_PROFILE || process.env.LANTERN_AI === "on");

const COMPANION_PROMPT = `You are the companion on Lantern, a website that helps people understand who they are and feel less alone.

Who you are:
- You are an AI. Never claim or imply to be human. If asked, say so plainly and warmly.
- You are not a therapist and you don't diagnose. You are a kind, curious presence to talk with.

How you talk:
- Warm, calm and genuine. Plain everyday language. Usually two to five sentences.
- Listen first. Reflect back what you hear before offering anything. Ask at most one gentle question at a time.
- Help people notice their own feelings, values and strengths. Curiosity over advice; offer suggestions only when wanted.
- Celebrate small steps. Never lecture, never guilt.
- Gently encourage real-world connection where it fits: a friend, family member, community group, or a professional. You are a bridge to people, not a replacement for them.

Safety comes first:
- If someone mentions suicide, self-harm, being in danger, or harming others, respond with care, take it seriously, and encourage them to contact a crisis line or emergency services now. The site's "Get help now" page lists helplines by country. Stay with them in the conversation; don't abruptly end it.
- Don't give medical, legal or medication advice; suggest a qualified professional instead.`;

const CRISIS_NOTE =
  "The person's latest message may indicate a risk of suicide or self-harm. Respond with warmth, ask directly and gently whether they are safe right now, and encourage them to reach a crisis line or local emergency services now, mentioning the site's \"Get help now\" page. Keep the reply short and human.";

let client = null;
function getClient() {
  if (!AI_READY) return null;
  if (!client) client = new Anthropic();
  return client;
}

async function companionReply(history, portrait) {
  const c = getClient();
  if (!c) throw httpError(503, "The companion isn't set up on this server yet.");
  const latest = history[history.length - 1];
  const crisis = detectCrisisIn(latest);
  const messages = history.slice();
  if (crisis) messages.push({ role: "system", content: CRISIS_NOTE });
  const system = portrait ? `${COMPANION_PROMPT}\n\nThe person chose to share this about themselves. ${portrait}` : COMPANION_PROMPT;
  let response;
  try {
    response = await c.beta.messages.create({
      model: MODEL,
      max_tokens: 4000,
      output_config: { effort: "low" },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system,
      messages,
    });
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) {
      throw httpError(503, "The companion isn't set up on this server yet.");
    }
    if (e instanceof Anthropic.RateLimitError) throw httpError(429, "Lots of people are talking right now. Please try again in a moment.");
    if (e instanceof Anthropic.APIError) throw httpError(502, "The companion couldn't reply just now. Please try again.");
    console.error(e);
    throw httpError(503, "The companion isn't set up on this server yet.");
  }
  if (response.stop_reason === "refusal") {
    return { reply: "I'm not able to talk about that here, but I'm still here with you. How are you feeling right now?", crisis };
  }
  const reply = response.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
  return { reply: reply || "I'm here. Take your time.", crisis };
}

function detectCrisisIn(message) {
  return Boolean(message && message.role === "user" && C.detectCrisis(message.content));
}

// --- tiny helpers -------------------------------------------------------------------------

function httpError(status, message) {
  const e = new Error(message);
  e.status = status;
  return e;
}

function sendJson(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(body));
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > 64 * 1024) {
        reject(httpError(413, "That's too long."));
        req.destroy();
      } else chunks.push(chunk);
    });
    req.on("end", () => {
      if (!chunks.length) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch (e) {
        reject(httpError(400, "Invalid request."));
      }
    });
    req.on("error", reject);
  });
}

// Fixed-window rate limiting per client address, in memory.
const hits = new Map();
function rateLimit(req, bucket, max, windowMs) {
  const key = bucket + ":" + (req.socket.remoteAddress || "?");
  const now = Date.now();
  const entry = hits.get(key);
  if (!entry || now - entry.start > windowMs) {
    hits.set(key, { start: now, count: 1 });
    return;
  }
  entry.count += 1;
  if (entry.count > max) throw httpError(429, "You're going a little fast. Please wait a few minutes and try again.");
}
setInterval(() => {
  const cutoff = Date.now() - 60 * 60 * 1000;
  hits.forEach((v, k) => v.start < cutoff && hits.delete(k));
}, 10 * 60 * 1000).unref();

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".webmanifest": "application/manifest+json",
};

function serveStatic(req, res, pathname) {
  const rel = pathname === "/" ? "index.html" : decodeURIComponent(pathname).replace(/^\/+/, "");
  const file = path.resolve(PUBLIC_DIR, rel);
  if (!file.startsWith(PUBLIC_DIR + path.sep)) return sendJson(res, 404, { error: "Not found" });
  fs.readFile(file, (err, data) => {
    if (err) return sendJson(res, 404, { error: "Not found" });
    res.writeHead(200, {
      "Content-Type": TYPES[path.extname(file)] || "application/octet-stream",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
    });
    res.end(data);
  });
}

// --- routes -------------------------------------------------------------------------------

async function handleApi(req, res, pathname) {
  const method = req.method;
  if (method === "GET" && pathname === "/api/health") {
    return sendJson(res, 200, { ok: true, ai: AI_READY });
  }
  if (method === "GET" && pathname === "/api/posts") {
    return sendJson(res, 200, { posts: S.listPosts(store.get()) });
  }
  if (method === "POST" && pathname === "/api/posts") {
    rateLimit(req, "write", 20, 10 * 60 * 1000);
    const body = await readJson(req);
    const { post, token } = store.apply((s) => S.addPost(s, body));
    return sendJson(res, 201, { post, token });
  }
  if (method === "POST" && pathname === "/api/chat") {
    rateLimit(req, "chat", 40, 10 * 60 * 1000);
    const body = await readJson(req);
    const history = C.cleanChatHistory(body.messages);
    if (!history.length || history[history.length - 1].role !== "user") throw httpError(400, "Say something to start.");
    const portrait = typeof body.portrait === "string" ? C.cleanText(body.portrait).slice(0, 500) : "";
    return sendJson(res, 200, await companionReply(history, portrait));
  }

  const m = pathname.match(/^\/api\/posts\/([0-9a-f-]{36})(\/(comments|relate|report))?$/);
  if (m) {
    const id = m[1];
    const action = m[3];
    if (method === "DELETE" && !action) {
      store.apply((s) => S.deletePost(s, id, req.headers["x-owner-token"]));
      return sendJson(res, 200, { ok: true });
    }
    if (method === "POST" && action === "comments") {
      rateLimit(req, "write", 20, 10 * 60 * 1000);
      const body = await readJson(req);
      const { comment } = store.apply((s) => S.addComment(s, id, body));
      return sendJson(res, 201, { comment });
    }
    if (method === "POST" && action === "relate") {
      rateLimit(req, "react", 120, 10 * 60 * 1000);
      store.apply((s) => S.relate(s, id));
      return sendJson(res, 200, { ok: true });
    }
    if (method === "POST" && action === "report") {
      rateLimit(req, "react", 120, 10 * 60 * 1000);
      store.apply((s) => S.report(s, id));
      return sendJson(res, 200, { ok: true });
    }
  }
  throw httpError(404, "Not found");
}

const server = http.createServer(async (req, res) => {
  const { pathname } = new URL(req.url, "http://localhost");
  try {
    if (pathname.startsWith("/api/")) await handleApi(req, res, pathname);
    else if (req.method === "GET" || req.method === "HEAD") serveStatic(req, res, pathname);
    else sendJson(res, 405, { error: "Method not allowed" });
  } catch (e) {
    const status = e.status || 500;
    if (status === 500) console.error(e);
    sendJson(res, status, { error: status === 500 ? "Something went wrong. Please try again." : e.message });
  }
});

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`Lantern is running at http://localhost:${PORT}`);
    if (!AI_READY) console.log("AI companion is offline: set ANTHROPIC_API_KEY to turn it on.");
  });
}

module.exports = { server };
