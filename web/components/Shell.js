"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useState } from "react";
import { api, useApi } from "@/lib/api";

const InfoContext = createContext({ info: null, error: "" });

export function useChain() {
  return useContext(InfoContext);
}

const NAV = [
  { href: "/", label: "Home" },
  { href: "/blocks/", label: "Blocks" },
  { href: "/txs/", label: "Transactions" },
  { href: "/mempool/", label: "Mempool" },
  { href: "/richlist/", label: "Rich list" },
  { href: "/rules/", label: "Coin rules" },
  { href: "/network/", label: "Network" },
];

function ThemeToggle() {
  const [dark, setDark] = useState(true);
  useEffect(() => setDark(document.documentElement.classList.contains("dark")), []);
  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("explorer-theme", next ? "dark" : "light");
    } catch {
      /* private mode */
    }
  };
  return (
    <button type="button" onClick={toggle} className="btn-ghost h-9 w-9 !p-0" aria-label="Toggle theme">
      {dark ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
        </svg>
      )}
    </button>
  );
}

export function SearchBar({ large = false }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    const value = query.trim();
    if (!value) return;
    setBusy(true);
    setError("");
    try {
      const hit = await api(`/search?q=${encodeURIComponent(value)}`);
      setQuery("");
      router.push(`/${hit.type}/?id=${encodeURIComponent(hit.id)}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="relative w-full">
      <div
        className={`flex items-center gap-2 rounded-xl border border-black/10 bg-white px-3 focus-within:border-brand dark:border-white/10 dark:bg-field ${
          large ? "h-12" : "h-10"
        }`}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 text-muted">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <input
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setError("");
          }}
          placeholder="Search by address, transaction id, block hash or height"
          className="h-full w-full bg-transparent text-sm outline-none placeholder:text-muted"
          spellCheck={false}
        />
        {busy ? <span className="text-xs text-muted">Searching…</span> : null}
      </div>
      {error ? <p className="absolute left-1 top-full mt-1 text-xs text-down">{error}</p> : null}
    </form>
  );
}

export default function Shell({ children }) {
  const pathname = usePathname();
  const { data: info, error } = useApi("/info", { refreshMs: 10_000 });
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (info?.chainName) document.title = `${info.chainName} Explorer`;
  }, [info?.chainName]);

  const active = (href) => (href === "/" ? pathname === "/" : pathname.startsWith(href.replace(/\/$/, "")));
  const symbol = info?.symbol || "";

  return (
    <InfoContext.Provider value={{ info, error }}>
      <header className="sticky top-0 z-30 border-b border-black/5 bg-white/85 backdrop-blur dark:border-white/5 dark:bg-night/85">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4">
          <Link href="/" className="flex shrink-0 items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand text-sm font-bold text-[#181a20]">
              {(symbol || info?.chainName || "N").slice(0, 1)}
            </span>
            <span className="hidden text-[15px] font-semibold sm:block">{info?.chainName || "Explorer"}</span>
          </Link>
          <nav className="hidden flex-1 items-center gap-1 lg:flex">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  active(item.href) ? "text-ink dark:text-white" : "text-muted hover:text-ink dark:hover:text-white"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            {pathname !== "/" ? (
              <div className="hidden w-80 md:block">
                <SearchBar />
              </div>
            ) : null}
            <ThemeToggle />
            <button type="button" className="btn-ghost h-9 w-9 !p-0 lg:hidden" onClick={() => setOpen((v) => !v)} aria-label="Menu">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            </button>
          </div>
        </div>
        {open ? (
          <nav className="border-t border-black/5 px-4 py-2 lg:hidden dark:border-white/5">
            {NAV.map((item) => (
              <Link key={item.href} href={item.href} className="block rounded-lg px-3 py-2 text-sm font-medium">
                {item.label}
              </Link>
            ))}
            {pathname !== "/" ? (
              <div className="py-2">
                <SearchBar />
              </div>
            ) : null}
          </nav>
        ) : null}
      </header>
      {info && info.index.indexed < info.index.chainHead - 2 ? (
        <div className="bg-brand/15 px-4 py-2 text-center text-xs font-medium">
          Indexing blocks: {info.index.indexed.toLocaleString()} of {info.index.chainHead.toLocaleString()}. Balances and history fill in as it catches up.
        </div>
      ) : null}
      <main className="mx-auto max-w-7xl px-4 py-6 sm:py-8">{children}</main>
      <footer className="border-t border-black/5 py-6 text-center text-xs text-muted dark:border-white/5">
        {info?.chainName || "Chain"} explorer · Powered by Nadcab
      </footer>
    </InfoContext.Provider>
  );
}
