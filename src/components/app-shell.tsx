"use client";

import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { BarChart3, FlaskConical, Package2, TrendingUp } from "lucide-react";

const navItems = [
  { href: "/" as Route, label: "Data Import", icon: Package2 },
  { href: "/forecast" as Route, label: "Demand Forecast", icon: TrendingUp },
  { href: "/plan" as Route, label: "Brew Requirement", icon: FlaskConical }
];

export function AppShell({
  title,
  description,
  children
}: {
  title: string;
  description: string;
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
            <p className="eyebrow">Sake Planning Suite</p>
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
          <p className="eyebrow">Target Season</p>
          <strong>2026-10-01 to 2027-09-30</strong>
          <p className="muted">PoC scope: inventory, monthly sales history, and manual forecast overrides.</p>
        </div>
      </aside>

      <main className="main">
        <header className="page-header">
          <p className="eyebrow">Brewing Demand Planning</p>
          <h2>{title}</h2>
          <p className="page-description">{description}</p>
        </header>
        {children}
      </main>
    </div>
  );
}
