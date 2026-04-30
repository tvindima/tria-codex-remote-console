"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AlertTriangle, FolderKanban, House, Settings, Workflow } from "lucide-react";

import { cn } from "@/lib/utils";

const navItems = [
  { label: "Home", href: "/dashboard", icon: House },
  { label: "Projects", href: "/projects", icon: FolderKanban },
  { label: "Threads", href: "/threads", icon: Workflow },
  { label: "Alerts", href: "/approvals", icon: AlertTriangle, badge: true },
  { label: "Settings", href: "/settings", icon: Settings },
];

const isActive = (pathname: string, href: string) => {
  if (href === "/dashboard") {
    return pathname === "/dashboard";
  }
  return pathname.startsWith(href);
};

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="mobile-safe fixed bottom-2 left-1/2 z-40 w-[calc(100vw-1.25rem)] max-w-[452px] -translate-x-1/2 rounded-[26px] border border-white/14 bg-white/10 px-2 py-2 backdrop-blur-xl shadow-[0_20px_60px_rgba(0,0,0,0.4)]">
      <ul className="flex items-center justify-between gap-1">
        {navItems.map(({ label, href, icon: Icon, badge }) => {
          const active = isActive(pathname, href);

          return (
            <li key={href} className="relative flex-1">
              <Link
                href={href}
                className={cn(
                  "flex min-h-11 flex-col items-center justify-center rounded-2xl border border-transparent text-[11px] font-semibold transition",
                  active
                    ? "bg-blue-500/18 text-blue-300 border-blue-400/40"
                    : "text-slate-400 hover:text-slate-200",
                )}
              >
                <div className="relative">
                  <Icon className={cn("h-4 w-4", active ? "text-blue-300" : "text-slate-400")} />
                  {badge ? (
                    <span className="absolute -right-2 -top-2 h-2.5 w-2.5 rounded-full bg-blue-400 shadow-[0_0_0_2px_rgba(5,7,11,0.8)]" />
                  ) : null}
                </div>
                <span className="mt-1 leading-none">{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
