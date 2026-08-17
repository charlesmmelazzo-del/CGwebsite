import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2, AlertCircle } from "lucide-react";
import AccountActions from "./AccountActions";
import { getViewer } from "@/lib/popup/auth";
import { getBallotHistory } from "@/lib/popup/voting";

export const dynamic = "force-dynamic";

const ACCENT = "#C97D5A";

export default async function AccountPage({
  searchParams,
}: {
  searchParams: { confirmed?: string };
}) {
  const viewer = await getViewer();
  if (!viewer) redirect("/popup/login?from=/popup/account");

  const history = await getBallotHistory(viewer.userId);
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
          Email confirmed — you&apos;re all set to vote.
        </p>
      )}

      {/* ── Status ─────────────────────────────────────────────────────────── */}
      <div className="mt-8 space-y-2.5">
        <StatusRow
          ok={viewer.emailVerified}
          okText="Email confirmed"
          pendingText="Email not confirmed yet — required to vote"
        />
        <StatusRow
          ok={viewer.ageVerified}
          okText="Age verified — 21 or older"
          pendingText="Age not verified"
        />
      </div>

      <AccountActions emailVerified={viewer.emailVerified} />

      {/* ── Their votes ────────────────────────────────────────────────────── */}
      <section className="mt-12">
        <h2 className="text-[10px] tracking-[0.25em] uppercase text-white/40 mb-4">Your picks</h2>
        {history.length === 0 ? (
          <p className="text-sm text-white/35 leading-relaxed">
            You haven&apos;t voted yet.{" "}
            <Link href="/popup" style={{ color: ACCENT }} className="hover:opacity-80">
              See what&apos;s pouring →
            </Link>
          </p>
        ) : (
          <ul className="space-y-4">
            {history.map((h) => (
              <li key={h.menuId} className="border border-white/10 rounded-lg p-4 bg-white/[0.03]">
                <Link
                  href={`/popup/m/${h.menuSlug}`}
                  className="text-sm text-white/90 hover:opacity-80"
                >
                  {h.menuTitle}
                </Link>
                <ol className="mt-2.5 space-y-1">
                  {h.picks.map((p) => (
                    <li key={p.rank} className="flex gap-2.5 text-xs text-white/55">
                      <span style={{ color: ACCENT }} className="tabular-nums w-3">
                        {p.rank}
                      </span>
                      <span>{p.name}</span>
                    </li>
                  ))}
                </ol>
              </li>
            ))}
          </ul>
        )}
      </section>
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
