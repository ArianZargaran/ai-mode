import Gyroscope from "@/components/Gyroscope";
import NavBar from "@/components/NavBar";

// real brand marks (Simple Icons, monochrome) standing in as trustbar logos
const CUSTOMERS = [
  { name: "Shopify", slug: "shopify" },
  { name: "Notion", slug: "notion" },
  { name: "Figma", slug: "figma" },
  { name: "Airtable", slug: "airtable" },
  { name: "Intercom", slug: "intercom" },
];

const INTEGRATIONS = ["gmail", "googlecalendar", "zapier", "jira", "zendesk"];

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
          <p className="hero-trust">Trusted by ops teams at</p>
          <div className="hero-logos">
            {CUSTOMERS.map((c) => (
              <div className="hlogo" key={c.name}>
                <img
                  className="hlm"
                  src={`https://cdn.simpleicons.org/${c.slug}/9aa0aa`}
                  alt=""
                  loading="lazy"
                />
                <span className="hlw">{c.name}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="hero-visual" aria-hidden="true">
          <Gyroscope />
        </div>
      </div>

      <div className="marquee">
        <div className="marquee-inner">
          <h3>Built for how ops actually works</h3>
          <div className="bento">
            <div className="b lead">
              <span className="tag">Queueing</span>
              <h4>One inbox for every channel</h4>
              <p>Email, web forms, and Slack requests land in a single triage view with SLA timers running from the moment they arrive.</p>
            </div>
            <div className="b">
              <span className="tag">Automation</span>
              <h4>Routing that learns</h4>
              <p>Rules adapt to team load and request type, so nothing sits unassigned overnight.</p>
            </div>
            <div className="b stat">
              <span className="tag">This week</span>
              <div className="num">96%</div>
              <p>within SLA across 8 queues</p>
            </div>
            <div className="b">
              <span className="tag">Visibility</span>
              <h4>Status without meetings</h4>
              <p>Stakeholders check a shared board instead of pinging the channel for updates.</p>
            </div>
            <div className="b dark">
              <span className="tag">Nova AI</span>
              <h4>Drafts, routing, anomaly alerts</h4>
              <p>Nova drafts the first reply and flags SLA risk before a breach.</p>
            </div>
            <div className="b wide">
              <h4>Connects to the tools requests already live in</h4>
              <div className="b-logos">
                {INTEGRATIONS.map((slug) => (
                  <img
                    key={slug}
                    src={`https://cdn.simpleicons.org/${slug}/9aa0aa`}
                    alt={slug}
                    loading="lazy"
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
