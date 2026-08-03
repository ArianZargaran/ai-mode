// Customer logo wall. Northline's customers are fictional, so each brand gets a
// simple monogram lockup (a lettermark + wordmark) rather than a plain text
// wordmark. Rendered as an infinite CSS marquee (no JS); it pauses on hover and
// collapses to a static row under prefers-reduced-motion.
const CUSTOMERS = [
  { name: "Vantree", m: "V" },
  { name: "Corda", m: "C" },
  { name: "Halyard", m: "H" },
  { name: "Fenwick & Yu", m: "F" },
  { name: "Orbital Freight", m: "O" },
  { name: "Delmarva", m: "D" },
  { name: "Kessler Labs", m: "K" },
  { name: "Brightpath", m: "B" },
];

export default function CustomerLogos() {
  return (
    <section className="trustwall" aria-label="Customers">
      <p className="lead">Trusted by ops teams at</p>
      <div className="marq-mask">
        <div className="marq">
          {[...CUSTOMERS, ...CUSTOMERS].map((c, i) => (
            <div className="logo-lockup" key={i} aria-hidden={i >= CUSTOMERS.length}>
              <span className="lm">{c.m}</span>
              <span className="lw">{c.name}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
