"use client";

import type { ReactNode } from "react";

export function RowLink({
  href,
  className,
  children,
}: {
  href?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <tr
      className={href ? `${className ?? ""} cursor-pointer` : className}
      onClick={href ? (event) => {
        const target = event.target as HTMLElement;
        if (target.closest("a,button,input,select,textarea")) return;
        window.location.assign(href);
      } : undefined}
    >
      {children}
    </tr>
  );
}
