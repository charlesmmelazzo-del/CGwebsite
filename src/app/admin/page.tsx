import Link from "next/link";
import { cookies } from "next/headers";
import { PAGE_PANELS, GENERAL_PANEL, visibleTabs, type AdminPanel } from "@/lib/adminNav";
import { SESSION_COOKIE, getSession } from "@/lib/session";

function PanelCard({ panel, isOwner }: { panel: AdminPanel; isOwner: boolean }) {
  const Icon = panel.icon;
  return (
    <div className="p-5 bg-white border border-gray-200 rounded-sm hover:border-[#C97D5A]/40 hover:shadow-sm transition-all duration-200">
      <Link href={panel.tabs[0].href} className="flex items-start gap-3 group">
        <Icon size={18} className="text-gray-400 group-hover:text-[#C97D5A] mt-0.5 transition-colors shrink-0" />
        <div>
          <p className="text-gray-800 text-sm tracking-wider font-medium mb-1 group-hover:text-[#C97D5A] transition-colors">
            {panel.label}
          </p>
          <p className="text-gray-400 text-xs leading-relaxed">{panel.desc}</p>
        </div>
      </Link>
      <div className="mt-3 pl-[30px] flex flex-wrap gap-x-3 gap-y-1">
        {visibleTabs(panel, isOwner).map((t) => (
          <Link key={t.href} href={t.href} className="text-[11px] text-gray-500 hover:text-[#C97D5A] underline decoration-gray-200 underline-offset-2">
            {t.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

export default async function AdminDashboard() {
  const session = await getSession(cookies().get(SESSION_COOKIE)?.value);
  const isOwner = session?.role === "owner";
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl text-gray-800 mb-1" style={{ fontFamily: "var(--font-display)" }}>
          Common Good Admin
        </h1>
        <p className="text-gray-500 text-sm">
          Pick the page you want to change — everything for that page is in its panel.
        </p>
      </div>

      <div className="space-y-8">
        <div>
          <p className="text-xs tracking-widest uppercase text-gray-400 mb-3 border-b border-gray-200 pb-2">Website Pages</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {PAGE_PANELS.map((p) => <PanelCard key={p.key} panel={p} isOwner={isOwner} />)}
          </div>
        </div>
        <div>
          <p className="text-xs tracking-widest uppercase text-gray-400 mb-3 border-b border-gray-200 pb-2">Site-wide</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <PanelCard panel={GENERAL_PANEL} isOwner={isOwner} />
          </div>
        </div>
      </div>
    </div>
  );
}
