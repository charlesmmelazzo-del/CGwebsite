"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import {
  LayoutDashboard,
  Home,
  FileText,
  Calendar,
  UtensilsCrossed,
  Coffee,
  Users,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Menu,
  Type,
  Layout,
} from "lucide-react";

const NAV = [
  { href: "/admin",         label: "Dashboard",    icon: LayoutDashboard, exact: true },
  { href: "/admin/home",    label: "Home Page",    icon: Home },
  { href: "/admin/pages",   label: "Pages",        icon: FileText },
  { href: "/admin/header",  label: "Header & Nav", icon: Layout },
  { href: "/admin/menu",    label: "Menu",         icon: UtensilsCrossed },
  { href: "/admin/coffee",  label: "Coffee",       icon: Coffee },
  { href: "/admin/events",  label: "Events",       icon: Calendar },
  { href: "/admin/forms",   label: "Form Data",    icon: Users },
  { href: "/admin/fonts",   label: "Type & Fonts", icon: Type },
  { href: "/admin/settings",label: "Settings",     icon: Settings },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  // Login page renders standalone — no sidebar wrapper
  if (pathname === "/admin/login") return <>{children}</>;

  function isActive(item: (typeof NAV)[0]) {
    if (item.exact) return pathname === item.href;
    return pathname.startsWith(item.href) && item.href !== "/admin";
  }

  const Sidebar = (
    <aside
      className={clsx(
        "h-full bg-white border-r border-gray-200 flex flex-col transition-all duration-300",
        collapsed ? "w-14" : "w-56"
      )}
    >
      {/* Logo area */}
      <div className="flex items-center justify-between p-3 border-b border-gray-200 min-h-[52px]">
        {!collapsed && (
          <span className="text-gray-400 text-xs tracking-widest uppercase font-medium truncate">
            Admin
          </span>
        )}
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="text-gray-400 hover:text-gray-600 ml-auto hidden md:flex"
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 space-y-0.5">
        {NAV.map((item) => {
          const Icon = item.icon;
          const active = isActive(item);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={clsx(
                "flex items-center gap-3 px-3 py-2.5 text-xs tracking-wider uppercase transition-colors duration-150",
                active
                  ? "text-[#C97D5A] bg-[#C97D5A]/10"
                  : "text-gray-500 hover:text-gray-800 hover:bg-gray-100"
              )}
            >
              <Icon size={15} className="shrink-0" />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="p-3 border-t border-gray-200 space-y-0.5">
        <Link
          href="/"
          className="flex items-center gap-3 px-3 py-2 text-xs tracking-wider uppercase text-gray-400 hover:text-gray-700 transition-colors"
        >
          <LogOut size={15} className="shrink-0" />
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
      {/* Desktop sidebar */}
      <div className="hidden md:flex">{Sidebar}</div>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="w-56 h-full">{Sidebar}</div>
          <div className="flex-1 bg-black/40" onClick={() => setMobileOpen(false)} />
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile topbar */}
        <div className="md:hidden flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-200">
          <button
            onClick={() => setMobileOpen(true)}
            className="text-gray-500 hover:text-gray-700"
          >
            <Menu size={20} />
          </button>
          <span className="text-xs tracking-widest uppercase text-gray-500">Admin Panel</span>
        </div>

        {/* Scrollable content — full-height (no padding) for page builder + header editor */}
        <div className={clsx(
          "flex-1 flex flex-col overflow-hidden",
          pathname.startsWith("/admin/pages") || pathname.startsWith("/admin/header")
            ? ""
            : "overflow-y-auto p-6"
        )}>{children}</div>
      </div>
    </div>
  );
}
