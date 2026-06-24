"use client";

import { useEffect, useState } from "react";
import {
  AnimatePresence,
  motion,
  useMotionValueEvent,
  useScroll,
} from "framer-motion";
import { FaGithub } from "react-icons/fa";
import { ArrowUpRight, Menu, X } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import ClickSpark from "../ClickSpark";
import { useAuth } from "@/lib/auth-context";

const githubHref = "https://github.com/mangit955/perpectual-futures";
const docsHref = "/docs";

const navItems = [
  { label: "Features", href: "#features", id: "features" },
  { label: "Performance", href: "#performance", id: "performance" },
  { label: "Developer", href: "#developer", id: "developer" },
  { label: "Roadmap", href: "#roadmap", id: "roadmap" },
];

export function Navbar() {
  const { scrollY } = useScroll();
  const [scrolled, setScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState("top");
  const [mobileOpen, setMobileOpen] = useState(false);
  const { isLoggedIn, logout } = useAuth();

  const handleLogout = () => {
    logout();
  };

  useMotionValueEvent(scrollY, "change", (latest) => {
    setScrolled(latest > 16);
  });

  useEffect(() => {
    const updateScrolled = () => setScrolled(window.scrollY > 16);

    updateScrolled();
    window.addEventListener("scroll", updateScrolled, { passive: true });

    return () => window.removeEventListener("scroll", updateScrolled);
  }, []);

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
            ? "h-16 rounded-[1.35rem] border border-white/[0.11] bg-[#09090b]/86 shadow-[0_18px_60px_rgba(0,0,0,0.34),0_1px_0_rgba(255,255,255,0.05)_inset] backdrop-blur-xl"
            : "h-20 border border-transparent bg-transparent",
        )}
      >
        <div className="flex min-w-0 items-center gap-8">
          <a
            className="group flex items-center gap-2.5"
            href="#top"
            onClick={() => setMobileOpen(false)}
            aria-label="Flux home"
          >
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

            <span
              style={{
                fontFamily: "'Inter', sans-serif",
                fontWeight: 600,
                fontSize: "1.5rem",
                letterSpacing: "-0.025em",
                color: "#ffffff",
              }}
            >
              flux
            </span>
          </a>

          <div className="hidden items-center gap-1 lg:flex ">
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

        <div className="hidden items-center gap-3 lg:flex">
          <a
            aria-label="Open GitHub repository"
            className="group inline-flex h-9 w-9 items-center justify-center rounded-md border border-white/[0.10] bg-white/[0.03] text-zinc-400 transition-colors duration-200 hover:border-white/[0.18] hover:bg-white/[0.07] hover:text-zinc-50"
            href={githubHref}
          >
            <FaGithub
              className="h-4 w-4 transition-transform duration-200 group-hover:-translate-y-0.5"
              aria-hidden="true"
            />
          </a>
          <motion.a
            href={docsHref}
            whileHover="hover"
            className={cn(
              buttonVariants({ variant: "secondary", size: "sm" }),
              "group border border-white/[0.10] bg-white/[0.03] text-zinc-400",
              "hover:border-white/[0.18] hover:bg-white/[0.07] hover:text-zinc-50",
            )}
          >
            View Docs
            <motion.span
              variants={{
                hover: {
                  rotate: 45,
                  x: 4,
                },
              }}
              transition={{
                duration: 0.25,
                ease: [0.22, 1, 0.36, 1],
              }}
            >
              <ArrowUpRight className="h-4 w-4" />
            </motion.span>
          </motion.a>
          <div className="hidden items-center gap-3 lg:flex">
            {isLoggedIn ? (
              <>
                <a
                  href="/trade"
                  className={cn(
                    buttonVariants({ size: "sm" }),
                    "border cursor-pointer bg-white text-black! font-medium",
                  )}
                >
                  Trade
                </a>
                <button
                  onClick={handleLogout}
                  className={cn(
                    buttonVariants({ size: "sm", variant: "ghost" }),
                    "text-zinc-400 hover:text-zinc-50",
                  )}
                >
                  Logout
                </button>
              </>
            ) : (
              <ClickSpark
                sparkColor="#3B82F6"
                sparkSize={10}
                sparkRadius={15}
                sparkCount={8}
                duration={400}
              >
                <a
                  href="/login"
                  className={cn(
                    buttonVariants({ size: "sm" }),
                    "border cursor-pointer bg-white text-black! font-medium",
                  )}
                >
                  Sign Up !
                </a>
              </ClickSpark>
            )}
          </div>
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
                    activeSection === item.id && "bg-white/[0.05] text-zinc-50",
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
              {isLoggedIn ? (
                <>
                  <a
                    className={cn(
                      buttonVariants({ variant: "default", size: "default" }),
                      "mt-2 w-full bg-white text-black!",
                    )}
                    href="/trade"
                    onClick={() => setMobileOpen(false)}
                  >
                    Trade
                  </a>
                  <button
                    className={cn(
                      buttonVariants({ variant: "secondary", size: "default" }),
                      "mt-2 w-full",
                    )}
                    onClick={() => {
                      handleLogout();
                      setMobileOpen(false);
                    }}
                  >
                    Logout
                  </button>
                </>
              ) : (
                <a
                  className={cn(
                    buttonVariants({ variant: "default", size: "default" }),
                    "mt-2 w-full bg-white text-black!",
                  )}
                  href="/login"
                  onClick={() => setMobileOpen(false)}
                >
                  Sign Up !
                </a>
              )}
              <a
                className={cn(
                  buttonVariants({ variant: "secondary", size: "default" }),
                  "mt-2 w-full",
                )}
                href="/docs"
                onClick={() => setMobileOpen(false)}
              >
                View Docs
                <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
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
      href={href}
      className={cn(
        "relative rounded-md px-3 py-2 text-sm font-medium transition-colors duration-200  hover:text-zinc-100!",
        active ? "text-zinc-50" : "text-zinc-400! hover:text-zinc-50",
      )}
    >
      {active && (
        <motion.span
          layoutId="navbar-active-pill"
          className="absolute inset-0 rounded-md border border-white/[0.06] bg-white/[0.04]"
          transition={{
            type: "spring",
            stiffness: 450,
            damping: 35,
          }}
        />
      )}

      <span className="relative z-10">{children}</span>
    </a>
  );
}
