import type { Metadata } from "next";
import NavBar from "@/components/NavBar";

export const metadata: Metadata = { title: "Platform - Northline" };

const CAPS = [
  {
    cat: "Routing",
    title: "Nova-powered assignment",
    body: "Routing learns from past assignments and current team load, cutting unassigned-ticket time roughly in half within the first month.",
  },
  {
    cat: "SLA engine",
    title: "Breach prediction, not just timers",
    body: "Anomaly alerts flag SLA risk from queue velocity and historical resolution time, ahead of a fixed-timer breach.",
  },
  {
    cat: "Integrations",
    title: "Email, forms, Slack, API",
    body: "Every channel writes into the same graph, with a full REST API and outbound webhooks on Business and Enterprise.",
  },
  {
    cat: "Admin & security",
    title: "SOC 2 Type II, SSO, audit log",
    body: "Workspace data stays inside your data boundary. Enterprise adds SSO/SCIM, region-pinned residency, and a full audit log.",
  },
];

// real integration logos (Simple Icons); Slack omitted - removed from Simple
// Icons for trademark reasons, so its slug 404s
const LOGOS = ["gmail", "googlecalendar", "zapier", "jira", "zendesk"];

export default function PlatformPage() {
  return (
    <>
      <NavBar />

      <section className="chero">
        <h1>
          Every request, <em>one graph</em>.
        </h1>
        <p>
          Requests, rules, and approvals on a single graph, so routing, SLAs, and reporting all
          read one source of truth instead of syncing between tools.
        </p>
        <div className="hero-actions">
          <button className="btn primary">Get a demo</button>
          <button className="btn">View documentation</button>
        </div>

        <div className="chero-cards" aria-hidden="true">
          <div className="pcard pcard-b">
            <span className="pk">This week</span>
            <div className="pbig">96%</div>
            <span className="psub">within SLA across 8 queues</span>
            <svg className="spark" viewBox="0 0 120 36" preserveAspectRatio="none">
              <polyline
                points="0,28 20,26 40,29 60,20 80,22 100,12 120,8"
                fill="none"
                stroke="var(--accent)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>

          <div className="pcard pcard-a">
            <div className="pcard-head">
              <span className="pt">Triage, Today</span>
              <span className="ps">148 open, 12 breaching</span>
            </div>
            <div className="prow"><span className="pttl">Refund request</span><span className="pq">Payments</span><span className="pill due">Due</span></div>
            <div className="prow"><span className="pttl">Access grant</span><span className="pq">IT</span><span className="pill soon">Soon</span></div>
            <div className="prow"><span className="pttl">Invoice query</span><span className="pq">Finance</span><span className="pill open">Open</span></div>
            <div className="prow"><span className="pttl">Laptop repair</span><span className="pq">Facilities</span><span className="pill over">Overdue</span></div>
          </div>

          <div className="pcard pcard-c dark">
            <div className="pcard-head">
              <span className="pk accent">Nova routing</span>
              <span className="ps">AI matching</span>
            </div>
            <div className="pmatch">Matched to <strong>Payments</strong></div>
            <div className="nrow"><span>Refund SLA, 4h</span><span className="npct">97%</span></div>
            <div className="nrow"><span>Owner, S. Okafor</span><span className="npct">92%</span></div>
            <div className="nrow"><span>Priority, High</span><span className="npct">88%</span></div>
          </div>
        </div>
      </section>

      <div className="caprows">
        <h3>What&apos;s under the hood</h3>
        {CAPS.map((c) => (
          <div className="caprow" key={c.cat}>
            <div className="cat">{c.cat}</div>
            <div>
              <h4>{c.title}</h4>
              <p>{c.body}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="logowall">
        <p>Connects with the tools your requests already live in</p>
        <div className="row">
          {LOGOS.map((slug) => (
            <img
              key={slug}
              src={`https://cdn.simpleicons.org/${slug}/9aa0aa`}
              alt={slug}
              loading="lazy"
            />
          ))}
        </div>
      </div>
    </>
  );
}
