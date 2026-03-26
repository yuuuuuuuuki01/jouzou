import type { Metadata } from "next";
import "./globals.css";

import { BrewPlannerProvider } from "@/components/brewing/brew-planner-provider";

export const metadata: Metadata = {
  title: "BrewPilot",
  description: "Sake brewing demand forecast and required volume planning"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body>
        <BrewPlannerProvider>{children}</BrewPlannerProvider>
      </body>
    </html>
  );
}
