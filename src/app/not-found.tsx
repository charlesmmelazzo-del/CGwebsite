import Link from "next/link";

// Branded 404 shown for unknown routes, replacing Next.js's default.
export default function NotFound() {
  return (
    <div
      style={{ backgroundColor: "#3B5040", color: "#A8C4A0" }}
      className="min-h-screen flex flex-col items-center justify-center px-6 text-center"
    >
      <p className="text-6xl font-serif mb-2">404</p>
      <h1 className="text-2xl sm:text-3xl font-serif mb-3 tracking-wide">
        Page not found
      </h1>
      <p className="max-w-md text-sm sm:text-base opacity-80 mb-8">
        The page you&apos;re looking for doesn&apos;t exist or has moved.
      </p>
      <Link
        href="/"
        style={{ borderColor: "#A8C4A0", color: "#A8C4A0" }}
        className="border px-6 py-2.5 text-sm tracking-widest uppercase transition-opacity hover:opacity-70"
      >
        Back home
      </Link>
    </div>
  );
}
