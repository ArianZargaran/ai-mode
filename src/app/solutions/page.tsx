import type { Metadata } from "next";
import NavBar from "@/components/NavBar";

export const metadata: Metadata = { title: "Solutions - Northline" };

const TEAMS = [
  {
    mono: "IT",
    team: "IT",
    title: "Helpdesk & access requests",
    body: "Password resets, hardware requests, and access grants triaged by urgency, with Nova drafting the first reply.",
  },
  {
    mono: "HR",
    team: "HR",
    title: "Case management",
    body: "Onboarding tasks and employee cases routed to the right HR partner automatically, with a private queue per case.",
  },
  {
    mono: "FM",
    team: "Facilities",
    title: "Workplace & asset requests",
    body: "Building access, repairs, and equipment requests tracked against the same SLA rules as every other queue.",
  },
  {
    mono: "PR",
    team: "Procurement",
    title: "Vendor & purchase requests",
    body: "Purchase approvals route through the right cost-center owner, with status visible to the requester at every step.",
  },
];

type QueueCard = { kind: "queue"; mono: string; title: string; rows: { label: string; status: string; pill: "due" | "soon" | "open" | "over" }[] };
type StatCard = { kind: "stat"; k: string; big: string; sub: string };
type NovaCard = { kind: "nova"; head: string; text: React.ReactNode };
type RiverCard = QueueCard | StatCard | NovaCard;

const COL_A: RiverCard[] = [
  {
    kind: "queue",
    mono: "IT",
    title: "Access requests",
    rows: [
      { label: "VPN access — R. Kade", status: "Due", pill: "due" },
      { label: "Laptop reimage", status: "Soon", pill: "soon" },
      { label: "New hire provisioning", status: "Open", pill: "open" },
      { label: "Password reset", status: "Open", pill: "open" },
    ],
  },
  { kind: "stat", k: "This week", big: "182", sub: "requests closed across all queues" },
  {
    kind: "queue",
    mono: "HR",
    title: "Open cases",
    rows: [
      { label: "Onboarding — T. Alavi", status: "Soon", pill: "soon" },
      { label: "Benefits question", status: "Open", pill: "open" },
      { label: "Leave request", status: "Open", pill: "open" },
    ],
  },
];

const COL_B: RiverCard[] = [
  {
    kind: "queue",
    mono: "FM",
    title: "Workplace requests",
    rows: [
      { label: "Badge access — 4th floor", status: "Open", pill: "open" },
      { label: "AC repair, east wing", status: "Overdue", pill: "over" },
      { label: "Standing desk request", status: "Open", pill: "open" },
    ],
  },
  {
    kind: "nova",
    head: "Nova · AI routing",
    text: (
      <>
        Matched <strong>Refund request</strong> to Payments, 97% confidence.
      </>
    ),
  },
  {
    kind: "queue",
    mono: "PR",
    title: "Purchase approvals",
    rows: [
      { label: "Vendor renewal — Acme Co", status: "Due", pill: "due" },
      { label: "Laptop batch order", status: "Soon", pill: "soon" },
      { label: "Contractor invoice", status: "Open", pill: "open" },
      { label: "Software license", status: "Open", pill: "open" },
    ],
  },
];

function RiverCardView({ card }: { card: RiverCard }) {
  if (card.kind === "stat") {
    return (
      <div className="gcard stat">
        <span className="gk">{card.k}</span>
        <div className="gbig">{card.big}</div>
        <span className="gsub">{card.sub}</span>
      </div>
    );
  }
  if (card.kind === "nova") {
    return (
      <div className="gcard dark">
        <div className="gcard-head">
          <span className="gm">N</span>
          <span className="gt">{card.head}</span>
        </div>
        <p className="gnova">{card.text}</p>
      </div>
    );
  }
  return (
    <div className="gcard">
      <div className="gcard-head">
        <span className="gm">{card.mono}</span>
        <span className="gt">{card.title}</span>
      </div>
      {card.rows.map((r) => (
        <div className="grow" key={r.label}>
          <span>{r.label}</span>
          <span className={`pill ${r.pill}`}>{r.status}</span>
        </div>
      ))}
    </div>
  );
}

const ROLLOUT = [
  { when: "Day 1", strong: "Workspace setup.", rest: " Invite the core team and connect the primary inbox for the queue." },
  { when: "Day 2", strong: "Import open requests.", rest: " Bring in existing tickets from a spreadsheet or a prior tool." },
  { when: "Day 3", strong: "Configure routing.", rest: " Set SLA targets per request type; Northline suggests starting rules from the import." },
  { when: "Day 4", strong: "Add channels.", rest: " Turn on the web form and Slack command, then invite requesters." },
  { when: "Day 5", strong: "Go live.", rest: " The old inbox goes read-only; new requests flow through Northline only." },
];

export default function SolutionsPage() {
  return (
    <>
      <NavBar />

      <section className="shero">
        <div className="shero-copy">
          <span className="badge">One platform, every team</span>
          <h1>
            Built for the team
            <br />
            that owns <em>the queue</em>.
          </h1>
          <p>
            Different teams file different kinds of requests, but they all drown the same way:
            split across inboxes, with no shared view of what&apos;s open. Northline gives each
            team its own queue on one platform.
          </p>
          <div className="hero-actions">
            <button className="btn primary">Get a demo</button>
            <button className="btn">Talk to sales</button>
          </div>
        </div>

        <div className="shero-gallery" aria-hidden="true">
          <div className="griver-col up">
            <div className="griver-track">
              {[...COL_A, ...COL_A].map((card, i) => (
                <div className="griver-cell" key={i}>
                  <RiverCardView card={card} />
                </div>
              ))}
            </div>
          </div>
          <div className="griver-col down">
            <div className="griver-track">
              {[...COL_B, ...COL_B].map((card, i) => (
                <div className="griver-cell" key={i}>
                  <RiverCardView card={card} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="usecases">
        <h3>One platform, four queues</h3>
        {TEAMS.map((t) => (
          <div className="usecase" key={t.team}>
            <div className="mono">{t.mono}</div>
            <div>
              <span className="team">{t.team}</span>
              <h4>{t.title}</h4>
              <p>{t.body}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="timeline">
        <h3>How a team goes live</h3>
        <div className="tl">
          {ROLLOUT.map((s) => (
            <div className="tl-item" key={s.when}>
              <span className="when">{s.when}</span>
              <p>
                <strong>{s.strong}</strong>
                {s.rest}
              </p>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
