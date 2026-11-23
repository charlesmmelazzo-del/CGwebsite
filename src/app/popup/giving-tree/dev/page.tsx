import { notFound } from "next/navigation";
import PopupExperience from "@/components/popup/PopupExperience";
import { memoryMode } from "@/lib/givingTree/store";
import type { PopupCocktail, PopupMenu } from "@/lib/popup/types";

export const dynamic = "force-dynamic";

/**
 * LOCAL DEVELOPMENT ONLY. With GIVING_TREE_MEMORY=1 (never on in production)
 * this shows the Giving Tree sandbox without a database, since the real
 * sandbox (/popup/preview/christmas) needs the pop-up's row in Supabase.
 * Everywhere else it's a 404.
 */
export default function GivingTreeDevPage() {
  if (!memoryMode) notFound();
  const now = new Date().toISOString();
  const menu: PopupMenu = {
    id: "dev-christmas",
    slug: "christmas",
    title: "The Giving Tree",
    templateKey: "giving-tree",
    config: {},
    status: "draft",
    createdAt: now,
    updatedAt: now,
  };
  const cocktails: PopupCocktail[] = [1, 2, 3].map((n) => ({
    id: `dev-${n}`,
    menuId: menu.id,
    name: `Christmas cocktail ${["one", "two", "three"][n - 1]}`,
    tagline: "Placeholder until the Christmas menu is set",
    order: n,
    active: true,
    meta: { recipePdfUrl: "/popup/giving-tree/placeholder-recipe.pdf" },
  }));
  return <PopupExperience menu={menu} cocktails={cocktails} viewer={null} isLive isSandbox />;
}
