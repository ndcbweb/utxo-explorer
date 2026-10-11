"use client";

import Link from "next/link";
import { useState } from "react";
import { short } from "@/lib/format";

export function Card({ title, action, children, className = "", bodyClass = "" }) {
  return (
    <section className={`card overflow-hidden ${className}`}>
      {title ? (
        <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-3">
          <h2 className="text-[15px] font-semibold">{title}</h2>
          {action}
        </div>
      ) : null}
      <div className={bodyClass}>{children}</div>
    </section>
  );
}

export function Stat({ label, value, sub, accent = false }) {
  return (
    <div className="card p-4">
      <div className="label">{label}</div>
      <div className={`mt-2 truncate text-xl font-semibold tabular-nums ${accent ? "text-[#c99400] dark:text-brand" : ""}`}>{value}</div>
      {sub ? <div className="mt-1 truncate text-xs text-muted">{sub}</div> : null}
    </div>
  );
}

export function Copy({ text }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      title="Copy"
      className="inline-grid h-6 w-6 shrink-0 place-items-center rounded-md text-muted hover:bg-black/5 hover:text-ink dark:hover:bg-white/10 dark:hover:text-white"
      onClick={() => {
        navigator.clipboard?.writeText(text).then(() => {
          setDone(true);
          setTimeout(() => setDone(false), 1200);
        });
      }}
    >
      {done ? (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="m5 12 5 5 9-10" />
        </svg>
      ) : (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="9" y="9" width="12" height="12" rx="2" />
          <path d="M5 15V5a2 2 0 0 1 2-2h10" />
        </svg>
      )}
    </button>
  );
}

export function HashLink({ type, id, label, head = 8, tail = 8, full = false }) {
  if (!id) return <span className="text-muted">–</span>;
  return (
    <Link href={`/${type}/?id=${encodeURIComponent(id)}`} className="link mono">
      {label ?? (full ? id : short(id, head, tail))}
    </Link>
  );
}

export function Row({ label, children }) {
  return (
    <div className="grid gap-1 border-t border-black/5 px-5 py-3.5 first:border-t-0 sm:grid-cols-[220px_1fr] sm:gap-4 dark:border-white/5">
      <div className="text-sm text-muted">{label}</div>
      <div className="min-w-0 break-all text-sm">{children}</div>
    </div>
  );
}

export function Loading({ label = "Loading…" }) {
  return (
    <div className="card grid place-items-center px-5 py-16 text-sm text-muted">
      <div className="flex items-center gap-3">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand border-t-transparent" />
        {label}
      </div>
    </div>
  );
}

export function ErrorBox({ message }) {
  return <div className="card px-5 py-12 text-center text-sm text-down">{message}</div>;
}

export function Empty({ children }) {
  return <div className="px-5 py-10 text-center text-sm text-muted">{children}</div>;
}

export function PageTitle({ title, sub, children }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {sub ? <div className="mt-1 flex min-w-0 items-center gap-1 text-sm text-muted">{sub}</div> : null}
      </div>
      {children}
    </div>
  );
}

export function Pager({ onPrev, onNext, prevDisabled, nextDisabled, label }) {
  return (
    <div className="flex items-center justify-end gap-2 border-t border-black/5 px-5 py-3 dark:border-white/5">
      {label ? <span className="mr-auto text-xs text-muted">{label}</span> : null}
      <button type="button" className="btn-ghost" onClick={onPrev} disabled={prevDisabled}>
        Newer
      </button>
      <button type="button" className="btn-ghost" onClick={onNext} disabled={nextDisabled}>
        Older
      </button>
    </div>
  );
}

/** Minimal SVG area chart for a numeric series. */
export function Spark({ values, height = 72, stroke = "var(--color-brand)", fill = true }) {
  const points = values.filter((v) => Number.isFinite(v));
  if (points.length < 2) return <div style={{ height }} className="grid place-items-center text-xs text-muted">Not enough blocks yet</div>;
  const max = Math.max(...points);
  const min = Math.min(...points);
  const range = max - min || 1;
  const width = 300;
  const coords = points.map((v, i) => [(i / (points.length - 1)) * width, height - 4 - ((v - min) / range) * (height - 8)]);
  const line = coords.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="w-full" style={{ height }}>
      {fill ? <path d={`${line} L${width},${height} L0,${height} Z`} fill={stroke} opacity="0.12" /> : null}
      <path d={line} fill="none" stroke={stroke} strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
