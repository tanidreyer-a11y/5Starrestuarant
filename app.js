(() => {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const WHATSAPP_DEMO = "27000000000";
  const CUTS = [
    { id: "ribeye", name: "Ribeye", note: "Rich, marbled, forgiving. The cut that tastes most of the fire.", pair: "Pairs with a structured Cabernet." },
    { id: "fillet", name: "Fillet", note: "Tender and quiet. Cooked gently, seasoned with salt and little else.", pair: "Pairs with a soft Pinot Noir." },
    { id: "tbone", name: "T-bone", note: "Two textures on one bone: a firm strip and a tender fillet, shared or not.", pair: "Pairs with a peppery Syrah." },
    { id: "sirloin", name: "Sirloin on the bone", note: "A thick cap of fat and a deep, mineral finish. For slow eaters.", pair: "Pairs with an aged Bordeaux blend." },
  ];
  gsap.registerPlugin(ScrollTrigger);

  /* Ghost cursor: coal glow. Soft glows don't need resolution, so it renders at half size;
     it pauses behind the hero film, in hidden tabs, and paints once on touch screens. */
  const ghost = (() => {
    const c = $("#ghost"), x = c.getContext("2d");
    const fine = matchMedia("(hover: hover) and (pointer: fine)");
    const RES = 0.5;
    let w = innerWidth, h = innerHeight; const size = () => { w = innerWidth; h = innerHeight; c.width = Math.ceil(w * RES); c.height = Math.ceil(h * RES); x.setTransform(RES, 0, 0, RES, 0, 0); if (!live) paint(); };
    let live = false, paused = true, raf = 0;
    const tgt = { x: w * .5, y: h * .5 }, head = { ...tgt }, lag = { ...tgt }; let trail = [], lastPush = { ...tgt }, lastMove = 0, prev = performance.now();
    const glow = (px, py, r, rgb, a) => { const g = x.createRadialGradient(px, py, 0, px, py, r); g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(1, `rgba(${rgb},0)`); x.fillStyle = g; x.fillRect(px - r, py - r, r * 2, r * 2); };
    const paint = () => { x.clearRect(0, 0, w, h); x.globalCompositeOperation = "lighter"; glow(lag.x, lag.y, Math.max(320, w * .24), "142,42,18", .22); trail.forEach(p => glow(p.x, p.y, 60 + 120 * p.life, "226,87,43", .07 * p.life)); glow(head.x, head.y, 200, "226,87,43", .18); x.globalCompositeOperation = "source-over"; };
    const frame = now => {
      const dt = Math.min(.1, (now - prev) / 1e3); prev = now;
      if (now - lastMove > 2400 || !fine.matches) { const t = now / 1e3; tgt.x = w * (.5 + .28 * Math.sin(t * .21)); tgt.y = h * (.5 + .22 * Math.cos(t * .17)); }
      head.x += (tgt.x - head.x) * Math.min(1, dt * 9); head.y += (tgt.y - head.y) * Math.min(1, dt * 9);
      lag.x += (tgt.x - lag.x) * Math.min(1, dt * 2.6); lag.y += (tgt.y - lag.y) * Math.min(1, dt * 2.6);
      if (Math.hypot(head.x - lastPush.x, head.y - lastPush.y) > 26) { trail.push({ x: head.x, y: head.y, life: 1 }); lastPush = { x: head.x, y: head.y }; if (trail.length > 16) trail.shift(); }
      trail.forEach(p => p.life -= dt / .95); trail = trail.filter(p => p.life > 0);
      paint(); raf = paused ? 0 : requestAnimationFrame(frame);
    };
    size();
    addEventListener("resize", size);
    live = !reduce && fine.matches;
    if (!live) { head.x = lag.x = w * .5; head.y = lag.y = h * .5; paint(); return { pause() {}, resume() {} }; }
    addEventListener("pointermove", e => { if (e.pointerType === "touch") return; tgt.x = e.clientX; tgt.y = e.clientY; lastMove = performance.now(); }, { passive: true });
    const api = {
      pause() { paused = true; cancelAnimationFrame(raf); raf = 0; },
      resume() { if (!paused || document.hidden) return; paused = false; prev = performance.now(); raf = requestAnimationFrame(frame); },
    };
    document.addEventListener("visibilitychange", () => (document.hidden ? api.pause() : api.resume()));
    return api;
  })();

  /* Hero film: a 160-frame image sequence painted to a canvas. Frames load in passes (every 32nd,
     16th, 8th ...), so the scrub works after about 1 MB and sharpens as the rest arrives. No video
     decoder means no seek stutter on slow lines and no iOS media quirks. Portrait screens get a
    portrait-cropped 540x960 set, landscape screens a 1280x720 set. */
  (() => {
    const film = $("#film"), bands = $$(".band");
    const ghostEl = $("#ghost");
    const setGhost = active => { ghostEl.classList.toggle("off", active); active ? ghost.pause() : ghost.resume(); };
    const filmSeen = ScrollTrigger.create({ trigger: film, start: "top bottom", end: "bottom top", onToggle: s => setGhost(s.isActive) });
    requestAnimationFrame(() => setGhost(filmSeen.isActive));
    if (reduce) return;
    const loader = $("#loader"), arc = $("#loaderArc"), pct = $("#loaderPct");
    const small = matchMedia("(max-aspect-ratio: 1/1)").matches;
    const canvas = $("#filmCanvas"), ctx = canvas.getContext("2d", { alpha: false }), poster = $(".film-poster");
    const N = 160, dir = small ? "m" : "d", MAX = 8;
    const frames = new Array(N); let settled = 0, failed = 0, drawn = -1;
    let shownPct = -1;
    const progress = p => { const v = Math.round(p * 100); if (v === shownPct) return; shownPct = v; arc.style.strokeDashoffset = 100 - v; pct.textContent = v + "%"; loader.setAttribute("aria-valuenow", v); };
    const finish = () => { progress(1); loader.classList.add("done"); };
    setTimeout(finish, 30000);

    const order = [0, N - 1]; const seen = new Set(order);
    [32, 16, 8, 4, 2, 1].forEach(s => { for (let i = 0; i < N; i += s) if (!seen.has(i)) { seen.add(i); order.push(i); } });
    const url = i => `assets/frames/${dir}/${String(i).padStart(3, "0")}.webp`;
    let cursor = 0, inflight = 0;
    const pump = () => {
      while (inflight < MAX && cursor < order.length) {
        const i = order[cursor++], img = new Image(); inflight++;
        img.decoding = "async"; img.src = url(i);
        img.decode().then(() => { frames[i] = img; }, () => { failed++; }).finally(() => {
          inflight--; settled++; progress(settled / N);
          if (settled === N) finish();
          if (failed === N) { canvas.style.display = "none"; $(".static-hero").style.display = "block"; }
          draw(); pump();
        });
      }
    };

    const fit = () => {
      const r = canvas.getBoundingClientRect(), frameW = small ? 540 : 1280, frameH = small ? 960 : 720;
      const cover = Math.max(r.width / frameW, r.height / frameH);
      const d = Math.min(devicePixelRatio || 1, 1 / cover);
      canvas.width = Math.max(1, Math.round(r.width * d)); canvas.height = Math.max(1, Math.round(r.height * d));
      drawn = -1; draw();
    };
    const draw = () => {
      const want = Math.round(shown * (N - 1)); let k = -1;
      for (let o = 0; o < N && k < 0; o++) { if (frames[want - o]) k = want - o; else if (frames[want + o]) k = want + o; }
      if (k < 0 || k === drawn) return;
      const img = frames[k], cw = canvas.width, ch = canvas.height, s = Math.max(cw / img.naturalWidth, ch / img.naturalHeight);
      const dw = img.naturalWidth * s, dh = img.naturalHeight * s;
      ctx.drawImage(img, (cw - dw) / 2, (ch - dh) / 2, dw, dh); drawn = k;
      if (poster) poster.style.visibility = "hidden";
    };
    let resizeRaf = 0; addEventListener("resize", () => { cancelAnimationFrame(resizeRaf); resizeRaf = requestAnimationFrame(fit); });

    let target = 0, shown = 0, running = false, last = performance.now();
    const cache = bands.map(() => -1);
    const ss = t => t * t * (3 - 2 * t);
    const bandOpacity = (p, a, b, first, lastBand) => {
      const f = Math.min(.04, (b - a) / 3);
      const inn = first ? 1 : ss(Math.min(1, Math.max(0, (p - a) / f)));
      const out = lastBand ? 1 : ss(Math.min(1, Math.max(0, (b - p) / f)));
      return p < a || p > b ? 0 : Math.min(inn, out);
    };
    const setBands = p => bands.forEach((el, i) => {
      const o = bandOpacity(p, +el.dataset.a, +el.dataset.b, i === 0, i === bands.length - 1);
      const r = Math.round(o * 100) / 100; if (r === cache[i]) return; cache[i] = r;
      el.style.opacity = r; el.classList.toggle("is-on", r > .5);
    });
    const tick = now => {
      const dt = Math.min(100, now - last); last = now;
      shown += (target - shown) * (1 - Math.pow(1 - .17, dt / 16.667));
      if (Math.abs(target - shown) < .0004) shown = target;
      draw(); setBands(shown);
      if (running || shown !== target) requestAnimationFrame(tick);
    };
    fit(); pump();
    ScrollTrigger.create({
      trigger: film, start: "top top", end: "bottom bottom",
      onUpdate: s => { target = s.progress; },
      onToggle: s => { running = s.isActive; if (running) { last = performance.now(); requestAnimationFrame(tick); } },
    });
    setBands(0);
  })();

  /* Statement: words light as you read */
  (() => {
    const p = $(".reveal-words"); const words = p.textContent.trim().split(/\s+/);
    p.setAttribute("aria-label", words.join(" ")); p.textContent = "";
    const spans = words.map(w => { const s = document.createElement("span"); s.className = "wd"; s.setAttribute("aria-hidden", "true"); s.textContent = w; p.append(s, " "); return s; });
    if (reduce) return;
    let on = -1;
    ScrollTrigger.create({ trigger: p, start: "top 82%", end: "bottom 52%", onUpdate: s => { const n = Math.ceil(s.progress * spans.length); if (n === on) return; on = n; spans.forEach((el, i) => el.classList.toggle("on", i < n)); } });
  })();

  /* Settle helper: pin distances depend on final layout, so build after fonts and two frames, then refresh. */
  const settle = fn => {
    let done = false;
    const go = () => { if (done) return; done = true; requestAnimationFrame(() => requestAnimationFrame(fn)); };
    document.fonts && document.fonts.ready ? document.fonts.ready.then(go) : go();
    setTimeout(go, 1200);
    addEventListener("load", () => setTimeout(() => ScrollTrigger.refresh(), 300));
  };

  /* Beam borders repaint every frame, so they only spin while on screen */
  const beamIO = new IntersectionObserver(es => es.forEach(e => e.target.classList.toggle("live", e.isIntersecting)));
  const watchBeams = () => $$(".beam:not([data-watched])").forEach(b => { b.dataset.watched = "1"; beamIO.observe(b); });
  watchBeams(); new MutationObserver(watchBeams).observe(document.body, { childList: true, subtree: true });

  /* Image reveals: each section gets its own treatment (CSS), triggered once on entry */
  (() => {
    if (reduce) return;
    const els = [".statement", ".split-ageing", ".split-cellar", ".reserve-copy"].map(s => $(s)).filter(Boolean);
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), { threshold: 0.25 });
    els.forEach(el => { el.classList.add("rv"); io.observe(el); });
    gsap.fromTo(".flames-frame img", { yPercent: -8 }, { yPercent: 8, ease: "none", scrollTrigger: { trigger: ".flames", start: "top bottom", end: "bottom top", scrub: true } });
  })();

  /* Sticky horizontal gallery */
  (() => {
    const g = $("#cuts"), track = $("#track"), bar = $("#trackBar");
    if (reduce) { g.classList.add("static"); return; }
    g.classList.add("armed");
    const io = new IntersectionObserver(es => es.forEach(e => e.isIntersecting && e.target.classList.add("in")), { threshold: .3 });
    $$(".cut", track).forEach(c => io.observe(c));
    const dist = () => Math.max(0, track.scrollWidth - innerWidth);
    settle(() => {
      if (dist() <= 0) return;
      gsap.to(track, { x: () => -dist(), ease: "none", scrollTrigger: { trigger: g, start: "top top", end: () => `+=${dist()}`, pin: true, scrub: true, anticipatePin: 1, invalidateOnRefresh: true, onUpdate: s => { bar.style.transform = `scaleX(${s.progress})`; } } });
    });
  })();

  /* Choose your cut */
  const chips = $("#chips"); let chosen = "undecided";
  (() => {
    const field = $("#field"), svg = $(".choose-lines"), summary = $("#summary");
    const pts = CUTS.map((c, i) => { const a = (-135 + i * 90) * Math.PI / 180; return { c, x: 50 + 37 * Math.cos(a), y: 50 + 37 * Math.sin(a) }; });
    const NS = "http://www.w3.org/2000/svg";
    const lines = pts.map(p => { const l = document.createElementNS(NS, "line"); l.setAttribute("x1", 50); l.setAttribute("y1", 50); l.setAttribute("x2", p.x); l.setAttribute("y2", p.y); l.setAttribute("pathLength", 1); l.style.strokeDasharray = 1; svg.append(l); return l; });
    const nodes = pts.map(p => { const s = document.createElement("div"); s.className = "node-slot"; s.style.left = p.x + "%"; s.style.top = p.y + "%"; const b = document.createElement("button"); b.type = "button"; b.className = "node"; b.setAttribute("aria-pressed", "false"); b.textContent = p.c.name; s.append(b); field.append(s); return b; });
    const pick = i => {
      const c = CUTS[i]; chosen = c.id;
      nodes.forEach((n, j) => n.setAttribute("aria-pressed", String(j === i))); lines.forEach((l, j) => l.classList.toggle("sel", j === i));
      summary.textContent = "";
      const h = document.createElement("h2"); h.textContent = c.name;
      const p1 = document.createElement("p"); p1.textContent = c.note;
      const p2 = document.createElement("p"); p2.textContent = c.pair;
      const a = document.createElement("a"); a.className = "beam"; a.href = "#reserve"; a.textContent = "Reserve with this cut";
      a.addEventListener("click", () => syncChip(c.id));
      summary.append(h, p1, p2, a);
    };
    nodes.forEach((n, i) => n.addEventListener("click", () => pick(i)));
    if (reduce) return;
    settle(() => {
      const tl = gsap.timeline({ defaults: { ease: "none" }, scrollTrigger: { trigger: "#choose", start: "top top", end: "+=150%", pin: true, scrub: true, anticipatePin: 1, invalidateOnRefresh: true } });
      tl.fromTo(".choose-bg img", { scale: 1.18 }, { scale: 1, duration: 1 }, 0)
        .fromTo(".choose-core", { scale: .4 }, { scale: 1, duration: 1 }, 0)
        .fromTo(".choose-halo", { scale: .3, opacity: .2 }, { scale: 1, opacity: 1, duration: 1 }, 0)
        .fromTo(lines, { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: .5, stagger: .12 }, .25)
        .fromTo(".node-slot", { scale: .55, opacity: .25 }, { scale: 1, opacity: 1, duration: .4, stagger: .12 }, .3);
    });
  })();

  /* Reserve form */
  (() => {
    const all = [...CUTS.map(c => ({ id: c.id, label: c.name })), { id: "undecided", label: "Not decided" }];
    all.forEach(o => {
      const l = document.createElement("label"); l.className = "chip";
      const i = document.createElement("input"); i.type = "radio"; i.name = "cut"; i.value = o.id; i.checked = o.id === "undecided";
      const s = document.createElement("span"); s.textContent = o.label; l.append(i, s); chips.append(l);
      i.addEventListener("change", () => { chosen = o.id; });
    });
    const d = $("#date"); const t = new Date(); t.setDate(t.getDate() + 1); d.min = d.value = t.toISOString().slice(0, 10);
    $("#form").addEventListener("submit", e => {
      e.preventDefault();
      const name = $("#name"), err = $("#nameErr"); const bad = !name.value.trim();
      name.setAttribute("aria-invalid", String(bad)); err.hidden = !bad; name.setAttribute("aria-describedby", bad ? "nameErr" : "");
      if (bad) { name.focus(); return; }
      const cut = (all.find(o => o.id === chosen) || {}).label;
      const msg = `Hi Vuurhuis (concept demo), booking request.\nName: ${name.value.trim()}\nDate: ${d.value}\nGuests: ${$("#guests").value}\nCut: ${cut}\n${$("#note").value.trim()}`.trim();
      $("#sent").hidden = false;
      window.open(`https://wa.me/${WHATSAPP_DEMO}?text=${encodeURIComponent(msg)}`, "_blank", "noopener");
    });
  })();
  function syncChip(id) { chosen = id; const i = $(`#chips input[value="${id}"]`); if (i) i.checked = true; }
})();
