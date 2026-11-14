"use client";

import { Download } from "lucide-react";
import { Button } from "@d12/ui";

export function ReportDownload({ rows, filename }: { rows: string[][]; filename: string }) {
  function download(): void {
    const csv = rows
      .map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Button type="button" variant="secondary" size="sm" onClick={download}>
      <Download className="h-4 w-4" />
      Export CSV
    </Button>
  );
}
