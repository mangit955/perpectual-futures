"use client";

import { useEffect, useState } from "react";
import {
  AnimatePresence,
  motion,
  useMotionValueEvent,
  useScroll,
} from "framer-motion";
import { FaGithub } from "react-icons/fa";
import { Activity, ArrowRight, Menu, X } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const githubHref = "https://github.com/mangit955/perpectual-futures";
const docsHref = `${githubHref}/tree/main/docs`;

const navItems = [
  { label: "Features", href: "#features", id: "features" },
  { label: "Architecture", href: "#architecture", id: "architecture" },
  { label: "Performance", href: "#performance", id: "performance" },
  { label: "Docs", href: docsHref, id: "docs" },
];

export function Navbar() {
  const { scrollY } = useScroll();
  const [scrolled, setScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState("top");
  const [mobileOpen, setMobileOpen] = useState(false);

  useMotionValueEvent(scrollY, "change", (latest) => {
    setScrolled(latest > 16);
  });

  useEffect(() => {
    const hashItems = navItems.filter((item) => item.href.startsWith("#"));
    const sections = hashItems
      .map((item) => document.getElementById(item.id))
      .filter((section): section is HTMLElement => Boolean(section));

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

        if (visible) {
          setActiveSection(visible.target.id);
        }
      },
      {
        rootMargin: "-30% 0px -55% 0px",
        threshold: [0.1, 0.35, 0.65],
      },
    );

    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  return (
    <header
      className={cn(
        "fixed inset-x-0 z-50 px-[calc(64px+1.5rem)] transition-all duration-300 sm:px-[calc(64px+2rem)] lg:px-[calc(64px+3.25rem)] xl:px-[calc(72px+3.5rem)]",
        scrolled ? "top-3" : "top-0",
      )}
    >
      <nav
        aria-label="Primary"
        className={cn(
          "flex w-full items-center justify-between px-5 transition-all duration-300 sm:px-7 lg:px-8",
          scrolled
            ? "h-16 rounded-[1.35rem] border border-white/[0.11] bg-[#09090b]/86 shadow-[0_18px_60px_rgba(0,0,0,0.34),0_1px_0_rgba(255,255,255,0.05)_inset] backdrop-blur-2xl"
            : "h-20 border border-transparent bg-transparent",
        )}
      >
        <div className="flex min-w-0 items-center gap-8">
          <a
            className="group flex items-center gap-3"
            href="#top"
            onClick={() => setMobileOpen(false)}
            aria-label="Flux home"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-md border border-white/[0.10] bg-white/[0.03] transition-all duration-200 group-hover:border-white/[0.22] group-hover:bg-white/[0.07]">
              <Activity
                className="h-4 w-4 text-zinc-50"
                aria-hidden="true"
              />
            </span>
            <span className="text-sm font-semibold tracking-normal text-zinc-50">
              Flux
            </span>
          </a>

          <div className="hidden items-center gap-1 lg:flex">
            {navItems.map((item) => (
              <NavLink
                active={activeSection === item.id}
                href={item.href}
                key={item.label}
              >
                {item.label}
              </NavLink>
            ))}
          </div>
        </div>

        <div className="hidden items-center gap-2 lg:flex">
          <a
            className="group inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-zinc-400 transition-colors duration-200 hover:text-zinc-50"
            href={githubHref}
          >
            <FaGithub
              className="h-4 w-4 transition-transform duration-200 group-hover:-translate-y-0.5"
              aria-hidden="true"
            />
            Github
          </a>
          <a
            className={cn(
              buttonVariants({ variant: "ghost", size: "sm" }),
              "text-zinc-400",
            )}
            href="#developer"
          >
            Sign In
          </a>
          <a
            className={cn(
              buttonVariants({ variant: "primary", size: "sm" }),
              "px-4 text-gray-950!",
            )}
            href="#cta"
          >
            Launch App
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </a>
        </div>

        <button
          aria-expanded={mobileOpen}
          aria-label="Toggle navigation"
          className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-white/[0.10] bg-white/[0.03] text-zinc-50 transition-colors hover:bg-white/[0.07] lg:hidden"
          onClick={() => setMobileOpen((open) => !open)}
          type="button"
        >
          {mobileOpen ? (
            <X className="h-4 w-4" />
          ) : (
            <Menu className="h-4 w-4" />
          )}
        </button>
      </nav>

      <AnimatePresence>
        {mobileOpen ? (
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            className={cn(
              "mt-2 border border-white/[0.09] bg-[#09090b]/96 px-5 py-5 shadow-2xl backdrop-blur-xl lg:hidden",
              scrolled ? "rounded-[1.25rem]" : "rounded-b-[1.25rem]",
            )}
            exit={{ opacity: 0, y: -8 }}
            initial={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
          >
            <div className="flex w-full flex-col gap-1">
              {navItems.map((item) => (
                <a
                  className={cn(
                    "rounded-md px-3 py-3 text-sm font-medium text-zinc-400 transition-colors hover:bg-white/[0.05] hover:text-zinc-50",
                    activeSection === item.id &&
                      "bg-white/[0.05] text-zinc-50",
                  )}
                  href={item.href}
                  key={item.label}
                  onClick={() => setMobileOpen(false)}
                >
                  {item.label}
                </a>
              ))}
              <div className="my-3 h-px bg-white/[0.08]" />
              <a
                className="rounded-md px-3 py-3 text-sm font-medium text-zinc-400 transition-colors hover:bg-white/[0.05] hover:text-zinc-50"
                href={githubHref}
                onClick={() => setMobileOpen(false)}
              >
                Github
              </a>
              <a
                className="rounded-md px-3 py-3 text-sm font-medium text-zinc-400 transition-colors hover:bg-white/[0.05] hover:text-zinc-50"
                href="#developer"
                onClick={() => setMobileOpen(false)}
              >
                Sign In
              </a>
              <a
                className={cn(
                  buttonVariants({ variant: "primary", size: "md" }),
                  "mt-2 w-full text-gray-950!",
                )}
                href="#cta"
                onClick={() => setMobileOpen(false)}
              >
                Launch App
              </a>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </header>
  );
}

function NavLink({
  active,
  children,
  href,
}: {
  active: boolean;
  children: React.ReactNode;
  href: string;
}) {
  return (
    <a
      className={cn(
        "group relative rounded-md px-3 py-2 text-sm font-medium text-zinc-400 transition-colors duration-200 hover:text-zinc-50",
        active && "text-zinc-50",
      )}
      href={href}
    >
      {children}
      <span
        className={cn(
          "absolute inset-x-3 -bottom-0.5 h-px origin-center scale-x-0 bg-zinc-50/70 transition-transform duration-200",
          active ? "scale-x-100" : "group-hover:scale-x-100",
        )}
      />
    </a>
  );
}
