import { BackLink } from "@/components/passport/bits";
import Unavailable from "@/components/passport/Unavailable";
import { PageTitle } from "@/components/passport/Library";
import { MyPhotosList } from "@/components/passport/Photos";
import { getMyPhotos } from "@/lib/passport/bible";
import { memberData } from "@/lib/passport/member";

export const dynamic = "force-dynamic";

/**
 * File 11: My photos (Index → Yours). Every photo the member kept, newest first, each opening its cocktail or bottle.
 * A photo Common Good removed shows "Removed by Common Good" in its place once.
 */
export default async function MyPhotosPage() {
  const r = await memberData((auth) => getMyPhotos(auth));
  if (!r.data) return <Unavailable />;
  return (
    <>
      <BackLink fallback="/passport/library" label="Index" />
      <div className="mt-3" />
      <PageTitle kicker="Yours" title="My photos" />
      <MyPhotosList initial={r.data} />
    </>
  );
}
