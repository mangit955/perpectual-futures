"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Search,
  Grid3X3,
  Gift,
  Clock,
  Bell,
  ChevronDown,
} from "lucide-react";

// ─── Nav Link Data ───────────────────────────────────────────────────────────

interface NavLink {
  label: string;
  href: string;
  active: boolean;
  hasDropdown?: boolean;
}

const navLinks: NavLink[] = [
  { label: "Spot", href: "/spot", active: false },
  { label: "Futures", href: "/futures", active: true },
  { label: "Lend", href: "/lend", active: false },
  { label: "Vault", href: "/vault", active: false },
  { label: "More", href: "#", active: false, hasDropdown: true },
];

// ─── FluxLogo ────────────────────────────────────────────────────────────────

function FluxLogo() {
  return (
    <div className="flex items-center gap-2 pr-4">
      <svg
        width="20"
        height="16"
        viewBox="0 0 20 16"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="text-white"
      >
        <path
          d="M1 2C3.5 0.5 7 0 10 2C13 4 16.5 3.5 19 2"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
        <path
          d="M1 8C3.5 6.5 7 6 10 8C13 10 16.5 9.5 19 8"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
        <path
          d="M1 14C3.5 12.5 7 12 10 14C13 16 16.5 15.5 19 14"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
      <span className="text-lg font-semibold text-white tracking-tight">
        flux
      </span>
    </div>
  );
}

// ─── SearchBar ───────────────────────────────────────────────────────────────

function SearchBar() {
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Global "/" shortcut
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (
        e.key === "/" &&
        !["INPUT", "TEXTAREA", "SELECT"].includes(
          (e.target as HTMLElement).tagName
        )
      ) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div
      className={`relative flex h-8 w-[180px] items-center gap-1.5 rounded-md border bg-[#18181b] px-2.5 transition-colors ${
        focused
          ? "border-zinc-500"
          : "border-[#27272a] hover:border-zinc-600"
      }`}
    >
      <Search className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
      <input
        ref={inputRef}
        type="text"
        placeholder="Search markets"
        className="h-full w-full bg-transparent text-xs text-zinc-300 placeholder:text-zinc-600 outline-none"
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />
      {!focused && (
        <kbd className="flex h-5 w-5 shrink-0 items-center justify-center rounded border border-[#27272a] bg-[#111113] text-[10px] font-mono text-zinc-500">
          /
        </kbd>
      )}
    </div>
  );
}

// ─── NavItem ─────────────────────────────────────────────────────────────────

function NavItem({ link }: { link: NavLink }) {
  return (
    <button
      className={`flex items-center gap-0.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors ${
        link.active
          ? "text-white"
          : "text-zinc-400 hover:text-zinc-200"
      }`}
    >
      {link.label}
      {link.hasDropdown && (
        <ChevronDown className="h-3 w-3 text-zinc-500" />
      )}
    </button>
  );
}

// ─── IconButton ──────────────────────────────────────────────────────────────

function IconButton({
  children,
  ariaLabel,
}: {
  children: React.ReactNode;
  ariaLabel: string;
}) {
  return (
    <button
      aria-label={ariaLabel}
      className="flex h-8 w-8 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-white/[0.06] hover:text-white"
    >
      {children}
    </button>
  );
}

// ─── UserAvatar ──────────────────────────────────────────────────────────────

function UserAvatar() {
  return (
    <button
      aria-label="User menu"
      className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 text-xs font-semibold text-white transition-opacity hover:opacity-90"
    >
      M
    </button>
  );
}

// ─── NavigationBar ───────────────────────────────────────────────────────────

export function NavigationBar() {
  return (
    <header className="flex h-12 w-full items-center border-b border-[#1e1e22] bg-[#0d0d0f] px-4">
      {/* Left: Logo + Nav Links */}
      <div className="flex items-center">
        <FluxLogo />
        <nav className="flex items-center gap-1">
          {navLinks.map((link) => (
            <NavItem key={link.label} link={link} />
          ))}
        </nav>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Right: Search + Actions */}
      <div className="flex items-center gap-2">
        <SearchBar />

        {/* Deposit / Withdraw */}
        <button className="h-8 rounded-full border border-green-500 px-4 text-xs font-medium text-green-500 transition-colors hover:bg-green-500/10">
          Deposit
        </button>
        <button className="h-8 rounded-full bg-zinc-800 px-4 text-xs font-medium text-white transition-colors hover:bg-zinc-700">
          Withdraw
        </button>

        {/* Separator */}
        <div className="mx-1 h-5 w-px bg-[#27272a]" />

        {/* Icon Buttons */}
        <IconButton ariaLabel="Apps">
          <Grid3X3 className="h-4 w-4" />
        </IconButton>
        <IconButton ariaLabel="Rewards">
          <Gift className="h-4 w-4" />
        </IconButton>
        <IconButton ariaLabel="History">
          <Clock className="h-4 w-4" />
        </IconButton>
        <IconButton ariaLabel="Notifications">
          <Bell className="h-4 w-4" />
        </IconButton>

        {/* Separator */}
        <div className="mx-1 h-5 w-px bg-[#27272a]" />

        {/* User Avatar */}
        <UserAvatar />
      </div>
    </header>
  );
}
