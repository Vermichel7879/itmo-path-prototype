import type { Metadata } from "next";
import type { ReactNode } from "react";
import { CareerJourneyProvider } from "@/components/journey/career-journey-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Карьерная траектория — Центр карьеры ИТМО",
  description: "Карьерная траектория для студентов ИТМО",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="ru" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <CareerJourneyProvider>{children}</CareerJourneyProvider>
      </body>
    </html>
  );
}
