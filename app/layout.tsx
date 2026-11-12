import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { AppShell } from "@/components/app-shell";
import { EntityProvider } from "@/components/entity-provider";
import { SystemProvider } from "@/components/system-provider";

export const metadata: Metadata = {
  title: "District 12 · Group Management",
  description:
    "Operations, finance and performance management for The District 12 Group of Companies.",
  icons: { icon: "/district-12-logo.png" },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <SystemProvider>
          <EntityProvider>
            <AppShell>{children}</AppShell>
          </EntityProvider>
        </SystemProvider>
      </body>
    </html>
  );
}
