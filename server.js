#!/usr/bin/env node
/**
 * Siteonix AI — Local Proxy Server
 * Runs on http://localhost:3000
 * Proxies /api/generate → api.anthropic.com/v1/messages
 *
 * Usage:
 *   ANTHROPIC_API_KEY=sk-ant-... node server.js
 *
 * No npm install needed — uses only Node.js built-ins.
 */

const http  = require("http");
const https = require("https");
const fs    = require("fs");
const path  = require("path");
const url   = require("url");

const PORT    = process.env.PORT || 3000;
const API_KEY = process.env.ANTHROPIC_API_KEY || "";

if (!API_KEY) {
  console.warn("\n⚠  ANTHROPIC_API_KEY is not set.");
  console.warn("   Set it before starting: ANTHROPIC_API_KEY=sk-ant-... node server.js\n");
}

// ── MIME types for static file serving ───────────────────────
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css":  "text/css; charset=utf-8",
  ".js":   "application/javascript; charset=utf-8",
  ".json": "application/json",
  ".png":  "image/png",
  ".svg":  "image/svg+xml",
  ".ico":  "image/x-icon",
};

// ── Collect request body ──────────────────────────────────────
function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", c => chunks.push(c));
    req.on("end",  () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

// ── Proxy to Anthropic ────────────────────────────────────────
function proxyToAnthropic(body, res) {
  const options = {
    hostname: "api.anthropic.com",
    path:     "/v1/messages",
    method:   "POST",
    headers: {
      "Content-Type":      "application/json",
      "x-api-key":         API_KEY,
      "anthropic-version": "2023-06-01",
      "Content-Length":    Buffer.byteLength(body),
    },
  };

  const proxy = https.request(options, upstream => {
    res.writeHead(upstream.statusCode, {
      "Content-Type":                "application/json",
      "Access-Control-Allow-Origin": "*",
    });
    upstream.pipe(res);
  });

  proxy.on("error", err => {
    console.error("[proxy error]", err.message);
    res.writeHead(502, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: err.message }));
  });

  proxy.write(body);
  proxy.end();
}

// ── Static file handler ───────────────────────────────────────
function serveStatic(reqPath, res) {
  // Default to index.html
  if (reqPath === "/" || reqPath === "") reqPath = "/index.html";

  const filePath = path.join(__dirname, reqPath);

  // Security: don't serve outside project dir
  if (!filePath.startsWith(__dirname)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not found: " + reqPath);
      return;
    }
    const ext  = path.extname(filePath).toLowerCase();
    const mime = MIME[ext] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": mime });
    res.end(data);
  });
}

// ── HTTP server ───────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url);
  const pathname = parsed.pathname;

  // CORS preflight
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin":  "*",
      "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    res.end();
    return;
  }

  // API proxy endpoint
  if (pathname === "/api/generate" && req.method === "POST") {
    if (!API_KEY) {
      res.writeHead(500, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
      res.end(JSON.stringify({ error: "ANTHROPIC_API_KEY not set on server." }));
      return;
    }

    try {
      const body = await readBody(req);
      console.log(`[${new Date().toISOString()}] /api/generate — prompt length: ${body.length}`);
      proxyToAnthropic(body, res);
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // Static files
  serveStatic(pathname, res);
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`\n✅ Siteonix AI running at http://localhost:${PORT}`);
  console.log(`   Open → http://localhost:${PORT}/index.html`);
  console.log(`   Builder → http://localhost:${PORT}/builder.html`);
  console.log(`   API key: ${API_KEY ? "✓ set" : "✗ MISSING — set ANTHROPIC_API_KEY"}\n`);
});