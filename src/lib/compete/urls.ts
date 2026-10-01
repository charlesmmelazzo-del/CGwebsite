// Absolute links for QR codes and copy-able invite links.

import { headers } from "next/headers";
import QRCode from "qrcode";

/** This deployment's own origin — staging links point at staging. */
export function siteOrigin(): string {
  const h = headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "commongoodcocktailhouse.com";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export async function qrSvg(url: string, dark = "#12110e", light = "#00000000"): Promise<string> {
  return QRCode.toString(url, { type: "svg", margin: 0, errorCorrectionLevel: "M", color: { dark, light } });
}
