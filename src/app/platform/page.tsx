import type { Metadata } from "next";
import FlowCanvas from "@/components/FlowCanvas";
import NavBar from "@/components/NavBar";

export const metadata: Metadata = { title: "Platform — Northline" };

export default function PlatformPage() {
  return (
    <>
      <NavBar />

      <div className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Platform</p>
          <h1>
            Every request routes
            <br />
            through <em>one graph</em>.
          </h1>
          <p>
            Northline isn&apos;t a ticket form bolted onto a database. Requests, rules, and
            approvals live on a single graph, so routing, SLA tracking, and reporting all read
            from the same source of truth instead of syncing between tools.
          </p>
          <div className="hero-actions">
            <button className="btn primary">Get a demo</button>
            <button className="btn">View documentation</button>
          </div>
        </div>
        <div className="hero-visual">
          <FlowCanvas />
        </div>
      </div>

      <div className="marquee">
        <div className="marquee-inner">
          <h3>What&apos;s under the hood</h3>
          <div className="cards">
            <div className="card">
              <span className="tag">Routing</span>
              <h4>Nova-powered assignment</h4>
              <p>Routing learns from past assignments and current team load, cutting unassigned-ticket time roughly in half within the first month.</p>
            </div>
            <div className="card">
              <span className="tag">SLA engine</span>
              <h4>Breach prediction, not just timers</h4>
              <p>Anomaly alerts flag SLA risk from queue velocity and historical resolution time, ahead of a fixed-timer breach.</p>
            </div>
            <div className="card">
              <span className="tag">Integrations</span>
              <h4>Email, forms, Slack, API</h4>
              <p>Every channel writes into the same graph, with a full REST API and outbound webhooks on Business and Enterprise.</p>
            </div>
            <div className="card">
              <span className="tag">Admin &amp; security</span>
              <h4>SOC 2 Type II, SSO, audit log</h4>
              <p>Workspace data stays inside your data boundary. Enterprise adds SSO/SCIM, region-pinned residency, and a full audit log.</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
