/* Local development server — on Railway/Vercel, env vars are set externally */
try { require("dotenv").config(); } catch { /* dotenv not installed in prod */ }

const crypto  = require("crypto");
const express = require("express");
const path    = require("path");
const { ProxyAgent } = require("undici");

const app  = express();
const PORT = process.env.PORT || 3000;

/* ── Credentials MUST come from .env — no fallbacks ── */
const LOGIN_KEY     = process.env.LOGIN_KEY;
const LOGIN_USER    = process.env.LOGIN_USER;
const LOGIN_PAYLOAD = process.env.LOGIN_PAYLOAD;
const API_BASE      = process.env.API_BASE || "http://api.autosweeprfidonline.net:45893";

/* ── Proxy (routes through PH residential IP) ────────── */
const PROXY_HOST = process.env.PROXY_HOST;
const PROXY_PORT = process.env.PROXY_PORT || "9000";
const PROXY_USER = process.env.PROXY_USER;
const PROXY_PASS = process.env.PROXY_PASS;

let proxyDispatcher = null;
if (PROXY_HOST && PROXY_USER && PROXY_PASS) {
  proxyDispatcher = new ProxyAgent({
    uri:   `http://${PROXY_HOST}:${PROXY_PORT}`,
    token: `Basic ${Buffer.from(`${PROXY_USER}:${PROXY_PASS}`).toString("base64")}`,
  });
  console.log(`Proxy enabled: ${PROXY_HOST}:${PROXY_PORT}`);
} else {
  console.warn("No proxy configured — upstream API may be unreachable outside PH.");
}

if (!LOGIN_KEY || !LOGIN_USER || !LOGIN_PAYLOAD) {
  console.error("FATAL: Missing required environment variables: LOGIN_KEY, LOGIN_USER, LOGIN_PAYLOAD");
  console.error("Copy .env.example → .env and fill in the values, then restart.");
  process.exit(1);
}

const PLATE_REGEX    = /^[A-Z0-9-]{4,12}$/;
const RATE_WINDOW_MS = 10 * 60_000; // 10 minutes
const RATE_LIMIT     = 3;           // 3 requests per 10 min per IP
const rateStore      = new Map();

/* Prune stale rate entries every minute */
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateStore) {
    if (now > entry.resetAt + 5000) rateStore.delete(ip);
  }
}, 60_000).unref();

app.use(express.json({ limit: "8kb" }));
app.use(express.static(path.join(__dirname, "public")));

/* ── Security headers ───────────────────────────────── */
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options",  "nosniff");
  res.setHeader("X-Frame-Options",         "DENY");
  res.setHeader("Referrer-Policy",         "no-referrer");
  res.setHeader("Permissions-Policy",      "camera=(), microphone=(), geolocation=()");
  res.setHeader("X-XSS-Protection",        "1; mode=block");
  next();
});

/* ── Rate limiting (applied to /api/* only) ─────────── */
app.use("/api/", (req, res, next) => {
  const ip  = req.ip || req.socket.remoteAddress || "unknown";
  const now = Date.now();
  const entry = rateStore.get(ip) || { count: 0, resetAt: now + RATE_WINDOW_MS };

  if (now > entry.resetAt) {
    entry.count  = 0;
    entry.resetAt = now + RATE_WINDOW_MS;
  }

  entry.count++;
  rateStore.set(ip, entry);

  if (entry.count > RATE_LIMIT) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    const mins = Math.ceil(retryAfter / 60);
    res.setHeader("Retry-After", retryAfter);
    return res.status(429).json({ error: `Rate limit reached. Try again in ${mins} minute${mins !== 1 ? "s" : ""}.` });
  }

  res.setHeader("Cache-Control", "no-store, no-cache");
  return next();
});

/* ── Crypto helpers ─────────────────────────────────── */
function deriveKey(secret) {
  const hex = crypto.createHash("sha512").update(secret, "utf8").digest("hex");
  return Buffer.from(hex.slice(20, 68), "hex");
}

function encrypt3Des(text, key) {
  const cipher = crypto.createCipheriv("des-ede3", deriveKey(key), null);
  cipher.setAutoPadding(true);
  return Buffer.concat([cipher.update(text, "utf8"), cipher.final()]).toString("base64");
}

function decrypt3Des(b64, key) {
  const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
  const buf    = Buffer.from(padded, "base64");
  const d      = crypto.createDecipheriv("des-ede3", deriveKey(key), null);
  d.setAutoPadding(true);
  return Buffer.concat([d.update(buf), d.final()]).toString("utf8");
}

/* ── Upstream API helpers ───────────────────────────── */
async function apiPost(url, authHeader, body = "") {
  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), 12_000);
  try {
    const opts = {
      method:  "POST",
      signal:  controller.signal,
      headers: {
        accept:         "application/json, text/plain, */*",
        authorization:  authHeader,
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent":   "okhttp/3.12.12",
      },
      body,
    };
    if (proxyDispatcher) opts.dispatcher = proxyDispatcher;
    const res = await fetch(url, opts);
    return { status: res.status, text: await res.text() };
  } finally {
    clearTimeout(tid);
  }
}

async function login() {
  const token   = encrypt3Des(LOGIN_PAYLOAD, LOGIN_KEY);
  const res     = await apiPost(`${API_BASE}/api/csr/login/v3`, `${LOGIN_USER}:${token}`);
  const outer   = JSON.parse(decrypt3Des(res.text.trim().replace(/^"|"$/g, ""), LOGIN_KEY));
  const session = JSON.parse(outer.Message);
  return { sid: session.SessionID, randomKey: session.RandomKey };
}

async function lookupByPlate(plate) {
  const { sid, randomKey } = await login();
  const payload = JSON.stringify({ SRC: "PLT", Request: plate });
  const token   = encrypt3Des(payload, randomKey);
  const res     = await apiPost(`${API_BASE}/api/GetAccount/v3`, `${sid}:${token}`, token);

  if (res.status !== 200) {
    throw new Error(`Upstream returned status ${res.status}`);
  }

  return JSON.parse(decrypt3Des(res.text.trim().replace(/^"|"$/g, ""), randomKey));
}

function sanitize(raw) {
  const r  = Array.isArray(raw) ? raw[0] : raw || {};
  const fn = String(r.FirstName    || "").trim();
  const ln = String(r.LastName     || "").trim();
  const isPlaceholder = fn.toUpperCase() === "AUTOSWEEP" && ln.toUpperCase() === "TO GO";

  return {
    firstName:   isPlaceholder ? "N/A" : fn || "N/A",
    lastName:    isPlaceholder ? "N/A" : ln || "N/A",
    email:       String(r.EmailAddress || "").trim() || "N/A",
    mobilePhone: String(r.MobilePhone  || "").trim() || "N/A",
  };
}

/* ── Route ──────────────────────────────────────────── */
app.post("/api/plate-lookup", async (req, res) => {
  const plate = String(req.body?.plate || "").trim().toUpperCase();

  if (!plate || !PLATE_REGEX.test(plate)) {
    return res.status(400).json({ error: "Invalid plate. Use letters, numbers, or dashes (4–12 chars)." });
  }

  try {
    const data    = await lookupByPlate(plate);
    const profile = sanitize(data);
    return res.json({ plate, profile });
  } catch (err) {
    console.error("Lookup error:", err.message);
    return res.status(500).json({ error: "Lookup failed." });
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
