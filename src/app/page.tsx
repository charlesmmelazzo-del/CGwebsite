import HomeCarousel from "@/components/home/HomeCarousel";
import type { CarouselItem } from "@/types";

// Sample carousel items — admin will control these via DB
const SAMPLE_CAROUSEL: CarouselItem[] = [
  {
    id: "1",
    type: "text",
    order: 0,
    active: true,
    text: "Common Good is a cocktail house in the heart of Glen Ellyn, Illinois.",
  },
  {
    id: "2",
    type: "text",
    order: 1,
    active: true,
    text: "Modern, classic, upscale, seasonal and sometimes whimsical cocktails.",
  },
  {
    id: "3",
    type: "text",
    order: 2,
    active: true,
    text: "A space to celebrate life — from special occasions to day-to-day.",
  },
];

export default function HomePage() {
  return (
    <div
      className="min-h-screen relative flex flex-col items-center justify-center"
      style={{ backgroundColor: "#1A1F17" }}
    >
      {/* Full-bleed background image (set by admin) */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: "url('/images/backgrounds/home-bg.jpg')",
          opacity: 0.3,
        }}
      />

      {/* Botanical watermark */}
      <div
        className="absolute inset-0 flex items-center justify-center pointer-events-none"
        style={{ opacity: 0.08 }}
      >
        {/* placeholder for botanical illustration */}
      </div>

      {/* Carousel floats above background */}
      <div className="relative z-10 w-full max-w-4xl mx-auto px-4 py-16 animate-slide-up">
        <HomeCarousel items={SAMPLE_CAROUSEL} />
      </div>
    </div>
  );
}
