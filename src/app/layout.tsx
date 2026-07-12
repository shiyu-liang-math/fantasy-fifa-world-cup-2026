import type { Metadata } from "next";

import { SiteHeader } from "@/components/site-header";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Fantasy FIFA World Cup 2026",
    template: "%s | Fantasy FIFA World Cup 2026",
  },
  description:
    "A private fantasy tournament tracker currently under development.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <a className="skip-link" href="#main-content">
          Skip to content
        </a>
        <SiteHeader />
        <main
          id="main-content"
          className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8"
        >
          {children}
        </main>
        <footer className="border-t border-slate-200 bg-white">
          <div className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-6 text-sm text-slate-500 sm:px-6 lg:px-8">
            <p>
              Fantasy FIFA World Cup 2026 · A private competition among friends.
            </p>
            <p>Official tournament data is added only when it is available.</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
