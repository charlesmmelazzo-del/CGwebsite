import Link from "next/link";
import {
  Home, FileText, Calendar, UtensilsCrossed, Coffee, Users, Settings,
  Type, Layout, Files, AlignLeft, ImageIcon,
} from "lucide-react";

const GROUPS = [
  {
    group: "Pages & Content",
    cards: [
      { href: "/admin/home",      icon: Home,      title: "Home Page",     desc: "Edit carousel slides and background image" },
      { href: "/admin/pages",     icon: FileText,  title: "Pages",         desc: "Build pages with live preview — text, images, events, CTAs" },
      { href: "/admin/content",   icon: Files,     title: "Content Pages", desc: "Edit the About, Club, and Shop page content" },
      { href: "/admin/page-text", icon: AlignLeft, title: "Page Headers",  desc: "Title, background, and color theme at the top of each page" },
    ],
  },
  {
    group: "Menus",
    cards: [
      { href: "/admin/menu",   icon: UtensilsCrossed, title: "Cocktail Menu", desc: "Manage cocktail menu tabs and items" },
      { href: "/admin/coffee", icon: Coffee,          title: "Coffee Menu",   desc: "Manage coffee menu tabs and images" },
    ],
  },
  {
    group: "Site Setup",
    cards: [
      { href: "/admin/header",   icon: Layout,   title: "Header & Nav", desc: "Edit nav links, colors, logo size, footer" },
      { href: "/admin/fonts",    icon: Type,     title: "Type & Fonts", desc: "Upload fonts, assign to headings, nav, buttons" },
      { href: "/admin/settings", icon: Settings, title: "Settings",     desc: "Business info, hours, social links, notification emails" },
    ],
  },
  {
    group: "Media & Data",
    cards: [
      { href: "/admin/images", icon: ImageIcon, title: "Images",           desc: "Upload and manage the image library" },
      { href: "/admin/forms",  icon: Users,     title: "Form Submissions", desc: "View, export, and email customer form submissions" },
    ],
  },
  {
    group: "Events",
    cards: [
      { href: "/admin/events", icon: Calendar, title: "Events", desc: "Add & manage calendar events" },
    ],
  },
];

export default function AdminDashboard() {
  return (
    <div>
      <div className="mb-8">
        <h1
          className="text-3xl text-gray-800 mb-1"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Common Good Admin
        </h1>
        <p className="text-gray-500 text-sm">Manage your website content</p>
      </div>

      <div className="space-y-8">
        {GROUPS.map((section) => (
          <div key={section.group}>
            <p className="text-xs tracking-widest uppercase text-gray-400 mb-3 border-b border-gray-200 pb-2">
              {section.group}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {section.cards.map((card) => {
                const Icon = card.icon;
                return (
                  <Link
                    key={card.href}
                    href={card.href}
                    className="p-5 bg-white border border-gray-200 rounded-sm hover:border-[#C97D5A]/40 hover:shadow-sm transition-all duration-200 group"
                  >
                    <div className="flex items-start gap-3">
                      <Icon size={18} className="text-gray-400 group-hover:text-[#C97D5A] mt-0.5 transition-colors shrink-0" />
                      <div>
                        <p className="text-gray-800 text-sm tracking-wider font-medium mb-1">
                          {card.title}
                        </p>
                        <p className="text-gray-400 text-xs leading-relaxed">{card.desc}</p>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
