// Hand-drawn line doodle for the home hero (Notion-illustration inspired).
// On-theme: loose ticket cards flow along a sketched arrow into one "queue"
// list, with doodle accents. Ink strokes + accent highlights; a couple of
// marks float gently (disabled under prefers-reduced-motion via CSS).
export default function HeroDoodle() {
  return (
    <svg
      className="hero-doodle"
      viewBox="0 0 520 460"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {/* incoming ticket cards on the left (sway toward the queue) */}
      <g className="dl-ticket t1" transform="rotate(-9 120 130)">
        <rect x="58" y="96" width="122" height="78" rx="14" />
        <line x1="78" y1="124" x2="150" y2="124" strokeWidth="3" />
        <line x1="78" y1="146" x2="132" y2="146" />
      </g>
      <g className="dl-ticket t2" transform="rotate(8 110 270)">
        <rect x="48" y="238" width="122" height="78" rx="14" />
        <line x1="68" y1="266" x2="140" y2="266" strokeWidth="3" />
        <line x1="68" y1="288" x2="122" y2="288" />
      </g>

      {/* sketched arrows routing into the queue (draw in on loop) */}
      <g stroke="var(--accent)">
        <path className="dl-route r1" d="M188 132 C 248 118 250 196 226 224" />
        <path className="dl-route r2" d="M220 214 l8 12 13 -6" />
        <path className="dl-route r3" d="M180 276 C 232 274 232 260 224 250" />
        <path className="dl-route r4" d="M216 258 l10 -9 4 12" />
      </g>

      {/* the one queue */}
      <rect x="196" y="120" width="252" height="224" rx="22" />
      <line x1="224" y1="160" x2="340" y2="160" strokeWidth="3.4" />
      <circle cx="418" cy="156" r="7" stroke="var(--accent)" />

      <rect x="224" y="188" width="20" height="20" rx="6" />
      <path className="dl-check c1" d="M229 198 l4 5 8 -10" stroke="var(--accent)" />
      <line x1="258" y1="198" x2="410" y2="198" />

      <rect x="224" y="232" width="20" height="20" rx="6" />
      <path className="dl-check c2" d="M229 242 l4 5 8 -10" stroke="var(--accent)" />
      <line x1="258" y1="242" x2="410" y2="242" />

      <rect x="224" y="276" width="20" height="20" rx="6" />
      <line x1="258" y1="286" x2="386" y2="286" />

      {/* doodle accents */}
      <g className="dl-float">
        <path
          d="M462 96 l7 20 20 7 -20 7 -7 20 -7 -20 -20 -7 20 -7 z"
          stroke="var(--accent)"
        />
      </g>
      <g className="dl-float2" stroke="var(--gold)">
        <circle cx="474" cy="300" r="6" />
        <line x1="474" y1="282" x2="474" y2="276" />
        <line x1="474" y1="324" x2="474" y2="318" />
        <line x1="456" y1="300" x2="450" y2="300" />
        <line x1="498" y1="300" x2="492" y2="300" />
        <line x1="461" y1="287" x2="457" y2="283" />
        <line x1="491" y1="313" x2="487" y2="309" />
      </g>
      <path d="M214 392 q 18 -15 36 0 t 36 0 t 36 0" stroke="var(--ink-soft)" />
      <path d="M138 66 l7 8 13 -16" stroke="var(--accent)" />
      <circle cx="120" cy="360" r="3" fill="var(--accent)" stroke="none" />
      <circle cx="404" cy="392" r="3" fill="var(--gold)" stroke="none" />
      <circle cx="486" cy="196" r="3" fill="var(--accent)" stroke="none" />
    </svg>
  );
}
