"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Search,
  Grid3X3,
  Gift,
  Clock,
  Bell,
  ChevronDown,
  LogOut,
} from "lucide-react";
import { DepositButton, WithdrawButton } from "./deposit-withdraw";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth-context";
import { Button, buttonVariants } from "../ui/button";
import { Input } from "../ui/input";
import { cn } from "@/lib/utils";

// ─── Nav Link Data ───────────────────────────────────────────────────────────

interface NavLink {
  label: string;
  href: string;
  active: boolean;
  hasDropdown?: boolean;
  disabled?: boolean;
}

const navLinks: NavLink[] = [
  { label: "Spot", href: "/spot", active: false, disabled: true },

  { label: "Futures", href: "/futures", active: true },

  { label: "Lend", href: "/lend", active: false, disabled: true },

  { label: "Vault", href: "/vault", active: false, disabled: true },

  {
    label: "More",
    href: "#",
    active: false,
    hasDropdown: true,
    disabled: true,
  },
];

// ─── FluxLogo ────────────────────────────────────────────────────────────────

function FluxLogo() {
  return (
    <div className="flex items-center gap-2 pr-4">
      <svg
        width="22"
        height="22"
        viewBox="0 0 26 26"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <rect
          x="3"
          y="6"
          width="4"
          height="15"
          rx="2"
          fill="white"
          transform="rotate(-18 3 6)"
        />
        <rect
          x="10.5"
          y="3"
          width="4"
          height="18"
          rx="2"
          fill="white"
          transform="rotate(-18 10.5 3)"
        />
        <rect
          x="18"
          y="1"
          width="4"
          height="21"
          rx="2"
          fill="white"
          opacity="0.35"
          transform="rotate(-18 18 1)"
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
          (e.target as HTMLElement).tagName,
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
        focused ? "border-zinc-500" : "border-[#27272a] hover:border-zinc-600"
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
      disabled={link.disabled}
      className={`flex items-center gap-0.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors ${
        link.active
          ? "text-white"
          : link.disabled
            ? "cursor-not-allowed text-zinc-400"
            : "cursor-pointer text-zinc-400 hover:text-zinc-200"
      }`}
    >
      {link.label}

      {link.hasDropdown && <ChevronDown className="h-3 w-3 text-zinc-500" />}
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
  const { isLoggedIn, userId, logout } = useAuth();
  const initials = userId ? userId.slice(0, 2).toUpperCase() : "?";

  if (!isLoggedIn) {
    return (
      <Dialog>
        <DialogTrigger
          className={cn(
            buttonVariants({ variant: "default" }),

            "cursor-pointer",
          )}
        >
          Log in
        </DialogTrigger>

        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Welcome to Flux</DialogTitle>

            <DialogDescription>
              Sign in to access your trading account.
            </DialogDescription>
          </DialogHeader>

          {/* Your login form goes here */}

          <div className="space-y-4 py-2">
            <Input placeholder="Email" />

            <Input type="password" placeholder="Password" />

            <Button className="w-full">Sign In</Button>

            <p className="text-center text-sm text-zinc-400">
              Don&apos;t have an account?{" "}
              <Link
                href="/signup"
                type="button"
                className="hover:text-white! hover:underline! underline! cursor-pointer"
              >
                Sign up
              </Link>
            </p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <button
        aria-label="User menu"
        className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 text-xs font-semibold text-white transition-opacity hover:opacity-90"
        title={`Logged in as ${userId}`}
      >
        {initials}
      </button>
      <button
        aria-label="Log out"
        onClick={logout}
        title="Log out"
        className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.06] transition-colors"
      >
        <LogOut className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// ─── NavigationBar ───────────────────────────────────────────────────────────

export function NavigationBar() {
  return (
    <header className="flex h-12 w-full items-center border-b border-[#1e1e22] bg-[#0d0d0f] px-4">
      {/* Left: Logo + Nav Links */}
      <div className="flex items-center">
        <Link href="/" className="cursor-pointer">
          <FluxLogo />
        </Link>
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
        <DepositButton />
        <WithdrawButton />

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
