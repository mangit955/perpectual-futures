import type { Metadata } from "next";
import "./globals.css";
import { SmoothScroll } from "@/components/smooth-scroll";

export const metadata: Metadata = {
  title: "Flux | Perpetual Futures Infrastructure",
  description:
    "A modern perpetual futures exchange built around event-driven execution, deterministic matching, durable persistence, and developer-first APIs.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html className="dark bg-[#09090b]" lang="en">
      <body className="bg-[#09090b] text-[#fafafa]">
        <SmoothScroll>{children}</SmoothScroll>
      </body>
    </html>
  );
}
