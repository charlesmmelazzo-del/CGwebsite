import { ScreenSkeleton } from "@/components/passport/bits";

/** File 06: a page opening over a tab shows its frame at once, with light placeholders, while it loads. */
export default function Loading() {
  return <ScreenSkeleton rows={5} />;
}
