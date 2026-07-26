"use client";

import { useEffect, useRef } from "react";

// Ambient canvas — soft flowing particle mesh (ported from the original app.js).
export default function FlowCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let w = 0;
    let h = 0;
    let particles: {
      x: number; y: number; r: number; s: number; o: number; ph: number;
    }[] = [];
    let raf = 0;

    function themeAccent(): [number, number, number] {
      const root = document.documentElement;
      const explicit = root.getAttribute("data-theme");
      const dark = explicit ? explicit === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
      return dark ? [139, 133, 255] : [88, 80, 236];
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
      const n = 70;
      for (let i = 0; i < n; i++) {
        const t = i / n;
        particles.push({
          x: w * 0.15 + t * w * 0.7 + (Math.random() - 0.5) * 30,
          y: h * (0.25 + 0.5 * Math.sin(t * Math.PI)) + (Math.random() - 0.5) * 60,
          r: 1 + Math.random() * 2.2,
          s: 0.3 + Math.random() * 0.6,
          o: 0.25 + Math.random() * 0.55,
          ph: Math.random() * Math.PI * 2,
        });
      }
    }
    function draw(t: number) {
      if (!ctx) return;
      ctx.clearRect(0, 0, w, h);
      const c = themeAccent();
      const gold: [number, number, number] = [221, 154, 52];
      particles.forEach((p, i) => {
        const yy = p.y + Math.sin(t * 0.0006 * p.s + p.ph) * 14;
        const mix = i % 5 === 0 ? gold : c;
        ctx.beginPath();
        ctx.fillStyle = `rgba(${mix[0]},${mix[1]},${mix[2]},${p.o})`;
        ctx.arc(p.x, yy, p.r, 0, Math.PI * 2);
        ctx.fill();
      });
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
