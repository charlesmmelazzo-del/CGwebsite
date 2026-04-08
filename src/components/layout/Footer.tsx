import Link from "next/link";
import Image from "next/image";
import { SITE_SETTINGS } from "@/lib/constants";
import { Phone, Mail, MapPin } from "lucide-react";
import type { FooterConfig, SiteSettings } from "@/types";

export default function Footer({ config, settings, logoUrl }: { config: FooterConfig; settings?: SiteSettings; logoUrl?: string }) {
  // Use live settings from Supabase if available, fall back to hardcoded constants
  const s = settings ?? SITE_SETTINGS;
  const bg     = config.bgColor    ?? "#1A1F17";
  const text   = config.textColor  ?? "#8A9A78";
  const muted  = config.mutedColor ?? "#4a5a3a";
  const border = `${muted}50`;

  return (
    <footer style={{ background: bg, color: muted }} className="text-xs">
      <div className="max-w-6xl mx-auto px-6 py-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">

          {/* Col 1: Hours */}
          {config.showHours && (
            <div>
              <p style={{ color: text }} className="tracking-widest uppercase text-[10px] mb-3">Hours</p>
              {s.hours.map((h) => (
                <div key={h.label} className="mb-3">
                  <p style={{ color: text }} className="tracking-wider uppercase text-[10px]">{h.label}</p>
                  {h.lines.map((l, i) => (
                    <p key={i} className="leading-relaxed">{l}</p>
                  ))}
                </div>
              ))}
            </div>
          )}

          {/* Col 2: Logo + Nav */}
          <div className="flex flex-col items-center gap-4">
            <Link href="/">
              <div className="relative w-16 h-16 opacity-70 hover:opacity-100 transition-opacity">
                <Image
                  src={logoUrl || "/images/logo/logo.svg"}
                  alt="Common Good Cocktail House"
                  fill
                  unoptimized
                  className="object-contain"
                />
              </div>
            </Link>
            <nav className="flex flex-wrap justify-center gap-x-5 gap-y-2">
              {["About", "Club", "Shop", "Events", "Menu", "Coffee"].map((label) => (
                <Link
                  key={label}
                  href={`/${label.toLowerCase()}`}
                  style={{ color: muted }}
                  className="text-[10px] tracking-widest uppercase hover:opacity-80 transition-opacity"
                >
                  {label.toUpperCase()}
                </Link>
              ))}
            </nav>
          </div>

          {/* Col 3: Contact */}
          {config.showContact && (
            <div className="md:text-right">
              <p style={{ color: text }} className="tracking-widest uppercase text-[10px] mb-3">Contact</p>
              <div className="space-y-2">
                <a
                  href={`tel:${s.phone}`}
                  style={{ color: muted }}
                  className="flex md:justify-end items-center gap-2 hover:opacity-80 transition-opacity"
                >
                  <Phone size={11} />
                  <span>{s.phone}</span>
                </a>
                <a
                  href={`mailto:${s.email}`}
                  style={{ color: muted }}
                  className="flex md:justify-end items-center gap-2 hover:opacity-80 transition-opacity"
                >
                  <Mail size={11} />
                  <span>{s.email}</span>
                </a>
                <div style={{ color: muted }} className="flex md:justify-end items-start gap-2">
                  <MapPin size={11} className="mt-0.5 shrink-0" />
                  <div>
                    <p>{s.address}</p>
                    <p>{s.addressLine2}</p>
                  </div>
                </div>
                {config.showSocialLinks && s.socialLinks?.map((link) => (
                  <a
                    key={link.label}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: muted }}
                    className="flex md:justify-end items-center gap-2 hover:opacity-80 transition-opacity"
                  >
                    <span className="text-xs">↗</span>
                    <span>{link.label}</span>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>

        <div
          style={{ borderTop: `1px solid ${border}`, color: muted }}
          className="mt-8 pt-6 text-center text-[10px] tracking-widest opacity-60"
        >
          {config.copyrightText ?? `© ${new Date().getFullYear()} COMMON GOOD COCKTAIL HOUSE — GLEN ELLYN, IL`}
        </div>
      </div>
    </footer>
  );
}
