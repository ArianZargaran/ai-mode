import type { Metadata } from "next";
import NavBar from "@/components/NavBar";

export const metadata: Metadata = { title: "Pricing - Northline" };

const CHECK = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
    <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export default function PricingPage() {
  return (
    <>
      <NavBar />

      <div className="hero single">
        <div className="hero-copy">
          <p className="eyebrow">Pricing</p>
          <h1>
            Simple, <em>per-seat</em> pricing.
          </h1>
          <p>
            No setup fee on any plan. Seats add or remove any time and billing prorates
            automatically. Every plan starts with a 14-day trial, no card required.
          </p>
        </div>
      </div>

      <div className="plans">
        <div className="plan">
          <span className="plan-name">Team</span>
          <div className="price">$29<small>/seat/mo</small></div>
          <p className="plan-desc">For teams under 20 people running one queue.</p>
          <ul>
            <li>{CHECK}Unified queue across email &amp; forms</li>
            <li>{CHECK}Routing rules &amp; shared status board</li>
            <li>{CHECK}Email support</li>
          </ul>
          <button className="btn">Start free</button>
        </div>

        <div className="plan featured">
          <span className="plan-badge">Most popular</span>
          <span className="plan-name">Business</span>
          <div className="price">$59<small>/seat/mo</small></div>
          <p className="plan-desc">Adds Nova AI, custom SLAs, and API access.</p>
          <ul>
            <li>{CHECK}Everything in Team</li>
            <li>{CHECK}Nova AI: routing, drafts, anomaly alerts</li>
            <li>{CHECK}Custom SLAs &amp; full REST API</li>
            <li>{CHECK}30-day onboarding specialist included</li>
          </ul>
          <button className="btn primary">Get a demo</button>
        </div>

        <div className="plan">
          <span className="plan-name">Enterprise</span>
          <div className="price">Custom</div>
          <p className="plan-desc">Adds SSO, audit log, and dedicated support.</p>
          <ul>
            <li>{CHECK}Everything in Business</li>
            <li>{CHECK}SSO/SAML &amp; SCIM provisioning</li>
            <li>{CHECK}Full audit log &amp; data residency choice</li>
            <li>{CHECK}Dedicated support contact</li>
          </ul>
          <button className="btn">Talk to sales</button>
        </div>
      </div>

      <div className="finePrint">
        <div>
          <strong>Annual billing</strong>
          Save roughly 15% versus paying monthly, on any plan.
        </div>
        <div>
          <strong>Nonprofit &amp; education</strong>
          30% off Business is available through sales - not self-serve.
        </div>
        <div>
          <strong>No setup fee</strong>
          Every plan, including Enterprise, has zero implementation fee.
        </div>
      </div>
    </>
  );
}
