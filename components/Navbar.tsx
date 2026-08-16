"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Menu,
  X,
  Search,
  Bot,
  House,
  NotebookPen,
  LibraryBig,
  CircleHelp,
  Files,
  Newspaper,
  BookOpenCheck,
  GraduationCap,
} from "lucide-react";

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [language, setLanguage] = useState<"en" | "hi">("en");

  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        setLanguage(
          new URLSearchParams(window.location.search).get("lang") === "hi"
            ? "hi"
            : "en"
        );
      } catch {}
    }, 0);

    return () => window.clearTimeout(timer);
  }, [pathname]);

  const hi = language === "hi";
  const links = [
    {
      name: hi ? "मुखपृष्ठ" : "Home",
      href: "/",
      icon: House,
    },
    {
      name: hi ? "करेंट अफेयर्स" : "Current Affairs",
      href: "/current-affairs",
      icon: BookOpenCheck,
    },
    {
      name: hi ? "समाचार" : "News",
      href: "/news",
      icon: Newspaper,
    },
    {
      name: hi ? "परीक्षाएँ" : "Exams",
      href: "/exams",
      icon: GraduationCap,
    },
    {
      name: hi ? "मॉक टेस्ट" : "Mock Tests",
      href: "/mock-tests",
      icon: CircleHelp,
    },
    {
      name: hi ? "PDF" : "PDF",
      href: "/pdf",
      icon: Files,
    },
    {
      name: hi ? "नोट्स" : "Notes",
      href: "/notes",
      icon: NotebookPen,
    },
    {
      name: hi ? "PYQ" : "PYQs",
      href: "/pyq",
      icon: LibraryBig,
    },
    {
      name: hi ? "प्रश्नपत्र" : "Papers",
      href: "/question-papers",
      icon: LibraryBig,
    },
    {
      name: "AI",
      href: "/ai",
      icon: Bot,
    },
  ];

  function withLanguage(href: string) {
    if (!hi) return href;
    const joiner = href.includes("?") ? "&" : "?";
    return `${href}${joiner}lang=hi`;
  }

  function toggleLanguage() {
    const url = new URL(window.location.href);
    if (hi) url.searchParams.delete("lang");
    else url.searchParams.set("lang", "hi");
    window.location.assign(`${url.pathname}${url.search}${url.hash}`);
  }

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const cleanQuery = query.trim();

    if (!cleanQuery) {
      return;
    }

    router.push(`/search?q=${encodeURIComponent(cleanQuery)}${hi ? "&lang=hi" : ""}`);

    setQuery("");
    setSearchOpen(false);
    setOpen(false);
  }

  function isActiveLink(href: string) {
    if (href === "/") {
      return pathname === "/";
    }

    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <header className="sticky top-0 z-50 border-b border-white/8 bg-slate-950/86 shadow-[0_12px_35px_rgba(2,6,23,.28)] backdrop-blur-xl">
      <div className="mx-auto flex h-[4.75rem] max-w-7xl items-center justify-between px-4 sm:px-6">
        {/* Logo */}

        <Link href={withLanguage("/")} className="group flex items-center gap-3" aria-label="CurrentPulse AI home">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-300 via-cyan-500 to-blue-600 text-lg font-black text-slate-950 shadow-lg shadow-cyan-500/20 ring-1 ring-white/20 transition group-hover:scale-105">
            CP
          </div>

          <div>
            <p className="text-lg font-black tracking-tight text-white sm:text-xl">
              CurrentPulse AI
            </p>

            <p className="text-xs text-gray-400">
              Daily · Static · PYQ-linked
            </p>
          </div>
        </Link>

        {/* Desktop Navigation */}

        <nav className="hidden items-center gap-1 xl:flex" aria-label="Primary navigation">
          {links.map((item) => {
            const active = isActiveLink(item.href);

            return (
              <Link
                key={item.name}
                href={withLanguage(item.href)}
                className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                  active
                    ? "bg-cyan-400/12 text-cyan-300"
                    : "text-slate-300 hover:bg-white/5 hover:text-white"
                }`}
              >
                {item.name}

              </Link>
            );
          })}
        </nav>

        {/* Desktop Right Buttons */}

        <div className="hidden items-center gap-3 xl:flex">
          <button type="button" onClick={toggleLanguage} className="rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-3 py-2 text-sm font-black text-cyan-200">{hi ? "EN" : "हिन्दी"}</button>
          <button
            type="button"
            onClick={() => setSearchOpen((current) => !current)}
            aria-label={searchOpen ? "Close search" : "Open search"}
            aria-expanded={searchOpen}
            className="rounded-xl border border-slate-700/80 bg-slate-900/60 p-3 text-slate-300 transition hover:border-cyan-400/70 hover:bg-cyan-400/10 hover:text-cyan-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
          >
            {searchOpen ? <X size={18} /> : <Search size={18} />}
          </button>

        </div>

        {/* Mobile Menu Button */}

        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          aria-label={open ? "Close navigation menu" : "Open navigation menu"}
          aria-expanded={open}
          className="rounded-xl border border-slate-700 bg-slate-900 p-2.5 text-white xl:hidden"
        >
          {open ? <X size={28} /> : <Menu size={28} />}
        </button>
      </div>

      {/* Desktop Search Bar */}

      {searchOpen && (
        <div className="hidden border-t border-slate-800 bg-slate-950 xl:block">
          <form
            onSubmit={handleSearch}
            className="mx-auto flex max-w-3xl gap-3 px-6 py-5"
          >
            <div className="relative flex-1">
              <Search
                size={20}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500"
              />

              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search current affairs, category or GS paper..."
                autoFocus
                className="w-full rounded-xl border border-slate-700 bg-slate-900 py-3 pl-12 pr-4 text-white outline-none placeholder:text-gray-500 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20"
              />
            </div>

            <button
              type="submit"
              disabled={!query.trim()}
              className="rounded-xl bg-cyan-500 px-6 py-3 font-semibold text-black transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Search
            </button>
          </form>
        </div>
      )}

      {/* Mobile Navigation */}

      {open && (
        <div className="max-h-[calc(100vh-4.75rem)] overflow-y-auto border-t border-slate-800 bg-slate-950/98 xl:hidden">
          <div className="space-y-2 p-4 sm:p-6">
            {/* Mobile Search */}

            <form onSubmit={handleSearch} className="mb-5 flex gap-2">
              <div className="relative flex-1">
                <Search
                  size={18}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500"
                />

                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search articles..."
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 py-3 pl-11 pr-4 text-white outline-none placeholder:text-gray-500 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20"
                />
              </div>

              <button
                type="submit"
                disabled={!query.trim()}
                aria-label="Search"
                className="rounded-xl bg-cyan-500 px-4 text-black transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Search size={19} />
              </button>
            </form>

            <button type="button" onClick={toggleLanguage} className="mb-3 w-full rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-4 py-3 text-left font-black text-cyan-200">{hi ? "Switch to English" : "हिन्दी में देखें"}</button>

            {links.map((item) => {
              const Icon = item.icon;
              const active = isActiveLink(item.href);

              return (
                <Link
                  key={item.name}
                  href={withLanguage(item.href)}
                  onClick={() => setOpen(false)}
                  className={`flex items-center gap-3 rounded-xl px-4 py-3 transition ${
                    active
                      ? "bg-slate-900 text-cyan-400"
                      : "text-gray-300 hover:bg-slate-900 hover:text-cyan-400"
                  }`}
                >
                  <Icon
                    size={18}
                    className={
                      active ? "text-cyan-400" : "text-gray-400"
                    }
                  />

                  {item.name}
                </Link>
              );
            })}

          </div>
        </div>
      )}
    </header>
  );
}
