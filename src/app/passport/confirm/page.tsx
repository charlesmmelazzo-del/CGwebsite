import type { Metadata } from "next";
import { Suspense } from "react";
import Confirm from "@/components/passport/Confirm";

// The link's code is in the address: never pass it on to other sites.
export const metadata: Metadata = { referrer: "no-referrer" };

export default function ConfirmPage() {
  return (
    <Suspense>
      <Confirm />
    </Suspense>
  );
}
