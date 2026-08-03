"use client";

import { useEffect, useRef } from "react";

// Ambient hero murmuration: dots stream along an italic "S" path with a soft
// glow. Boxless (transparent canvas). Honors prefers-reduced-motion by drawing
// a single static frame.
export default function FlowCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const N = 320;
    let w = 0;
    let h = 0;
    let particles: {
      p: number; off: number; r: number; o: number; s: number; ph: number;
    }[] = [];
    let raf = 0;

    function themeAccent(): [number, number, number] {
      const root = document.documentElement;
      const explicit = root.getAttribute("data-theme");
      const dark = explicit ? explicit === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
      return dark ? [139, 133, 255] : [88, 80, 236];
    }

    // point on the italic S for a normalized position t in [0, 1]
    function sPath(t: number): { x: number; y: number } {
      const top = h * 0.1;
      const bottom = h * 0.9;
      const y = top + t * (bottom - top);
      const amp = Math.min(w, h) * 0.34;
      // one full sine over the height = an S; shear leans it forward (italic)
      const x = w * 0.5 + amp * Math.sin(t * Math.PI * 2) + (0.5 - t) * w * 0.2;
      return { x, y };
    }

    function resize() {
      if (!canvas || !ctx) return;
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    function init() {
      particles = [];
      const band = Math.min(w, h) * 0.12;
      for (let i = 0; i < N; i++) {
        particles.push({
          p: i / N + Math.random() * 0.01,
          off: (Math.random() + Math.random() - 1) * band, // center-biased scatter
          r: 1.3 + Math.random() * 3.3,
          o: 0.24 + Math.random() * 0.62,
          s: 0.6 + Math.random() * 0.9,
          ph: Math.random() * Math.PI * 2,
        });
      }
    }
    function draw(time: number) {
      if (!ctx) return;
      ctx.clearRect(0, 0, w, h);
      const c = themeAccent();
      const gold: [number, number, number] = [221, 154, 52];
      ctx.shadowBlur = 13;
      particles.forEach((pt, i) => {
        const t = reduced ? pt.p : (pt.p + time * 0.000035 * pt.s) % 1;
        const base = sPath(t);
        const x = base.x + pt.off + (reduced ? 0 : Math.sin(time * 0.0007 * pt.s + pt.ph) * 10);
        const y = base.y + (reduced ? 0 : Math.cos(time * 0.0006 + pt.ph) * 6);
        const mix = i % 5 === 0 ? gold : c;
        ctx.beginPath();
        ctx.shadowColor = `rgba(${mix[0]},${mix[1]},${mix[2]},0.5)`;
        ctx.fillStyle = `rgba(${mix[0]},${mix[1]},${mix[2]},${pt.o})`;
        ctx.arc(x, y, pt.r, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.shadowBlur = 0;
      if (!reduced) raf = requestAnimationFrame(draw);
    }
    function onResize() {
      resize();
      init();
    }

    resize();
    init();
    if (reduced) draw(0);
    else raf = requestAnimationFrame(draw);
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return <canvas id="flow" ref={canvasRef} />;
}
