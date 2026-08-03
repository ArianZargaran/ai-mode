import Link from "next/link";
import Gyroscope from "@/components/Gyroscope";
import NavBar from "@/components/NavBar";

export default function NotFound() {
  return (
    <>
      <NavBar />
      <div className="nf">
        <div className="nf-404" aria-label="404">
          <span className="nf-digit" aria-hidden="true">4</span>
          <div className="nf-zero" aria-hidden="true">
            <Gyroscope cx={0.5} />
          </div>
          <span className="nf-digit" aria-hidden="true">4</span>
        </div>
        <p className="nf-line">
          Don&apos;t worry — take a spin <em>and go back</em>.
        </p>
        <div className="hero-actions">
          <Link href="/" className="btn primary">
            Back to home
          </Link>
          <Link href="/pricing" className="btn">
            See pricing
          </Link>
        </div>
      </div>
    </>
  );
}
