// Pre-defined per-page summaries. When the user hits the fixed "Summarize
// this page" prompt (or asks for a page summary in their own words), the
// route serves the canned summary for the current slug verbatim — no
// retrieval, no generation — so the answer is instant and deterministic.

export type PageSummary = {
  title: string;
  url: string;
  markdown: string;
  // rail entries; defaults to [{title, url, score: 1}] when omitted
  sources?: { title: string; url: string; score: number }[];
  // steer responses route the user to sales/support instead of answering:
  // the UI shows the contact-sales card (fallback) and no "Get started" CTA
  steer?: boolean;
};

// Pricing is deliberately never answered by the model — no numbers, no plan
// comparisons, no discounts. Every pricing-shaped request gets this fixed
// hand-off to humans.
const PRICING_STEER_MARKDOWN = `Pricing questions deserve exact, current answers — so they come from our team, not from me.

- **Talk to sales** — for quotes, plan recommendations, and any discount questions, [contact sales](https://northline.com/contact-sales).
- **Customer service** — for billing on an existing workspace, reach [support](https://northline.com/support).

You can also review the public plans yourself:

https://northline.com/pricing`;

export const PRICING_STEER: PageSummary = {
  title: "Pricing — Northline",
  url: "northline.com/pricing",
  markdown: PRICING_STEER_MARKDOWN,
  steer: true,
};

export const PAGE_SUMMARIES: Record<string, PageSummary> = {
  "/": {
    title: "Product — Northline",
    url: "northline.com",
    markdown: `This is Northline's product overview page.

- **One queue** — tickets, approvals, and asset requests from email, web forms, and Slack land in a single operational graph instead of six tabs.
- **Automation** — routing rules adapt to team load and request type, with SLA timers running from the moment a request arrives.
- **Nova AI** — drafts first replies, routes requests, and flags SLA risk before a breach.
- **Visibility** — stakeholders check a shared status board instead of pinging the channel.

See [how teams switch](https://northline.com/switch) or start a 14-day free trial.

https://northline.com/pricing`,
  },
  "/platform": {
    title: "Platform — Northline",
    url: "northline.com/platform",
    markdown: `This page covers Northline's platform architecture.

- **One graph** — requests, rules, and approvals live on a single graph, so routing, SLAs, and reporting read one source of truth.
- **Nova-powered routing** — learns from past assignments and team load; typical teams halve unassigned-ticket time in the first month.
- **SLA engine** — predicts breaches from queue velocity and history, not just fixed timers.
- **Admin & security** — SOC 2 Type II, SSO/SCIM and audit log on Enterprise, region-pinned data residency.

Full details in the [platform documentation](https://northline.com/product/platform).

https://northline.com/trust/ai-data`,
  },
  "/solutions": {
    title: "Solutions — Northline",
    url: "northline.com/solutions",
    markdown: `This page shows who Northline is built for.

- **IT** — helpdesk and access requests triaged by urgency, with Nova drafting the first reply.
- **HR** — onboarding tasks and employee cases routed to the right partner, private queue per case.
- **Facilities** — workplace and asset requests tracked against the same SLA rules as every queue.
- **Procurement** — purchase approvals route through the right cost-center owner, status visible to requesters.

Teams typically go live in 5 days — see the [onboarding guide](https://northline.com/docs/onboarding).

https://northline.com/switch`,
  },
  "/pricing": {
    title: "Pricing — Northline",
    url: "northline.com/pricing",
    markdown: PRICING_STEER_MARKDOWN,
    steer: true,
  },
};

// Served when the summary intent fires on a slug with no entry above —
// i.e. the user asked "summarize this page" while on the 404 page.
export const NOT_FOUND_SUMMARY: PageSummary = {
  title: "Page not found",
  url: "northline.com",
  markdown: `You're on a page that doesn't exist — here's where to go instead.

- **[Product](https://northline.com/)** — what Northline is: one queue for tickets, approvals, and requests.
- **[Platform](https://northline.com/platform)** — the operational graph, Nova-powered routing, SLA engine, and security.
- **[Solutions](https://northline.com/solutions)** — how IT, HR, Facilities, and Procurement teams run their queues.
- **[Pricing](https://northline.com/pricing)** — per-seat plans from $29/seat/mo, 14-day trial, no setup fee.

Or head straight back home:

https://northline.com`,
  sources: [
    { title: "Product — Northline", url: "northline.com", score: 1 },
    { title: "Platform — Northline", url: "northline.com/platform", score: 1 },
    { title: "Solutions — Northline", url: "northline.com/solutions", score: 1 },
    { title: "Pricing — Northline", url: "northline.com/pricing", score: 1 },
  ],
};

// The widget's fixed prompt is matched exactly; free-form asks are matched
// when they combine a summary-ish verb with a reference to "this/the page".
const FIXED_PROMPT = "summarize this page";
const SUMMARY_RE =
  /\b(summari[sz]e|summary|overview|tl;?dr|recap)\b.*\b(this|the|current)\s+(page|screen)\b|\bwhat('s| is)\s+(on\s+)?(this|the)\s+page\b/i;

export function isSummaryIntent(message: string): boolean {
  const m = message.trim().toLowerCase();
  return m === FIXED_PROMPT || SUMMARY_RE.test(m);
}

// Anything pricing-shaped: money words, plan/tier talk, billing, discounts.
// Checked against both the raw message and the history-condensed query, so
// follow-ups like "and how much is that?" are caught too.
const PRICING_RE =
  /\b(pric(e|es|ing|ed)|cost(s|ing)?|how much|plan(s)?\b|tier(s)?|seat(s)?\b|subscription(s)?|billing|invoice(s)?|discount(s)?|coupon(s)?|promo\b|cheap(er|est)?|expensive|quote(s)?|fee(s)?|refund(s)?|pay(ment|ing)?\b|trial\b|annual(ly)?|monthly|per[- ]seat|\$\d)\b/i;

export function isPricingIntent(message: string): boolean {
  return PRICING_RE.test(message);
}
