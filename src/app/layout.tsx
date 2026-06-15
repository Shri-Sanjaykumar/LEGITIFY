import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LEGITIFY — Verify Before You Trust",
  description:
    "AI-powered trust intelligence platform that verifies internships, jobs, recruiters, companies, and offer letters.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="font-sans antialiased min-h-screen bg-[#06060b] text-[#f1f5f9]">
        {children}
      </body>
    </html>
  );
}
