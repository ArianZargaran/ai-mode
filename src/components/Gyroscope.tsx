"use client";

import { useEffect, useRef } from "react";

// Home hero visual: a boxless wireframe gyroscope. Four nested rings tumble
// on hierarchical axes (each inherits its parents' rotation, like real
// gimbals) around a glowing core. Floats free on the page background — no
// stage, no panel. Hand-rolled 3D -> 2D projection, no 3D deps; theme-aware
// (samples colors per frame); prefers-reduced-motion gets a static frame.
type V3 = { x: number; y: number; z: number };

const FOV = 4.2;
const SEGS = 90;

function rotX(p: V3, a: number): V3 {
  const c = Math.cos(a), s = Math.sin(a);
  return { x: p.x, y: p.y * c - p.z * s, z: p.y * s + p.z * c };
}
function rotY(p: V3, a: number): V3 {
  const c = Math.cos(a), s = Math.sin(a);
  return { x: p.x * c + p.z * s, y: p.y, z: -p.x * s + p.z * c };
}
function rotZ(p: V3, a: number): V3 {
  const c = Math.cos(a), s = Math.sin(a);
  return { x: p.x * c - p.y * s, y: p.x * s + p.y * c, z: p.z };
}

// cx: horizontal center as a fraction of canvas width — the home hero biases
// the instrument right (0.58) to clear the copy; other placements center it
export default function Gyroscope({ cx: cxFrac = 0.58 }: { cx?: number }) {
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

    function dark(): boolean {
      const explicit = document.documentElement.getAttribute("data-theme");
      return explicit ? explicit === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
    }

    function resize() {
      if (!canvas || !ctx) return;
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    // ring definitions: radius (relative), spin speeds per axis, base tilt,
    // and how many node dots ride the ring
    const RINGS = [
      { r: 1.0, wx: 0.00030, wy: 0.00013, wz: 0, tilt: 0.15, nodes: 3 },
      { r: 0.78, wx: 0.00017, wy: 0.00038, wz: 0, tilt: 0.6, nodes: 2 },
      { r: 0.58, wx: 0.00042, wy: 0.00021, wz: 0.0001, tilt: 0.95, nodes: 2 },
      { r: 0.4, wx: 0.00024, wy: 0.00052, wz: 0, tilt: 1.25, nodes: 1, gold: true },
    ];

    // hierarchical transform: ring k feels rotations of rings 0..k
    function transform(p: V3, k: number, t: number): V3 {
      let q = rotX(p, RINGS[k].tilt);
      for (let i = k; i >= 0; i--) {
        q = rotZ(rotY(rotX(q, RINGS[i].wx * t), RINGS[i].wy * t), RINGS[i].wz * t);
      }
      return q;
    }

    function project(p: V3, cx: number, cy: number, R: number) {
      const persp = FOV / (FOV - p.z);
      return { x: cx + p.x * R * persp, y: cy + p.y * R * persp, z: p.z };
    }

    function draw(time: number) {
      if (!ctx) return;
      ctx.clearRect(0, 0, w, h);
      const isDark = dark();
      const accent: [number, number, number] = isDark ? [139, 133, 255] : [88, 80, 236];
      const gold: [number, number, number] = isDark ? [232, 171, 82] : [221, 154, 52];
      const t = reduced ? 2600 : time;

      const cx = w * cxFrac;
      const cy = h * 0.5;
      const R = Math.min(w, h) * 0.44;

      // soft ambient glow behind the whole instrument; radius capped to the
      // distance to the nearest canvas edge so the fade never gets clipped
      // into a visible rectangle
      const glowR = Math.min(R * 1.6, cx, w - cx, cy, h - cy);
      const glow = ctx.createRadialGradient(cx, cy, R * 0.1, cx, cy, glowR);
      glow.addColorStop(0, `rgba(${accent[0]},${accent[1]},${accent[2]},${isDark ? 0.16 : 0.1})`);
      glow.addColorStop(1, `rgba(${accent[0]},${accent[1]},${accent[2]},0)`);
      ctx.fillStyle = glow;
      ctx.fillRect(cx - glowR, cy - glowR, glowR * 2, glowR * 2);

      RINGS.forEach((ring, k) => {
        const col = ring.gold ? gold : accent;

        // ring path, segment by segment for depth shading
        for (let i = 0; i < SEGS; i++) {
          const a0 = (i / SEGS) * Math.PI * 2;
          const a1 = ((i + 1) / SEGS) * Math.PI * 2;
          const p0 = transform({ x: Math.cos(a0) * ring.r, y: Math.sin(a0) * ring.r, z: 0 }, k, t);
          const p1 = transform({ x: Math.cos(a1) * ring.r, y: Math.sin(a1) * ring.r, z: 0 }, k, t);
          const s0 = project(p0, cx, cy, R);
          const s1 = project(p1, cx, cy, R);
          const depth = (p0.z + p1.z) / 2 / ring.r; // -1 .. 1
          const front = depth > 0;
          const alpha = (front ? 0.55 + 0.35 * depth : 0.24 + 0.12 * (depth + 1)) * (isDark ? 1 : 0.92);
          ctx.strokeStyle = `rgba(${col[0]},${col[1]},${col[2]},${alpha})`;
          ctx.lineWidth = front ? 2.1 : 1.1;
          ctx.shadowBlur = front ? 7 : 0;
          ctx.shadowColor = `rgba(${col[0]},${col[1]},${col[2]},0.5)`;
          ctx.beginPath();
          ctx.moveTo(s0.x, s0.y);
          ctx.lineTo(s1.x, s1.y);
          ctx.stroke();
        }
        ctx.shadowBlur = 0;

        // node dots riding the ring
        for (let n = 0; n < ring.nodes; n++) {
          const a = (n / ring.nodes) * Math.PI * 2 + (reduced ? 0 : t * 0.0004);
          const p = transform({ x: Math.cos(a) * ring.r, y: Math.sin(a) * ring.r, z: 0 }, k, t);
          const s = project(p, cx, cy, R);
          const front = p.z > 0;
          ctx.fillStyle = `rgba(${col[0]},${col[1]},${col[2]},${front ? 0.95 : 0.3})`;
          ctx.shadowBlur = front ? 9 : 0;
          ctx.shadowColor = `rgba(${col[0]},${col[1]},${col[2]},0.7)`;
          ctx.beginPath();
          ctx.arc(s.x, s.y, front ? 3.4 : 2.2, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.shadowBlur = 0;
      });

      // glowing core
      const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 0.16);
      core.addColorStop(0, isDark ? "rgba(238,240,245,0.95)" : "rgba(88,80,236,0.9)");
      core.addColorStop(0.35, `rgba(${accent[0]},${accent[1]},${accent[2]},0.55)`);
      core.addColorStop(1, `rgba(${accent[0]},${accent[1]},${accent[2]},0)`);
      ctx.fillStyle = core;
      ctx.beginPath();
      ctx.arc(cx, cy, R * 0.16, 0, Math.PI * 2);
      ctx.fill();

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
  }, [cxFrac]);

  return <canvas className="gyro-canvas" ref={ref} />;
}
