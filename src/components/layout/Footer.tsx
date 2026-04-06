import Link from "next/link";
import Image from "next/image";
import { SITE_SETTINGS, NAV_LINKS } from "@/lib/constants";
import { Phone, Mail, MapPin } from "lucide-react";

export default function Footer() {
  return (
    <footer className="bg-[#1A1F17] border-t border-[#2a3020] text-[#5a6a4a] text-xs">
      <div className="max-w-6xl mx-auto px-6 py-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">

          {/* Col 1: Hours */}
          <div>
            <p className="text-[#8A9A78] tracking-widest uppercase text-[10px] mb-3">Hours</p>
            {SITE_SETTINGS.hours.map((h) => (
              <div key={h.label} className="mb-3">
                <p className="text-[#8A9A78] tracking-wider uppercase text-[10px]">{h.label}</p>
                {h.lines.map((l, i) => (
                  <p key={i} className="leading-relaxed">{l}</p>
                ))}
              </div>
            ))}
          </div>

          {/* Col 2: Logo + Nav */}
          <div className="flex flex-col items-center gap-4">
            <Link href="/">
              <div className="relative w-16 h-16 opacity-70 hover:opacity-100 transition-opacity">
                <Image
                  src="/images/logo/logo.png"
                  alt="Common Good Cocktail House"
                  fill
                  className="object-contain"
                />
              </div>
            </Link>
            <nav className="flex flex-wrap justify-center gap-x-5 gap-y-2">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-[10px] tracking-widest uppercase hover:text-[#C97D5A] transition-colors"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>

          {/* Col 3: Contact */}
          <div className="md:text-right">
            <p className="text-[#8A9A78] tracking-widest uppercase text-[10px] mb-3">Contact</p>
            <div className="space-y-2">
              <a
                href={`tel:${SITE_SETTINGS.phone}`}
                className="flex md:justify-end items-center gap-2 hover:text-[#C97D5A] transition-colors"
              >
                <Phone size={11} />
                <span>{SITE_SETTINGS.phone}</span>
              </a>
              <a
                href={`mailto:${SITE_SETTINGS.email}`}
                className="flex md:justify-end items-center gap-2 hover:text-[#C97D5A] transition-colors"
              >
                <Mail size={11} />
                <span>{SITE_SETTINGS.email}</span>
              </a>
              <div className="flex md:justify-end items-start gap-2">
                <MapPin size={11} className="mt-0.5 shrink-0" />
                <div>
                  <p>{SITE_SETTINGS.address}</p>
                  <p>{SITE_SETTINGS.addressLine2}</p>
                </div>
              </div>
              {SITE_SETTINGS.socialLinks?.map((s) => (
                <a
                  key={s.label}
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex md:justify-end items-center gap-2 hover:text-[#C97D5A] transition-colors"
                >
                  <span className="text-xs">↗</span>
                  <span>{s.label}</span>
                </a>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-[#2a3020] text-center text-[10px] tracking-widest text-[#3a4a2a]">
          © {new Date().getFullYear()} COMMON GOOD COCKTAIL HOUSE — GLEN ELLYN, IL
        </div>
      </div>
    </footer>
  );
}
