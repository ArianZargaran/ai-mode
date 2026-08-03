"use client";

import { useEffect, useRef } from "react";

// Platform hero visual: an "operational graph". Request pulses stream from
// channel nodes on the left, converge on one central hub (the graph), and fan
// out to queue nodes on the right, illustrating "every request routes through
// one graph". Boxless canvas; honors prefers-reduced-motion (static frame).
type Node = { x: number; y: number; r: number };
type Edge = { a: Node; b: Node; c: { x: number; y: number } };

export default function GraphCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let w = 0;
    let h = 0;
    let raf = 0;
    let sources: Node[] = [];
    let hub: Node = { x: 0, y: 0, r: 7 };
    let outs: Node[] = [];
    let edges: Edge[] = [];

    function accent(): [number, number, number] {
      const root = document.documentElement;
      const explicit = root.getAttribute("data-theme");
      const dark = explicit ? explicit === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
      return dark ? [139, 133, 255] : [88, 80, 236];
    }
    function edge(a: Node, b: Node): Edge {
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len = Math.hypot(dx, dy) || 1;
      const off = (a.y < b.y ? 1 : -1) * Math.min(len * 0.2, 70);
      return { a, b, c: { x: mx + (-dy / len) * off, y: my + (dx / len) * off } };
    }
    function qb(e: Edge, t: number): { x: number; y: number } {
      const mt = 1 - t;
      return {
        x: mt * mt * e.a.x + 2 * mt * t * e.c.x + t * t * e.b.x,
        y: mt * mt * e.a.y + 2 * mt * t * e.c.y + t * t * e.b.y,
      };
    }
    function build() {
      const sx = w * 0.42;
      const hx = w * 0.66;
      const ox = w * 0.92;
      const ns = 5;
      sources = Array.from({ length: ns }, (_, i) => ({ x: sx, y: h * (0.16 + 0.68 * (i / (ns - 1))), r: 3.6 }));
      hub = { x: hx, y: h * 0.5, r: 8 };
      const no = 3;
      outs = Array.from({ length: no }, (_, i) => ({ x: ox, y: h * (0.3 + 0.4 * (i / (no - 1))), r: 4.4 }));
      edges = [...sources.map((s) => edge(s, hub)), ...outs.map((o) => edge(hub, o))];
    }
    function resize() {
      if (!canvas || !ctx) return;
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      build();
    }
    function draw(time: number) {
      if (!ctx) return;
      ctx.clearRect(0, 0, w, h);
      const c = accent();
      const gold: [number, number, number] = [221, 154, 52];
      const A = (a: number) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

      ctx.lineWidth = 1.2;
      edges.forEach((e) => {
        ctx.strokeStyle = A(0.16);
        ctx.beginPath();
        ctx.moveTo(e.a.x, e.a.y);
        ctx.quadraticCurveTo(e.c.x, e.c.y, e.b.x, e.b.y);
        ctx.stroke();
      });

      const per = 3;
      ctx.shadowBlur = 8;
      edges.forEach((e, ei) => {
        for (let k = 0; k < per; k++) {
          const t = reduced ? (k + 0.5) / per : (time * 0.00016 + ei * 0.13 + k / per) % 1;
          const p = qb(e, t);
          const mix = (ei + k) % 4 === 0 ? gold : c;
          ctx.shadowColor = `rgba(${mix[0]},${mix[1]},${mix[2]},0.6)`;
          ctx.fillStyle = `rgba(${mix[0]},${mix[1]},${mix[2]},0.8)`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, 2.3, 0, Math.PI * 2);
          ctx.fill();
        }
      });

      [...sources, hub, ...outs].forEach((n) => {
        const pulse = reduced ? 0 : Math.sin(time * 0.002 + n.y) * 0.6;
        ctx.shadowColor = A(0.5);
        ctx.shadowBlur = 11;
        ctx.fillStyle = A(0.92);
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r + pulse, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = A(0.24);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r + 6, 0, Math.PI * 2);
        ctx.stroke();
      });
      ctx.shadowBlur = 0;
      if (!reduced) raf = requestAnimationFrame(draw);
    }

    resize();
    if (reduced) draw(0);
    else raf = requestAnimationFrame(draw);
    window.addEventListener("resize", resize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return <canvas className="graph-canvas" ref={ref} />;
}
