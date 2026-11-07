require("dotenv").config();

const express = require("express");
const axios = require("axios");
const session = require("express-session");
const rateLimit = require("express-rate-limit");
const path = require("path");

const app = express();
const PORT = Number(process.env.PORT || 3000);

if (!process.env.API_KEY || !process.env.ADMIN_PASSWORD || !process.env.SESSION_SECRET) {
  console.error("Missing API_KEY, ADMIN_PASSWORD, or SESSION_SECRET in .env");
  process.exit(1);
}

app.disable("x-powered-by");
app.use(express.json({ limit: "20kb" }));
app.use(express.urlencoded({ extended: false, limit: "20kb" }));

app.use(session({
  name: "jamdanish.sid",
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 8 * 60 * 60 * 1000
  }
}));

app.use(express.static(path.join(__dirname, "public")));

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many login attempts. Try again later." }
});

const api = axios.create({
  baseURL: process.env.API_URL || "https://officialclicks.com/api/v2",
  timeout: 20000,
  headers: { "Content-Type": "application/x-www-form-urlencoded" }
});

function requireLogin(req, res, next) {
  if (!req.session.loggedIn) {
    return res.status(401).json({ error: "Please login first." });
  }
  next();
}

async function providerRequest(params) {
  const body = new URLSearchParams({
    key: process.env.API_KEY,
    ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)]))
  });

  const response = await api.post("", body.toString());
  const data = response.data;

  if (data && !Array.isArray(data) && data.error) {
    throw new Error(String(data.error));
  }
  return data;
}

app.post("/api/login", loginLimiter, (req, res) => {
  const password = String(req.body.password || "");
  if (password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: "Incorrect password." });
  }

  req.session.regenerate((err) => {
    if (err) return res.status(500).json({ error: "Could not start session." });
    req.session.loggedIn = true;
    res.json({ success: true });
  });
});

app.get("/api/me", (req, res) => {
  res.json({ loggedIn: Boolean(req.session.loggedIn) });
});

app.post("/api/logout", requireLogin, (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("jamdanish.sid");
    res.json({ success: true });
  });
});

app.get("/api/services", requireLogin, async (req, res) => {
  try {
    res.json(await providerRequest({ action: "services" }));
  } catch (err) {
    console.error("Services API error:", err.message);
    res.status(502).json({ error: "Could not load services. Check API details and key." });
  }
});

app.get("/api/balance", requireLogin, async (req, res) => {
  try {
    res.json(await providerRequest({ action: "balance" }));
  } catch (err) {
    console.error("Balance API error:", err.message);
    res.status(502).json({ error: "Could not load balance. Check API details and key." });
  }
});

app.post("/api/order", requireLogin, async (req, res) => {
  const service = Number(req.body.service);
  const quantity = Number(req.body.quantity);
  const link = String(req.body.link || "").trim();

  if (!Number.isInteger(service) || service < 1) {
    return res.status(400).json({ error: "Enter a valid service ID." });
  }
  if (!Number.isInteger(quantity) || quantity < 1) {
    return res.status(400).json({ error: "Enter a valid whole-number quantity." });
  }

  let parsed;
  try {
    parsed = new URL(link);
  } catch {
    return res.status(400).json({ error: "Enter a valid post/profile URL." });
  }
  if (!["http:", "https:"].includes(parsed.protocol)) {
    return res.status(400).json({ error: "Only HTTP/HTTPS links are allowed." });
  }

  try {
    const data = await providerRequest({
      action: "add",
      service,
      link,
      quantity
    });
    res.json(data);
  } catch (err) {
    console.error("Order API error:", err.message);
    res.status(502).json({ error: "Order could not be submitted. Check provider response and service limits." });
  }
});

app.get("/api/order/:id", requireLogin, async (req, res) => {
  const orderId = String(req.params.id || "").trim();
  if (!/^[0-9]+$/.test(orderId)) {
    return res.status(400).json({ error: "Enter a numeric order ID." });
  }

  try {
    res.json(await providerRequest({ action: "status", order: orderId }));
  } catch (err) {
    console.error("Order status API error:", err.message);
    res.status(502).json({ error: "Could not fetch order status." });
  }
});

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`JAM DANISH SMM running at http://localhost:${PORT}`);
});
