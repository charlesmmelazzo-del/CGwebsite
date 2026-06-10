import { ImageResponse } from "next/og";

// Dynamically generated 1200×630 social share card on the brand green palette.
// Avoids shipping a binary asset; renders the same for every page that doesn't
// override its own OG image.
export const runtime = "edge";
export const alt = "Common Good Cocktail House — Glen Ellyn, IL";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#3B5040",
          color: "#A8C4A0",
          fontFamily: "Georgia, serif",
          textAlign: "center",
          padding: "0 80px",
        }}
      >
        <div style={{ fontSize: 84, letterSpacing: 2, lineHeight: 1.05 }}>
          Common Good
        </div>
        <div style={{ fontSize: 84, letterSpacing: 2, lineHeight: 1.05 }}>
          Cocktail House
        </div>
        <div
          style={{
            marginTop: 36,
            fontSize: 30,
            letterSpacing: 6,
            textTransform: "uppercase",
            color: "#6a8a72",
          }}
        >
          Glen Ellyn, Illinois
        </div>
      </div>
    ),
    size
  );
}
