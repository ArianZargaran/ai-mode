// Per-IP sliding-window rate limiter, in-memory. Per-instance only (resets
// on cold start, not shared across serverless instances) — that's acceptable
// as a cost/abuse backstop for a portfolio demo; swap for Upstash/Redis if
// this ever fronts real traffic.

const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 10; // requests per IP per minute
const MAX_PER_DAY = 400; // requests per instance per day — hard cost ceiling

const hits = new Map<string, number[]>();
let dayCount = 0;
let dayStart = Date.now();

function prune(now: number) {
  // occasional sweep so idle IPs don't accumulate forever
  if (hits.size < 1000) return;
  for (const [ip, times] of hits) {
    const alive = times.filter((t) => now - t < WINDOW_MS);
    if (alive.length === 0) hits.delete(ip);
    else hits.set(ip, alive);
  }
}

export function checkRateLimit(ip: string): { ok: boolean; reason?: string } {
  const now = Date.now();

  if (now - dayStart > 86_400_000) {
    dayStart = now;
    dayCount = 0;
  }
  if (dayCount >= MAX_PER_DAY) {
    return { ok: false, reason: "daily capacity reached" };
  }

  prune(now);
  const times = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (times.length >= MAX_PER_WINDOW) {
    return { ok: false, reason: "too many requests" };
  }

  times.push(now);
  hits.set(ip, times);
  dayCount += 1;
  return { ok: true };
}

export function clientIp(req: Request): string {
  // Vercel/proxies put the real client first in x-forwarded-for
  const fwd = req.headers.get("x-forwarded-for");
  return fwd ? fwd.split(",")[0].trim() : "local";
}
