"use client";

import type { ReactNode } from "react";
import { ScreenSkeleton, ViewError } from "../bits";
import { useShell, useView, type ViewName } from "../shellContext";

/**
 * File 06: a tab's frame. The tab shows at once; until its data arrives, light placeholders shaped like its content.
 * After that it keeps what it has on screen while it refreshes in the background (no flash, no jump).
 */
export default function TabView<T>({ name, skeleton, children }: { name: ViewName; skeleton?: ReactNode; children: (data: T, version: number) => ReactNode }) {
  const shell = useShell();
  const v = useView<T>(name);
  if (v.data) return <>{children(v.data, v.version)}</>;
  if (v.error) return <ViewError message={v.error} onRetry={() => shell?.views.load(name)} />;
  return <>{skeleton ?? <ScreenSkeleton />}</>;
}
