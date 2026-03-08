# Siteonix AI

AI-powered landing page builder — describe a business, get production-ready HTML in seconds.

---

## Why a server is needed

Browsers block direct calls to `api.anthropic.com` from local files (`file://` origin).
The included `server.js` proxies requests through Node.js where there are no CORS restrictions.

---

## Setup (2 steps)

### 1. Get your Anthropic API key
Go to https://console.anthropic.com → API Keys → Create key  
Copy the key (starts with `sk-ant-...`)

### 2. Start the server

**Mac / Linux:**
```bash
ANTHROPIC_API_KEY=sk-ant-YOUR_KEY_HERE node server.js
```

**Windows (Command Prompt):**
```cmd
set ANTHROPIC_API_KEY=sk-ant-YOUR_KEY_HERE
node server.js
```

**Windows (PowerShell):**
```powershell
$env:ANTHROPIC_API_KEY="sk-ant-YOUR_KEY_HERE"
node server.js
```

Then open your browser to: **http://localhost:3000**

---

## Requirements

- Node.js 16+ (https://nodejs.org)
- An Anthropic API key
- No npm install needed — uses only Node.js built-in modules

---

## Files

| File | Purpose |
|------|---------|
| `server.js` | Local proxy + static file server |
| `index.html` | Landing / home page |
| `builder.html` | The AI builder UI |
| `builder.js` | Builder logic (calls `/api/generate`) |
| `home.js` | Home page animations |
| `styles.css` | Shared styles |

---

## How it works

1. User types a prompt in the Builder
2. `builder.js` sends a POST to `http://localhost:3000/api/generate`
3. `server.js` forwards that request to `api.anthropic.com` with your API key
4. Claude generates a complete HTML landing page
5. The page renders live in the preview iframe

---

## Deploying to production

To host this publicly, you'll need a server environment that can run Node.js and store your API key as an environment variable. Options:

- **Railway** — `railway up` (add `ANTHROPIC_API_KEY` in dashboard)
- **Render** — connect GitHub repo, set env var in dashboard  
- **Fly.io** — `fly deploy` with secrets
- **VPS** — any Linux server with Node.js

Do **not** commit your API key to git. Always use environment variables.