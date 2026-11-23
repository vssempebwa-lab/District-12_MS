"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { Clock3 } from "lucide-react";
import { cn } from "@/lib/utils";

const BOOT_MS = 2800;
const FADE_MS = 450;
const STATUS_LINES = 12;

export function SystemLoader() {
  const [progress, setProgress] = useState(6);
  const [done, setDone] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [time, setTime] = useState("");

  useEffect(() => {
    const start = performance.now();
    let frame = 0;
    let unmountId = 0;
    const tick = (now: number) => {
      const next = Math.min(100, 6 + ((now - start) / BOOT_MS) * 94);
      setProgress(next);
      if (next < 100) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    const finishId = window.setTimeout(() => {
      setProgress(100);
      setDone(true);
      unmountId = window.setTimeout(() => setHidden(true), FADE_MS);
    }, BOOT_MS + 60);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(finishId);
      window.clearTimeout(unmountId);
    };
  }, []);

  useEffect(() => {
    const update = () => {
      const eat = new Date(Date.now() + 3 * 60 * 60 * 1000);
      const hours = String(eat.getUTCHours()).padStart(2, "0");
      const minutes = String(eat.getUTCMinutes()).padStart(2, "0");
      setTime(`${hours}:${minutes} EAT`);
    };
    update();
    const id = window.setInterval(update, 1000);
    return () => window.clearInterval(id);
  }, []);

  if (hidden) return null;

  const status =
    progress < 40
      ? "Establishing secure connection…"
      : "Verifying credentials and loading environment…";

  return (
    <div
      className={cn(
        "fixed inset-0 z-[100] flex flex-col bg-[#f1f2f4] transition-opacity duration-500",
        done ? "pointer-events-none opacity-0" : "opacity-100"
      )}
    >
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-32 -top-24 h-[420px] w-[420px] rotate-12 bg-white/70" />
        <div className="absolute left-1/3 -top-10 h-[130%] w-40 -rotate-12 bg-white/40" />
        <div className="absolute -right-24 top-24 h-[420px] w-[380px] rotate-6 bg-[#e4e6e9]" />
        <div className="absolute right-4 top-1/4 w-[540px] opacity-[0.05] mix-blend-multiply">
          <Image
            src="/district-12-logo.png"
            alt=""
            width={1264}
            height={380}
            className="h-auto w-full"
          />
        </div>
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-white/70 to-transparent" />
      </div>

      <header className="relative z-10 flex items-center justify-end gap-3 px-5 py-5 sm:gap-4 sm:px-10">
        <span className="hidden text-[10px] font-bold uppercase tracking-[0.28em] text-slate-500 sm:inline">
          Loading system
        </span>
        <div className="h-1 w-28 overflow-hidden rounded-full bg-slate-300 sm:w-64">
          <div
            className="h-full rounded-full bg-slate-500"
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="w-8 text-right text-[11px] font-semibold tabular-nums text-slate-600">
          {Math.round(progress)}%
        </span>
        <span className="flex items-center gap-1.5 border-l border-slate-300 pl-3 text-[11px] font-semibold tabular-nums text-slate-600 sm:pl-4">
          <Clock3 className="h-3.5 w-3.5" />
          {time || "--:-- EAT"}
        </span>
      </header>

      <main className="scrollbar-thin relative z-10 flex flex-1 flex-col items-center justify-center overflow-y-auto px-4 pb-4">
        <div className="hidden w-[230px] [@media(min-height:600px)]:block sm:w-[290px]">
          <Image
            src="/district-12-logo.png"
            alt="The District 12 Group of Companies"
            width={1264}
            height={380}
            priority
            className="h-auto w-full"
          />
        </div>

        <div className="relative z-10 mt-4 w-full max-w-[360px] rounded-xl border border-white bg-white px-6 pb-6 pt-5 shadow-[0_26px_70px_-30px_rgba(15,23,42,0.45)]">
          <h1 className="text-center text-[22px] font-semibold tracking-tight text-slate-800">
            D12 Enterprise Login
          </h1>

          <div className="relative mt-5">
            <div className="space-y-3.5">
              <div>
                <label className="text-[13px] font-medium text-slate-500">
                  Employee ID / Email
                </label>
                <input
                  disabled
                  placeholder="jdoe@district12.com"
                  className="mt-1 h-10 w-full rounded-md border border-slate-200 bg-[#ececee] px-3 text-sm placeholder:text-slate-400"
                />
              </div>
              <div>
                <label className="text-[13px] font-medium text-slate-500">
                  Password
                </label>
                <input
                  disabled
                  type="password"
                  placeholder="••••••••"
                  className="mt-1 h-10 w-full rounded-md border border-slate-200 bg-[#ececee] px-3 text-sm placeholder:text-slate-400"
                />
              </div>
            </div>
            <div
              aria-hidden
              className="absolute inset-0 flex items-center justify-center bg-white/45"
            >
              <div className="relative h-16 w-16 animate-spin [animation-duration:1.8s]">
                {Array.from({ length: STATUS_LINES }).map((_, index) => (
                  <span
                    key={index}
                    className="absolute left-1/2 top-1/2 h-1.5 w-1.5 rounded-full"
                    style={{
                      transform: `rotate(${index * 30}deg) translateY(-27px)`,
                      backgroundColor: index % 4 === 0 ? "#7fb0c8" : "#1e3a5f",
                      opacity: 0.2 + (index / STATUS_LINES) * 0.8,
                    }}
                  />
                ))}
              </div>
            </div>
          </div>

          <p
            role="status"
            aria-live="polite"
            className="mt-4 text-[13px] font-medium text-slate-700"
          >
            {status}
          </p>
          <div className="mt-2.5 h-2.5 overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-[#a9bfd2]"
              style={{ width: `${progress}%` }}
            />
          </div>

          <p className="mt-5 text-center text-[11px] text-slate-500">
            Need access? Contact{" "}
            <a
              href="mailto:hr@district12.co.ug"
              className="font-semibold text-blue-800 underline decoration-blue-800/40 underline-offset-2 hover:decoration-blue-800"
            >
              District 12 HR Admin
            </a>
            .
          </p>
        </div>
      </main>

      <footer className="relative z-10 pb-6 text-center text-[11px] text-slate-500">
        District 12 CRM v1.0 | © 2026 District 12. All Rights Reserved.
      </footer>
    </div>
  );
}
