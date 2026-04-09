import HomeCarousel from "@/components/home/HomeCarousel";
import { getHomeData } from "@/lib/homedata";

export default async function HomePage() {
  const { bgUrl, carouselItems, autoAdvance, autoAdvanceInterval } = await getHomeData();

  const now = new Date();
  const visibleItems = carouselItems
    .filter((i) => {
      if (!i.active) return false;
      if (i.startDate && new Date(i.startDate) > now) return false;
      if (i.endDate && new Date(i.endDate) < now) return false;
      return true;
    })
    .sort((a, b) => a.order - b.order);

  return (
    <div
      className="min-h-screen relative flex flex-col items-center justify-center"
      style={{ backgroundColor: "#1A1F17" }}
    >
      {/* Full-bleed background image — only when admin has set one */}
      {bgUrl && (
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: `url('${bgUrl}')`, opacity: 0.35 }}
        />
      )}

      {/* Gradient overlay so carousel text stays readable over any bg image */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/60 pointer-events-none" />

      {/* Carousel floats above background */}
      <div className="relative z-10 w-full max-w-4xl mx-auto px-4 py-16 animate-slide-up">
        <HomeCarousel
          items={visibleItems}
          autoAdvance={autoAdvance}
          autoAdvanceInterval={autoAdvanceInterval}
        />
      </div>
    </div>
  );
}
