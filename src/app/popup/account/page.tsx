import { redirect } from "next/navigation";
import { CheckCircle2, AlertCircle } from "lucide-react";
import AccountActions from "./AccountActions";
import { getViewer } from "@/lib/popup/auth";

export const dynamic = "force-dynamic";

export default async function AccountPage({
  searchParams,
}: {
  searchParams: { confirmed?: string };
}) {
  const viewer = await getViewer();
  if (!viewer) redirect("/popup/login?from=/popup/account");

  const name = [viewer.profile?.firstName, viewer.profile?.lastName].filter(Boolean).join(" ");

  return (
    <div className="max-w-md mx-auto px-6 py-14 sm:py-20">
      <h1
        style={{ fontFamily: "var(--font-display, serif)" }}
        className="text-3xl text-white text-center"
      >
        {name || "Your account"}
      </h1>
      <p className="mt-2 text-center text-xs text-white/40 break-all">{viewer.email}</p>

      {searchParams.confirmed === "1" && viewer.emailVerified && (
        <p className="mt-6 text-center text-xs text-green-300">
          Email confirmed — you&apos;re eligible for prizes.
        </p>
      )}

      {/* ── Status ─────────────────────────────────────────────────────────── */}
      <div className="mt-8 space-y-2.5">
        <StatusRow
          ok={viewer.emailVerified}
          okText="Email confirmed"
          pendingText="Email not confirmed yet — required to be sent a prize"
        />
        <StatusRow
          ok={viewer.ageVerified}
          okText="Age verified — 21 or older"
          pendingText="Age not verified"
        />
      </div>

      <AccountActions emailVerified={viewer.emailVerified} />
    </div>
  );
}

function StatusRow({
  ok,
  okText,
  pendingText,
}: {
  ok: boolean;
  okText: string;
  pendingText: string;
}) {
  return (
    <div
      className={`flex items-start gap-2.5 px-3.5 py-3 rounded-lg border ${
        ok ? "border-green-400/25 bg-green-400/[0.06]" : "border-amber-400/25 bg-amber-400/[0.06]"
      }`}
    >
      {ok ? (
        <CheckCircle2 size={15} className="text-green-300 shrink-0 mt-0.5" />
      ) : (
        <AlertCircle size={15} className="text-amber-300 shrink-0 mt-0.5" />
      )}
      <span className={`text-xs leading-relaxed ${ok ? "text-green-100/80" : "text-amber-100/80"}`}>
        {ok ? okText : pendingText}
      </span>
    </div>
  );
}
