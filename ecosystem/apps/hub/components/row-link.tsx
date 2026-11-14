"use client";

import type { ReactNode } from "react";

export function RowLink({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <tr
      className={`${className ?? ""} cursor-pointer`}
      onClick={(event) => {
        const target = event.target as HTMLElement;
        if (target.closest("a,button,input,select,textarea")) return;
        window.location.assign(href);
      }}
    >
      {children}
    </tr>
  );
}
