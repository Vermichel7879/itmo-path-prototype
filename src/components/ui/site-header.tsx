import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

export function SiteHeader({ right }: { right?: ReactNode }) {
  return (
    <header className="site-header">
      <div className="site-header__inner">
        <Link
          href="/"
          className="site-header__brand"
          aria-label="ИТМО, Центр карьеры — на главную"
        >
          <Image
            src="/brand/itmo-logo-black.jpg"
            alt="ИТМО"
            width={1032}
            height={410}
            priority
            className="site-header__logo"
          />
          <span aria-hidden="true" className="site-header__divider" />
          <span className="site-header__name">Центр карьеры</span>
        </Link>
        <span className="site-header__service">Карьерная траектория</span>
        {right ? <div className="site-header__action">{right}</div> : null}
      </div>
    </header>
  );
}
