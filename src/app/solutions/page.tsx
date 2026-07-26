import type { Metadata } from "next";
import FlowCanvas from "@/components/FlowCanvas";
import NavBar from "@/components/NavBar";

export const metadata: Metadata = { title: "Solutions — Northline" };

export default function SolutionsPage() {
  return (
    <>
      <NavBar />

      <div className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Solutions</p>
          <h1>
            Built for the team
            <br />
            that owns <em>the queue</em>.
          </h1>
          <p>
            Different teams file different kinds of requests, but they all drown in the same
            way: split across inboxes, with no shared view of what&apos;s open. Northline gives
            each team its own queue on one platform.
          </p>
          <div className="hero-actions">
            <button className="btn primary">Get a demo</button>
            <button className="btn">Talk to sales</button>
          </div>
        </div>
        <div className="hero-visual">
          <FlowCanvas />
        </div>
      </div>

      <div className="marquee">
        <div className="marquee-inner">
          <h3>One platform, four queues</h3>
          <div className="cards">
            <div className="card">
              <span className="tag">IT</span>
              <h4>Helpdesk &amp; access requests</h4>
              <p>Password resets, hardware requests, and access grants triaged by urgency, with Nova drafting the first reply.</p>
            </div>
            <div className="card">
              <span className="tag">HR</span>
              <h4>Case management</h4>
              <p>Onboarding tasks and employee cases routed to the right HR partner automatically, with a private queue per case.</p>
            </div>
            <div className="card">
              <span className="tag">Facilities</span>
              <h4>Workplace &amp; asset requests</h4>
              <p>Building access, repairs, and equipment requests tracked against the same SLA rules as every other queue.</p>
            </div>
            <div className="card">
              <span className="tag">Procurement</span>
              <h4>Vendor &amp; purchase requests</h4>
              <p>Purchase approvals route through the right cost-center owner, with status visible to the requester at every step.</p>
            </div>
          </div>
        </div>
      </div>

      <div className="marquee">
        <div className="marquee-inner">
          <h3>How a team goes live</h3>
          <div className="steps">
            <div className="step">
              <span className="n">Day 1</span>
              <p className="t"><strong>Workspace setup.</strong> Invite the core team and connect the primary inbox for the queue.</p>
            </div>
            <div className="step">
              <span className="n">Day 2</span>
              <p className="t"><strong>Import open requests.</strong> Bring in existing tickets from a spreadsheet or a prior tool.</p>
            </div>
            <div className="step">
              <span className="n">Day 3</span>
              <p className="t"><strong>Configure routing.</strong> Set SLA targets per request type; Northline suggests starting rules from the import.</p>
            </div>
            <div className="step">
              <span className="n">Day 4</span>
              <p className="t"><strong>Add channels.</strong> Turn on the web form and Slack command, then invite requesters.</p>
            </div>
            <div className="step">
              <span className="n">Day 5</span>
              <p className="t"><strong>Go live.</strong> The old inbox goes read-only; new requests flow through Northline only.</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
