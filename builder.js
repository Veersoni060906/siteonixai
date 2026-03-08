/* =============================================================
   Siteonix AI Builder — builder.js
   Calls Claude API to generate real, tailored landing pages.
============================================================= */

(() => {
  // ── DOM refs ──────────────────────────────────────────────
  const $ = id => document.getElementById(id);

  const stateIdle       = $("stateIdle");
  const stateGenerating = $("stateGenerating");
  const stateDone       = $("stateDone");

  const promptIdle  = $("promptIdle");
  const promptDone  = $("promptDone");

  const generateBtn = $("generateBtn");
  const regenBtn    = $("regenBtn");
  const resetBtn    = $("resetBtn");
  const cancelBtn   = $("cancelBtn");
  const exportBtn   = $("exportBtn");

  const genLabel  = $("genLabel");
  const genPct    = $("genPct");
  const genBar    = $("genBar");
  const stepsList = $("stepsList");

  const genOverlay  = $("genOverlay");
  const orbStatus   = $("orbStatus");
  const previewFrame = $("previewFrame");
  const previewEmpty = $("previewEmpty");

  const codePanel  = $("codePanel");
  const codeOutput = $("codeOutput");
  const copyCodeBtn = $("copyCodeBtn");
  const applyCodeBtn = $("applyCodeBtn");
  const copyBtn    = $("copyBtn");

  const previewTab = $("previewTab");
  const codeTab    = $("codeTab");

  const desktopBtn = $("desktopBtn");
  const tabletBtn  = $("tabletBtn");
  const mobileBtn  = $("mobileBtn");
  const fullBtn    = $("fullBtn");

  const imgToggle  = $("imgToggle");

  const historyList     = $("historyList");
  const idleHistory     = $("idleHistory");
  const idleHistoryList = $("idleHistoryList");

  // ── Storage keys ──────────────────────────────────────────
  const LS = {
    PROMPT:  "siteonix:lastPrompt",
    HTML:    "siteonix:lastHtml",
    HISTORY: "siteonix:promptHistory",
    IMG:     "siteonix:imgToggle",
    DEVICE:  "siteonix:device",
    TAB:     "siteonix:tab",
  };

  // ── State ─────────────────────────────────────────────────
  let currentState = "idle";
  let canceled     = false;
  let genAbort     = null;

  const STEPS = [
    "Analyzing your request…",
    "Planning page structure…",
    "Designing the hero section…",
    "Building feature blocks…",
    "Adding testimonials & pricing…",
    "Writing styled components…",
    "Polishing layout & typography…",
    "Finalizing your page…",
  ];

  // ── Utilities ─────────────────────────────────────────────
  function ls_get(key) { try { return localStorage.getItem(key) || ""; } catch { return ""; } }
  function ls_set(key, val) { try { localStorage.setItem(key, val); } catch {} }

  function getHistory() {
    try { const v = localStorage.getItem(LS.HISTORY); return v ? JSON.parse(v) : []; } catch { return []; }
  }
  function pushHistory(prompt) {
    const p = prompt.trim(); if (!p) return;
    const h = getHistory().filter(x => x !== p);
    h.unshift(p);
    ls_set(LS.HISTORY, JSON.stringify(h.slice(0, 10)));
  }

  // ── State machine ─────────────────────────────────────────
  function setState(s) {
    currentState = s;
    [stateIdle, stateGenerating, stateDone].forEach(el => el?.classList.remove("active"));
    const map = { idle: stateIdle, generating: stateGenerating, done: stateDone };
    map[s]?.classList.add("active");

    const isGen = s === "generating";
    if (genOverlay)  genOverlay.classList.toggle("visible", isGen);
  }

  // ── Preview / Code tab ────────────────────────────────────
  function setTab(tab) {
    ls_set(LS.TAB, tab);
    const isPreview = tab === "preview";

    previewTab?.classList.toggle("active", isPreview);
    codeTab?.classList.toggle("active", !isPreview);

    if (codePanel)   codePanel.classList.toggle("visible", !isPreview);
    if (previewFrame && previewFrame.srcdoc) {
      previewFrame.style.display = isPreview ? "block" : "none";
    }
    if (copyBtn) copyBtn.style.display = isPreview ? "none" : "inline-flex";
  }

  // ── Device mode ───────────────────────────────────────────
  function setDevice(mode) {
    ls_set(LS.DEVICE, mode);
    [desktopBtn, tabletBtn, mobileBtn].forEach(b => b?.classList.remove("active"));
    const map = { desktop: desktopBtn, tablet: tabletBtn, mobile: mobileBtn };
    map[mode]?.classList.add("active");

    if (!previewFrame) return;
    if (mode === "desktop") {
      previewFrame.style.width = "100%";
      previewFrame.style.transformOrigin = "top left";
      previewFrame.style.transform = "none";
    } else if (mode === "tablet") {
      previewFrame.style.width = "768px";
      previewFrame.style.transformOrigin = "top center";
      previewFrame.style.transform = "none";
    } else {
      previewFrame.style.width = "390px";
      previewFrame.style.transformOrigin = "top center";
      previewFrame.style.transform = "none";
    }
  }

  // ── Render steps ──────────────────────────────────────────
  function renderSteps(activeIdx) {
    if (!stepsList) return;
    stepsList.innerHTML = STEPS.map((label, i) => {
      const cls = i < activeIdx ? "step-done" : i === activeIdx ? "step-active" : "";
      return `<div class="step-row ${cls}">
        <div class="step-bullet"></div>
        <span>${label}</span>
      </div>`;
    }).join("");
  }

  // ── History render ────────────────────────────────────────
  function renderHistory() {
    const h = getHistory();

    // Done panel history
    if (historyList) {
      historyList.innerHTML = h.length
        ? h.map(p => `<div class="history-entry" title="${p}">${p}</div>`).join("")
        : `<div style="font-size:13px;color:var(--ink-muted)">No history yet.</div>`;

      historyList.querySelectorAll(".history-entry").forEach((el, i) => {
        el.addEventListener("click", () => handleGenerate(h[i]));
      });
    }

    // Idle panel history
    if (idleHistory && idleHistoryList) {
      if (h.length) {
        idleHistory.style.display = "block";
        idleHistoryList.innerHTML = h.slice(0, 3).map(p =>
          `<div class="history-entry" title="${p}">${p}</div>`
        ).join("");
        idleHistoryList.querySelectorAll(".history-entry").forEach((el, i) => {
          el.addEventListener("click", () => handleGenerate(h[i]));
        });
      }
    }
  }

  // ── Set preview HTML ──────────────────────────────────────
  function setPreview(html) {
    if (!previewFrame) return;
    previewFrame.removeAttribute("src");
    previewFrame.srcdoc = html;
    previewFrame.style.display = "block";
    if (previewEmpty) previewEmpty.style.display = "none";
    if (codeOutput) codeOutput.value = html;
    if (exportBtn) exportBtn.style.display = "inline-flex";
    if (copyBtn)   copyBtn.style.display = currentState === "done" ? "none" : "none"; // shown in code tab
  }

  // ── Claude API call ───────────────────────────────────────
  async function callClaude(prompt, withImages) {
    const systemPrompt = `You are an expert web designer and developer. Generate a complete, single-file HTML landing page.

REQUIREMENTS:
- Return ONLY the complete HTML. No markdown, no explanation, no code fences.
- Start with <!DOCTYPE html> and end with </html>
- Include all CSS in a <style> tag inside <head>
- Include interactive JavaScript at the bottom in a <script> tag
- Make it look premium, modern, and conversion-focused
- Use a dark background (#0b0f17 or similar deep dark) with vibrant accent colors
- Include these sections: sticky nav, hero with headline + CTA + stats, features (3-col grid), testimonial, pricing (3 tiers), FAQ (accordion), footer
- All buttons should show toast notifications when clicked (demo mode)
- Anchor links in nav should smooth-scroll to sections
- Make it fully responsive (mobile-first)
- Use Google Fonts — pick one that fits the brand (import via @import in CSS)
- Typography: large, impactful headlines with tight letter-spacing
- ${withImages ? "Include image placeholder divs with gradient backgrounds and labels" : "No image placeholders needed"}
- The page should feel like it was designed by a top agency, not a template

IMPORTANT: Generate content SPECIFIC to the business described. Use real business names, real copy, real pricing that makes sense for that industry. NOT placeholder text.`;

    const userMsg = `Create a complete landing page for: ${prompt}`;

    const resp = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 8000,
        system: systemPrompt,
        messages: [{ role: "user", content: userMsg }],
      }),
    });

    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(`API error ${resp.status}: ${err}`);
    }

    const data = await resp.json();
    const raw = data.content?.map(b => b.text || "").join("") || "";

    // Strip any accidental markdown fences
    const cleaned = raw
      .replace(/^```html\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();

    return cleaned;
  }

  // ── Core generation flow ──────────────────────────────────
  async function handleGenerate(promptOverride) {
    const prompt = (
      promptOverride
      ?? (currentState === "done" ? promptDone?.value : promptIdle?.value)
      ?? ""
    ).trim();

    if (!prompt) return;

    canceled = false;
    if (genAbort) genAbort.abort();
    genAbort = new AbortController();

    setState("generating");

    if (genLabel) genLabel.textContent = `"${prompt.slice(0, 30)}${prompt.length > 30 ? "…" : ""}"`;

    const withImages = !!(imgToggle?.checked);

    // Animate progress bar while waiting for Claude
    let step = 0;
    let pct = 0;
    renderSteps(step);
    if (genPct) genPct.textContent = "0%";
    if (genBar) genBar.style.width = "0%";

    const progressInterval = setInterval(() => {
      if (canceled) return;
      pct = Math.min(pct + (Math.random() * 3 + 1), 85);
      step = Math.min(Math.floor(pct / (100 / STEPS.length)), STEPS.length - 1);
      if (genPct) genPct.textContent = `${Math.floor(pct)}%`;
      if (genBar) genBar.style.width = `${pct}%`;
      renderSteps(step);
      if (orbStatus) orbStatus.textContent = STEPS[step];
    }, 350);

    try {
      const html = await callClaude(prompt, withImages);

      clearInterval(progressInterval);
      if (canceled) return;

      // Final animation to 100%
      if (genPct) genPct.textContent = "100%";
      if (genBar) genBar.style.width = "100%";
      renderSteps(STEPS.length);

      await new Promise(r => setTimeout(r, 400));

      // Save & update UI
      ls_set(LS.PROMPT, prompt);
      ls_set(LS.HTML, html);
      pushHistory(prompt);
      renderHistory();

      setPreview(html);
      setState("done");

      if (promptDone) promptDone.value = prompt;
      if (promptIdle) promptIdle.value = prompt;

      setTab(ls_get(LS.TAB) || "preview");

    } catch (err) {
      clearInterval(progressInterval);
      if (canceled) return;
      console.error("[Siteonix] Generation error:", err);

      // Show error in preview area
      if (previewFrame) {
        previewFrame.srcdoc = `<!DOCTYPE html><html><head><style>
          body { font-family: system-ui; background: #0b0f17; color: #fff; display:grid; place-items:center; height:100vh; margin:0; text-align:center; }
          .err { max-width: 420px; padding: 32px; background: rgba(255,255,255,.05); border-radius: 20px; border: 1px solid rgba(255,255,255,.1); }
          h2 { color: #ff6b6b; margin: 0 0 12px; }
          p { color: rgba(255,255,255,.6); line-height: 1.6; margin: 0; font-size: 14px; }
          code { background: rgba(255,255,255,.08); padding: 2px 6px; border-radius: 4px; font-size: 12px; }
        </style></head><body>
          <div class="err">
            <h2>⚠ Generation failed</h2>
            <p>${String(err.message).replace(/</g,'&lt;')}</p>
            <p style="margin-top:12px;"><code>Check the browser console for details.</code></p>
          </div>
        </body></html>`;
        previewFrame.style.display = "block";
        if (previewEmpty) previewEmpty.style.display = "none";
      }
      setState("idle");
    }
  }

  // ── Event wiring ──────────────────────────────────────────
  generateBtn?.addEventListener("click", () => handleGenerate());
  regenBtn?.addEventListener("click", () => handleGenerate());

  cancelBtn?.addEventListener("click", () => {
    canceled = true;
    genAbort?.abort();
    setState("idle");
  });

  resetBtn?.addEventListener("click", () => {
    setState("idle");
    if (promptIdle && promptDone) promptIdle.value = promptDone.value || "";
  });

  // Cmd/Ctrl+Enter to generate
  [promptIdle, promptDone].forEach(el => {
    el?.addEventListener("keydown", e => {
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleGenerate();
    });
  });

  // Tabs
  previewTab?.addEventListener("click", () => setTab("preview"));
  codeTab?.addEventListener("click", () => setTab("code"));

  // Devices
  desktopBtn?.addEventListener("click", () => setDevice("desktop"));
  tabletBtn?.addEventListener("click", () => setDevice("tablet"));
  mobileBtn?.addEventListener("click", () => setDevice("mobile"));

  fullBtn?.addEventListener("click", () => {
    const el = document.getElementById("previewWrapper");
    el?.requestFullscreen?.();
  });

  // Copy / Apply code
  copyCodeBtn?.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(codeOutput?.value || "");
      const old = copyCodeBtn.textContent;
      copyCodeBtn.textContent = "Copied!";
      setTimeout(() => copyCodeBtn.textContent = old, 1200);
    } catch {}
  });

  copyBtn?.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(codeOutput?.value || "");
      const old = copyBtn.textContent;
      copyBtn.textContent = "Copied!";
      setTimeout(() => copyBtn.textContent = old, 1200);
    } catch {}
  });

  applyCodeBtn?.addEventListener("click", () => {
    const html = codeOutput?.value?.trim();
    if (!html) return;
    setPreview(html);
    ls_set(LS.HTML, html);
    setTab("preview");
  });

  // Export
  exportBtn?.addEventListener("click", () => {
    const html = codeOutput?.value || ls_get(LS.HTML);
    if (!html) return;
    const blob = new Blob([html], { type: "text/html" });
    const url  = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "siteonix-page.html";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  });

  // imgToggle persistence
  imgToggle?.addEventListener("change", () => {
    ls_set(LS.IMG, imgToggle.checked ? "1" : "0");
  });

  // ── Init ──────────────────────────────────────────────────
  function init() {
    const savedTab    = ls_get(LS.TAB)    || "preview";
    const savedDevice = ls_get(LS.DEVICE) || "desktop";
    const savedImg    = ls_get(LS.IMG);
    const savedPrompt = ls_get(LS.PROMPT);
    const savedHtml   = ls_get(LS.HTML);

    if (imgToggle) imgToggle.checked = savedImg !== "0";

    setTab(savedTab);
    setDevice(savedDevice);
    renderHistory();

    if (savedHtml) {
      setPreview(savedHtml);
      setState("done");
      if (promptDone) promptDone.value = savedPrompt;
      if (promptIdle) promptIdle.value = savedPrompt;
    } else {
      setState("idle");
      if (promptIdle) promptIdle.value = savedPrompt;
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

})();