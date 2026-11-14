"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import {
  LayoutDashboard, ChevronLeft, ChevronRight, LogOut, Menu, ExternalLink, Globe,
} from "lucide-react";
import { PAGE_PANELS, GENERAL_PANEL, findPanel, visibleTabs, type AdminPanel } from "@/lib/adminNav";

type Me = { role: "owner" | "user"; username: string; name: string };

// Editors that manage their own full-height layout (side-by-side preview etc.)
const FULL_HEIGHT = ["/admin/pages", "/admin/header", "/admin/images"];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [me, setMe] = useState<Me | null>(null);
  const pathname = usePathname();
  const onLogin = pathname === "/admin/login";

  // Who's signed in — decides whether the Users tab shows, and names them in
  // the sidebar. Re-read after signing in (the layout stays mounted).
  useEffect(() => {
    if (onLogin) { setMe(null); return; }
    let live = true;
    fetch("/api/admin/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (live) setMe(d); })
      .catch(() => {});
    return () => { live = false; };
  }, [onLogin]);

  // Login page renders standalone — no sidebar wrapper
  if (onLogin) return <>{children}</>;

  const current = findPanel(pathname);
  const fullHeight = FULL_HEIGHT.some((p) => pathname.startsWith(p));

  function navLink(href: string, label: string, Icon: AdminPanel["icon"], active: boolean) {
    return (
      <Link
        key={href}
        href={href}
        onClick={() => setMobileOpen(false)}
        title={collapsed ? label : undefined}
        aria-current={active ? "page" : undefined}
        className={clsx(
          "flex items-center gap-3 px-3 py-2.5 text-xs tracking-wider uppercase transition-colors duration-150 border-l-2",
          active
            ? "text-[#C97D5A] bg-[#C97D5A]/10 border-[#C97D5A]"
            : "text-gray-500 hover:text-gray-800 hover:bg-gray-100 border-transparent"
        )}
      >
        <Icon size={15} className="shrink-0" />
        {!collapsed && <span className="truncate">{label}</span>}
      </Link>
    );
  }

  function groupLabel(text: string) {
    return collapsed ? (
      <div className="mx-3 my-2 border-t border-gray-100" />
    ) : (
      <p className="px-3 pt-4 pb-1 text-[10px] tracking-widest uppercase text-gray-300 font-medium">{text}</p>
    );
  }

  const Sidebar = (
    <aside
      className={clsx(
        "h-full bg-white border-r border-gray-200 flex flex-col transition-all duration-300",
        collapsed ? "w-14" : "w-56"
      )}
    >
      <div className="flex items-center justify-between p-3 border-b border-gray-200 min-h-[52px]">
        {!collapsed && (
          <span className="text-gray-400 text-xs tracking-widest uppercase font-medium truncate">
            Common Good Admin
          </span>
        )}
        <button
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="text-gray-400 hover:text-gray-600 ml-auto hidden md:flex"
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      <nav className="flex-1 py-2 overflow-y-auto">
        {navLink("/admin", "Dashboard", LayoutDashboard, pathname === "/admin")}

        {groupLabel("Website Pages")}
        {PAGE_PANELS.map((p) => navLink(p.tabs[0].href, p.label, p.icon, current?.panel.key === p.key))}

        {groupLabel("Site-wide")}
        {navLink(GENERAL_PANEL.tabs[0].href, GENERAL_PANEL.label, GENERAL_PANEL.icon, current?.panel.key === "general")}
      </nav>

      <div className="p-3 border-t border-gray-200 space-y-0.5">
        {me && !collapsed && (
          <p className="px-3 pb-1.5 text-[11px] text-gray-400 truncate" title={`Signed in as ${me.name}`}>
            Signed in as <span className="text-gray-600">{me.name}</span>
          </p>
        )}
        <Link
          href="/"
          target="_blank"
          className="flex items-center gap-3 px-3 py-2 text-xs tracking-wider uppercase text-gray-400 hover:text-gray-700 transition-colors"
        >
          <Globe size={15} className="shrink-0" />
          {!collapsed && <span>View Site</span>}
        </Link>
        <button
          onClick={async () => {
            await fetch("/api/admin/login", { method: "DELETE" });
            window.location.href = "/admin/login";
          }}
          className="w-full flex items-center gap-3 px-3 py-2 text-xs tracking-wider uppercase text-gray-400 hover:text-red-500 transition-colors"
        >
          <LogOut size={15} className="shrink-0 rotate-180" />
          {!collapsed && <span>Log Out</span>}
        </button>
      </div>
    </aside>
  );

  return (
    <div className="flex h-screen bg-gray-50 text-gray-800 overflow-hidden">
      <div className="hidden md:flex">{Sidebar}</div>

      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="w-56 h-full">{Sidebar}</div>
          <div className="flex-1 bg-black/40" onClick={() => setMobileOpen(false)} />
        </div>
      )}

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Mobile topbar */}
        <div className="md:hidden flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-200">
          <button onClick={() => setMobileOpen(true)} aria-label="Open menu" className="text-gray-500 hover:text-gray-700">
            <Menu size={20} />
          </button>
          <span className="text-xs tracking-widest uppercase text-gray-500">
            {current ? current.panel.label : "Admin"}
          </span>
        </div>

        {/* Panel header — which page you're editing, and everything you can change on it */}
        {current && (
          <div className="shrink-0 bg-white border-b border-gray-200 px-6 pt-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2.5 min-w-0">
                <current.panel.icon size={18} className="text-[#C97D5A] shrink-0" />
                <h1 className="text-xl text-gray-800 truncate" style={{ fontFamily: "var(--font-display)" }}>
                  {current.panel.label}
                </h1>
              </div>
              {current.panel.publicHref && (
                <Link
                  href={current.panel.publicHref}
                  target="_blank"
                  className="flex items-center gap-1.5 text-[11px] tracking-widest uppercase text-gray-400 hover:text-[#C97D5A] transition-colors shrink-0"
                >
                  View page <ExternalLink size={12} />
                </Link>
              )}
            </div>
            <div className="flex gap-1 mt-3 -mb-px overflow-x-auto" role="tablist" aria-label={`${current.panel.label} sections`}>
              {visibleTabs(current.panel, me?.role === "owner").map((t) => {
                const active = t.href === current.tab.href;
                return (
                  <Link
                    key={t.href}
                    href={t.href}
                    role="tab"
                    aria-selected={active}
                    className={clsx(
                      "px-4 py-2 text-xs tracking-widest uppercase whitespace-nowrap border-b-2 transition-colors",
                      active
                        ? "border-[#C97D5A] text-[#C97D5A]"
                        : "border-transparent text-gray-500 hover:text-gray-800"
                    )}
                  >
                    {t.label}
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* Content — full-height (no padding) for editors with their own layout */}
        <div className={clsx("flex-1 flex flex-col overflow-hidden", !fullHeight && "overflow-y-auto p-6")}>
          {children}
        </div>
      </div>
    </div>
  );
}
