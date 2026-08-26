import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

export function SiteHeader({ right }: { right?: ReactNode }) {
  return (
    <header className="border-b border-black/8 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-18 w-full max-w-[1200px] items-center justify-between px-5 sm:px-8">
        <Link
          href="/"
          className="group inline-flex items-center gap-3 rounded-md focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-blue-600"
          aria-label="ИТМО, Центр карьеры — на главную"
        >
          <Image
            src="/brand/itmo-logo-black.jpg"
            alt="ИТМО"
            width={1032}
            height={410}
            priority
            className="h-7 w-auto max-w-[70px] object-contain sm:h-8 sm:max-w-[82px]"
          />
          <span aria-hidden="true" className="h-7 w-px bg-zinc-300" />
          <span className="text-xs font-medium text-zinc-700 sm:text-base">Центр карьеры</span>
        </Link>
        {right}
      </div>
    </header>
  );
}
