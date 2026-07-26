"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Product" },
  { href: "/platform", label: "Platform" },
  { href: "/solutions", label: "Solutions" },
  { href: "/pricing", label: "Pricing" },
];

export default function NavBar() {
  const pathname = usePathname();

  return (
    <div className="topbar">
      <Link href="/" className="brand">
        <span className="mark" />
        Northline
      </Link>
      <div className="navlinks">
        {LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={pathname === link.href ? "active" : undefined}
          >
            {link.label}
          </Link>
        ))}
      </div>
      <div className="spacer" />
      <div className="navcta">
        <button className="btn">Sign in</button>
        <button className="btn primary">Get a demo</button>
      </div>
    </div>
  );
}
