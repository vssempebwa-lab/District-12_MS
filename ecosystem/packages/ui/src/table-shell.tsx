"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "./cn";

/** Copy each header's text onto the body cells below it as `data-label`. */
function labelCells(table: HTMLTableElement): void {
  const headerRow = table.tHead?.rows[table.tHead.rows.length - 1];
  if (!headerRow) return;
  const labels: string[] = [];
  for (const th of Array.from(headerRow.cells)) {
    const text = (th.textContent ?? "").replace(/\s+/g, " ").trim();
    for (let i = 0; i < Math.max(1, th.colSpan); i++) labels.push(text);
  }
  for (const body of [...Array.from(table.tBodies), ...(table.tFoot ? [table.tFoot] : [])]) {
    for (const row of Array.from(body.rows)) {
      let column = 0;
      for (const cell of Array.from(row.cells)) {
        const label = cell.colSpan > 1 ? "" : labels[column] ?? "";
        if (label) {
          if (cell.getAttribute("data-label") !== label) cell.setAttribute("data-label", label);
        } else if (cell.hasAttribute("data-label")) {
          cell.removeAttribute("data-label");
        }
        column += Math.max(1, cell.colSpan);
      }
    }
  }
}

/**
 * Bordered, horizontally scrollable table on tablets and desktop. On phones
 * (`stack`, the default) the rows become cards via the `.table-stack` styles
 * in the shared Tailwind preset.
 */
export function TableShell({
  children,
  className,
  stack = true,
}: {
  children: ReactNode;
  className?: string;
  stack?: boolean;
}) {
  const ref = useRef<HTMLTableElement>(null);

  useEffect(() => {
    const table = ref.current;
    if (!table || !stack) return;
    labelCells(table);
    const observer = new MutationObserver(() => labelCells(table));
    observer.observe(table, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [stack]);

  return (
    <div className={cn("overflow-x-auto rounded-xl border border-line bg-white", className)}>
      <table ref={ref} className={cn("w-full min-w-[560px] border-collapse text-left text-sm", stack && "table-stack")}>
        {children}
      </table>
    </div>
  );
}
