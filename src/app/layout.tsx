import type { Metadata } from "next";
import "./globals.css";
import AiModeInput from "@/components/AiModeInput";

export const metadata: Metadata = {
  title: "Northline — Ask Nova",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        {/* single persistent instance — survives page navigation so its
            state (collapsed/expanded/active) blends across routes; prompts
            follow the current page via usePathname */}
        <AiModeInput />
      </body>
    </html>
  );
}
