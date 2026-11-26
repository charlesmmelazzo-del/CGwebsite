import { NewGroup } from "@/components/passport/Rooms";
import { memberData } from "@/lib/passport/member";

export const dynamic = "force-dynamic";

/** File 16: start a friend group (a name and friends; each friend gets an invitation). */
export default async function Page() {
  await memberData(async () => null);
  return <NewGroup />;
}
