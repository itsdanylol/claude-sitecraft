// rings.js — cup rings drawn from the tasting log. Each steep leaves a ring:
// temperature sets how dark the stain dries, steep time sets how wide its edge is.
// Steam drifts above the cup and leans toward the pointer. Seeded, so the picture is the same on every visit.
(() => {
  const STEEPS = [
    { t: 95, s: 10 }, { t: 95, s: 15 }, { t: 95, s: 25 },
    { t: 98, s: 40 }, { t: 98, s: 60 }, { t: 100, s: 90 },
  ];
  const SEED = "Kettle Notes|Mi Lan Xiang|spring 2026";
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;

  function rng(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
    let a = h >>> 0;
    return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }

  function drawRings(ctx, w, h, mode) {
    const r = rng(SEED + mode);
    const small = w < 640;
    const cx = mode === "hero" ? w * (small ? 0.5 : 0.7) : w * (small ? 0.72 : 0.8);
    const cy = mode === "hero" ? (small ? 248 : h * 0.46) : h * 0.42;
    const base = mode === "hero" && small ? 104 : Math.min(w, h) * (mode === "hero" ? 0.27 : 0.22);
    const steeps = mode === "hero" ? STEEPS : STEEPS.slice(3);
    const fade = mode === "hero" ? 1 : 0.45;
    steeps.forEach((st, i) => {
      // each cup is set down a little off from the last one
      const ox = (r() - 0.5) * base * 0.5, oy = (r() - 0.5) * base * 0.35;
      const R = base * (0.82 + i * 0.07 + r() * 0.05);
      const edge = 3 + (st.s / 90) * 16;
      const dark = (st.t - 90) / 10; // 0.5 .. 1
      const p1 = r() * 6.28, p2 = r() * 6.28, p3 = r() * 6.28;
      const wob = (a) => 1 + 0.018 * Math.sin(a * 3 + p1) + 0.01 * Math.sin(a * 7 + p2) + 0.004 * Math.sin(a * 17 + p3);
      // a faint pool where the tea dried
      ctx.beginPath();
      for (let a = 0; a <= 6.30; a += 0.04) {
        const rr = R * wob(a);
        ctx.lineTo(cx + ox + Math.cos(a) * rr, cy + oy + Math.sin(a) * rr);
      }
      ctx.fillStyle = `rgba(176, 106, 38, ${0.035 * fade})`;
      ctx.fill();
      // the dark dried edge, denser toward the outside like a real tea ring
      for (let k = 0; k < edge; k += 0.7) {
        const alpha = (0.16 + dark * 0.2) * Math.pow(1 - k / edge, 1.8) * fade;
        ctx.beginPath();
        for (let a = 0; a <= 6.30; a += 0.03) {
          const rr = R * wob(a) - k;
          // the edge thins and breaks where the cup was lifted
          const lift = 0.55 + 0.45 * Math.sin(a + p1 * 2);
          ctx.lineTo(cx + ox + Math.cos(a) * rr, cy + oy + Math.sin(a) * rr * (1 + 0.002 * lift));
        }
        ctx.closePath();
        ctx.strokeStyle = `rgba(120, 62, 16, ${alpha})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      // a few droplets that fell beside the cup
      for (let d = 0; d < 3; d++) {
        const a = r() * 6.28, dist = R * (1.08 + r() * 0.25), dr = 2 + r() * 6;
        ctx.beginPath();
        ctx.arc(cx + ox + Math.cos(a) * dist, cy + oy + Math.sin(a) * dist, dr, 0, 6.28);
        ctx.fillStyle = `rgba(140, 74, 20, ${0.12 * fade})`;
        ctx.fill();
      }
    });
    return { cx, cy, base };
  }

  function steam(ctx, w, h, cup, time, pointer) {
    const r = rng(SEED + "steam");
    for (let i = 0; i < 6; i++) {
      const phase = r() * 6.28, spread = (r() - 0.5) * cup.base * 0.8, amp = 12 + r() * 24;
      ctx.beginPath();
      const top = Math.max(0, cup.cy - cup.base * 2.2), bottom = cup.cy - cup.base * 0.15;
      for (let y = bottom; y > top; y -= 6) {
        const rise = (bottom - y) / (bottom - top);
        const lean = pointer.x === null ? 0 : (pointer.x - cup.cx) * 0.06 * rise;
        const x = cup.cx + spread * (1 - rise * 0.4) + Math.sin(y * 0.011 + time * 0.00022 + phase) * amp * (0.4 + rise) + lean;
        ctx.lineTo(x, y);
      }
      const g = ctx.createLinearGradient(0, bottom, 0, top);
      g.addColorStop(0, "rgba(74, 52, 32, 0)");
      g.addColorStop(0.3, "rgba(74, 52, 32, .26)");
      g.addColorStop(0.7, "rgba(74, 52, 32, .12)");
      g.addColorStop(1, "rgba(74, 52, 32, 0)");
      ctx.strokeStyle = g;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }

  for (const canvas of document.querySelectorAll("canvas.rings")) {
    const mode = canvas.dataset.mode || "hero";
    const ctx = canvas.getContext("2d");
    const layer = document.createElement("canvas");
    const pointer = { x: null };
    let w = 0, h = 0, cup = null, visible = true, raf = 0;

    const layout = () => {
      const dpr = Math.min(2, devicePixelRatio || 1);
      w = canvas.clientWidth; h = canvas.clientHeight;
      for (const c of [canvas, layer]) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); c.getContext("2d").setTransform(dpr, 0, 0, dpr, 0, 0); }
      const lctx = layer.getContext("2d");
      lctx.clearRect(0, 0, w, h);
      cup = drawRings(lctx, w, h, mode);
      frame(0);
    };
    const frame = (time) => {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(layer, 0, 0);
      const dpr = canvas.width / Math.max(1, w);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (mode === "hero") steam(ctx, w, h, cup, time, pointer);
    };
    const loop = (time) => { frame(time); if (visible && !document.hidden) raf = requestAnimationFrame(loop); };

    layout();
    addEventListener("resize", () => { cancelAnimationFrame(raf); layout(); if (!still && mode === "hero") raf = requestAnimationFrame(loop); });
    if (!still && mode === "hero") {
      canvas.parentElement.addEventListener("pointermove", (e) => { pointer.x = e.clientX - canvas.getBoundingClientRect().left; });
      canvas.parentElement.addEventListener("pointerleave", () => { pointer.x = null; });
      new IntersectionObserver(([en]) => { visible = en.isIntersecting; cancelAnimationFrame(raf); if (visible) raf = requestAnimationFrame(loop); }).observe(canvas);
      document.addEventListener("visibilitychange", () => { cancelAnimationFrame(raf); if (!document.hidden && visible) raf = requestAnimationFrame(loop); });
    }
  }
})();
