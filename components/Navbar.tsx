"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Menu,
  X,
  Search,
  Bot,
  FileText,
  House,
  NotebookPen,
  LibraryBig,
  Shield,
} from "lucide-react";

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");

  const router = useRouter();
  const pathname = usePathname();

  const links = [
    {
      name: "Home",
      href: "/",
      icon: House,
    },
    {
      name: "Current Affairs",
      href: "/current-affairs",
      icon: FileText,
    },
    {
      name: "Quiz",
      href: "/quiz",
      icon: FileText,
    },
    {
      name: "PDF",
      href: "/pdf",
      icon: FileText,
    },
    {
      name: "Notes",
      href: "/notes",
      icon: NotebookPen,
    },
    {
      name: "PYQs",
      href: "/pyq",
      icon: LibraryBig,
    },
    {
      name: "AI",
      href: "/ai",
      icon: Bot,
    },
  ];

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const cleanQuery = query.trim();

    if (!cleanQuery) {
      return;
    }

    router.push(`/search?q=${encodeURIComponent(cleanQuery)}`);

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
    <header className="sticky top-0 z-50 border-b border-slate-800/70 bg-slate-950/90 backdrop-blur-lg">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6">
        {/* Logo */}

        <Link href="/" className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-500 text-xl font-bold text-black">
            CP
          </div>

          <div>
            <h1 className="text-xl font-bold text-white">
              CurrentPulse AI
            </h1>

            <p className="text-xs text-gray-400">
              UPSC Preparation Platform
            </p>
          </div>
        </Link>

        {/* Desktop Navigation */}

        <nav className="hidden items-center gap-5 xl:flex">
          {links.map((item) => {
            const active = isActiveLink(item.href);

            return (
              <Link
                key={item.name}
                href={item.href}
                className={`relative py-2 text-sm font-medium transition ${
                  active
                    ? "text-cyan-400"
                    : "text-gray-300 hover:text-cyan-400"
                }`}
              >
                {item.name}

                {active && (
                  <span className="absolute inset-x-0 -bottom-1 h-0.5 rounded-full bg-cyan-400" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Desktop Right Buttons */}

        <div className="hidden items-center gap-3 xl:flex">
          <button
            type="button"
            onClick={() => setSearchOpen((current) => !current)}
            aria-label={searchOpen ? "Close search" : "Open search"}
            aria-expanded={searchOpen}
            className="rounded-xl border border-slate-700 p-3 text-gray-300 transition hover:border-cyan-500 hover:text-cyan-400"
          >
            {searchOpen ? <X size={18} /> : <Search size={18} />}
          </button>

          <Link
            href="/admin/login"
            className="flex items-center gap-2 rounded-xl bg-cyan-500 px-5 py-3 font-semibold text-black transition hover:bg-cyan-400"
          >
            <Shield size={18} />
            Admin
          </Link>
        </div>

        {/* Mobile Menu Button */}

        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          aria-label={open ? "Close navigation menu" : "Open navigation menu"}
          aria-expanded={open}
          className="text-white xl:hidden"
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
        <div className="border-t border-slate-800 bg-slate-950 xl:hidden">
          <div className="space-y-2 p-6">
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

            {links.map((item) => {
              const Icon = item.icon;
              const active = isActiveLink(item.href);

              return (
                <Link
                  key={item.name}
                  href={item.href}
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

            <Link
              href="/admin/login"
              onClick={() => setOpen(false)}
              className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-cyan-500 px-5 py-3 font-semibold text-black transition hover:bg-cyan-400"
            >
              <Shield size={18} />
              Admin Login
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
