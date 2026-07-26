import FlowCanvas from "@/components/FlowCanvas";
import NavBar from "@/components/NavBar";

export default function Home() {
  return (
    <>
      <NavBar />

      <div className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Operations platform</p>
          <h1>
            Run the business
            <br />
            from <em>one queue</em>, not six tabs.
          </h1>
          <p>
            Northline unifies tickets, approvals, and asset requests into a single operational
            graph, so teams stop chasing status updates and start closing loops.
          </p>
          <div className="hero-actions">
            <button className="btn primary">Get a demo</button>
            <button className="btn">Start free</button>
          </div>
          <p className="trust">Trusted by ops teams at</p>
          <div className="logos">
            <span>Vantree</span>
            <span>Corda</span>
            <span>Halyard</span>
            <span>Fenwick&amp;Yu</span>
          </div>
        </div>
        <div className="hero-visual">
          <FlowCanvas />
        </div>
      </div>

      <div className="marquee">
        <div className="marquee-inner">
          <h3>Built for how ops actually works</h3>
          <div className="cards">
            <div className="card">
              <span className="tag">Queueing</span>
              <h4>One inbox, every channel</h4>
              <p>Email, forms, and Slack requests land in a single triage view with SLA timers built in.</p>
            </div>
            <div className="card">
              <span className="tag">Automation</span>
              <h4>Routing that learns</h4>
              <p>Rules adapt to team load and request type, so nothing sits unassigned overnight.</p>
            </div>
            <div className="card">
              <span className="tag">Visibility</span>
              <h4>Status without meetings</h4>
              <p>Stakeholders check a shared board instead of pinging the channel for updates.</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
