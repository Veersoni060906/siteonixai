(() => {
  const prefersReduced = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;

  const startBtn = document.getElementById("startBtn");
  const demoBtn = document.getElementById("demoBtn");

  const SAMPLE_PROMPTS = [
    "Modern barber shop in Toronto — hero, services, booking CTA, testimonials, pricing",
    "Luxury real estate agent in Miami — listings showcase, contact form, about section",
    "Artisan coffee shop in Brooklyn — menu, atmosphere gallery, online ordering, hours",
    "Independent yoga studio — class schedule, instructors, membership plans, contact",
    "SaaS startup landing page — product demo, features, pricing tiers, free trial CTA",
  ];

  function setStarterPrompt(prompt) {
    try { localStorage.setItem("siteonix:lastPrompt", prompt); } catch {}
  }

  demoBtn?.addEventListener("click", () => {
    const prompt = SAMPLE_PROMPTS[Math.floor(Math.random() * SAMPLE_PROMPTS.length)];
    setStarterPrompt(prompt);
    window.location.href = "builder.html";
  });

  // Animate numbers on scroll
  function animateNum(el, target, suffix = "") {
    const duration = 1400;
    const start = performance.now();
    const isDecimal = String(target).includes(".");

    function update(now) {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const val = isDecimal ? (target * eased).toFixed(1) : Math.round(target * eased);
      el.textContent = (suffix === "$" ? "$" : "") + (suffix === "K+" ? val + "K+" : suffix === "M" ? val + "M+" : val);
      if (t < 1) requestAnimationFrame(update);
    }
    requestAnimationFrame(update);
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const nums = entry.target.querySelectorAll(".proof-num");
        nums.forEach(el => {
          const text = el.textContent;
          if (text.includes("K")) animateNum(el, 15, "K+");
          else if (text.includes("M")) animateNum(el, 2.3, "M");
        });
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.5 });

  const proofRow = document.querySelector(".hero-proof");
  if (proofRow) observer.observe(proofRow);

})();