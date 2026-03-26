"use client";

import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { BarChart3, FlaskConical, Package2, TrendingUp } from "lucide-react";

const navItems = [
  { href: "/" as Route, label: "データ取込", icon: Package2 },
  { href: "/forecast" as Route, label: "需要予測", icon: TrendingUp },
  { href: "/plan" as Route, label: "必要醸造量", icon: FlaskConical }
];

const defaultSidebarNote = {
  title: "対象シーズン",
  highlight: "2026-10-01 から 2027-09-30",
  body: "PoC 範囲: 製品在庫、月次売上実績、手動補正による需要予測。数量の単位はすべて L です。"
};

export function AppShell({
  eyebrow = "来季醸造量最適化",
  title,
  description,
  sidebarNote = defaultSidebarNote,
  children
}: {
  eyebrow?: string;
  title: string;
  description: string;
  sidebarNote?: {
    title: string;
    highlight: string;
    body: string;
  };
  children: ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-badge">
            <BarChart3 size={18} />
          </div>
          <div>
            <p className="eyebrow">酒造向け社内ツール</p>
            <h1>BrewPilot</h1>
          </div>
        </div>

        <nav className="nav">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;

            return (
              <Link key={item.href} href={item.href} className={`nav-link ${isActive ? "active" : ""}`}>
                <Icon size={18} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="sidebar-note">
          <p className="eyebrow">{sidebarNote.title}</p>
          <strong>{sidebarNote.highlight}</strong>
          <p className="muted">{sidebarNote.body}</p>
        </div>
      </aside>

      <main className="main">
        <header className="page-header">
          <p className="eyebrow">{eyebrow}</p>
          <h2>{title}</h2>
          <p className="page-description">{description}</p>
        </header>
        {children}
      </main>
    </div>
  );
}
