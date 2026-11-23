import type { Metadata } from "next";
import type { ReactNode } from "react";
import { TENANT } from "@/lib/tenant";
import "./globals.css";

export const metadata: Metadata = {
  title: `${TENANT.shortName} — District 12`,
  description: `${TENANT.name}: ${TENANT.tagline}. Part of the District 12 group ecosystem.`,
  icons: {
    icon: "/brand/talent-clinic-mark.png",
    shortcut: "/brand/talent-clinic-mark.png",
    apple: "/brand/talent-clinic-mark.png",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
