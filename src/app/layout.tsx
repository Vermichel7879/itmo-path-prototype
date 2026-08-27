import type { Metadata } from "next";
import localFont from "next/font/local";
import type { ReactNode } from "react";
import { CareerJourneyProvider } from "@/components/journey/career-journey-provider";
import "./globals.css";

const golos = localFont({
  src: "../../public/fonts/golos-text-variable.ttf",
  display: "swap",
  variable: "--font-golos",
});

export const metadata: Metadata = {
  title: "Карьерная траектория — Центр карьеры ИТМО",
  description: "Карьерная траектория для студентов ИТМО",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="ru" className={`${golos.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        {/*
          DIRECTION CONTRACT — «Маршрутный лист ИТМО»
          Public surfaces use a white / near-black / ITMO-blue editorial route system:
          asymmetrical grid, large functional numbers, rules and route markers, Golos,
          minimal radii, no decorative shadows or SaaS card stacks. Admin is out of scope.
        */}
        <CareerJourneyProvider>{children}</CareerJourneyProvider>
      </body>
    </html>
  );
}
