"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useInView } from "framer-motion";
import Image from "next/image";
import { FaGithub } from "react-icons/fa";
import {
  ArrowRight,
  BookOpen,
  Boxes,
  Check,
  ChevronRight,
  Clock3,
  Code2,
  Copy,
  Database,
  FileCode2,
  Gauge,
  LineChart,
  LockKeyhole,
  RadioTower,
  ShieldCheck,
  Terminal,
  Workflow,
  Zap,
} from "lucide-react";
import { Navbar } from "@/components/landing/navbar";
import { LayoutFrame, SectionDivider } from "@/components/layout/layout-frame";
import { SectionWrapper } from "@/components/landing/section-wrapper";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { CanvasText } from "../ui/canvas-text";
import { PulsatingButton } from "../ui/pulsating-button";
import WorldMap from "../ui/world-map";

const githubHref = "https://github.com/mangit955/perpectual-futures";
const docsHref = `${githubHref}/tree/main/docs`;

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0 },
};

const stagger = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.08,
    },
  },
};

const stats = [
  { label: "Orders/sec target", value: "100k+" },
  { label: "Matching path", value: "Sub-ms" },
  { label: "Engine model", value: "Event sourced" },
];

const features = [
  {
    title: "Event sourcing",
    description:
      "Commands and fills are persisted as ordered events execution.",
    icon: Workflow,
  },
  {
    title: "Snapshot recovery",
    description:
      "Orderbooks restore from compact snapshots & replay only the stream events.",
    icon: Database,
  },
  {
    title: "Low-latency matching",
    description:
      "The hot path keeps books in memory and avoids relational writes.",
    icon: Zap,
  },
  {
    title: "Live market data",
    description:
      "Trade prints, orderbook deltas, account updates, and mark prices stream in real time.",
    icon: RadioTower,
  },
  {
    title: "API-first access",
    description:
      "Stable REST payloads, explicit errors, and predictable contracts keep integrations clean.",
    icon: FileCode2,
  },
  {
    title: "Risk controls",
    description:
      "Margin, funding, liquidation, and insurance workflows stay isolated from order matching.",
    icon: ShieldCheck,
  },
  {
    title: "Service boundaries",
    description:
      "Each service owns a focused responsibility, making the exchange easier to scale.",
    icon: Boxes,
  },
  {
    title: "Fast observability",
    description:
      "Stream lag, health checks, worker state, and market-level signals are built for quick diagnosis.",
    icon: Gauge,
  },
];

const performanceMetrics = [
  {
    value: 100000,
    suffix: "+",
    label: "Orders / Second",
    description: "Designed around sequential per-market command processing.",
  },
  {
    value: 1,
    prefix: "<",
    suffix: "ms",
    label: "Matching Latency",
    description: "No relational writes in the matching engine hot path.",
  },
  {
    value: 99.99,
    suffix: "%",
    decimals: 2,
    label: "Reliability Target",
    description:
      "Idempotent side effects, durable outbox, and replayable streams.",
  },
];

const roadmap = [
  {
    title: "Public SDKs",
    body: "Typed clients for order entry, market data subscriptions, and account state.",
  },
  {
    title: "Multi-Market Scaling",
    body: "Shard matching workers by market while preserving deterministic command order.",
  },
  {
    title: "Institutional Controls",
    body: "API keys, session policies, and operator-level observability for production desks.",
  },
  {
    title: "Status Surface",
    body: "Health checks, stream lag, worker state, and market-level incident visibility.",
  },
];

export function LandingPage() {
  return (
    <LayoutFrame>
      <main className="relative min-h-screen overflow-hidden bg-[#09090b] text-[#fafafa]">
        <Navbar />
        <HeroSection />
        <SectionDivider />
        <ArchitectureSection />
        <SectionDivider />
        <FeaturesSection />
        <SectionDivider />
        <PerformanceSection />
        <SectionDivider />
        <DeveloperSection />
        <SectionDivider />
        <RoadmapSection />
        <SectionDivider />
        <CtaSection />
        <SectionDivider />
        <Footer />
      </main>
    </LayoutFrame>
  );
}

function HeroSection() {
  return (
    <SectionWrapper className="pb-24 pt-32 sm:pb-28 sm:pt-40" id="top">
      <motion.div
        animate="show"
        className="mx-auto flex max-w-5xl flex-col items-center text-center"
        initial="hidden"
        variants={stagger}
      >
        <motion.div
          className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#27272a] bg-[#111113] px-3 py-1.5 text-xs font-medium text-zinc-400 shadow-[0_1px_0_rgba(255,255,255,0.04)_inset]"
          variants={fadeUp}
        >
          <PulsatingButton
            aria-label="Live status"
            pulseColor="#22c55e"
            duration="2.5s"
            className="h-2 w-2 rounded-full bg-yellow-500 p-0 text-transparent shadow-none pointer-events-none"
          >
            .
          </PulsatingButton>
          Beta V1
        </motion.div>
        <motion.h1
          className="max-w-4xl text-balance text-5xl font-semibold leading-[1.03] tracking-normal text-zinc-50 sm:text-6xl lg:text-7xl"
          variants={fadeUp}
        >
          Built for traders who{" "}
          <CanvasText
            text="don't settle"
            backgroundClassName="bg-blue-600 dark:bg-blue-700"
            colors={[
              "rgba(0, 153, 255, 1)",
              "rgba(0, 153, 255, 0.9)",
              "rgba(0, 153, 255, 0.8)",
              "rgba(0, 153, 255, 0.7)",
              "rgba(0, 153, 255, 0.6)",
              "rgba(0, 153, 255, 0.5)",
              "rgba(0, 153, 255, 0.4)",
              "rgba(0, 153, 255, 0.3)",
              "rgba(0, 153, 255, 0.2)",
              "rgba(0, 153, 255, 0.1)",
            ]}
            lineGap={4}
            animationDuration={20}
          />
        </motion.h1>
        <motion.p
          className="mt-6 max-w-2xl text-pretty text-base leading-8 text-zinc-400 sm:text-lg"
          variants={fadeUp}
        >
          A modern exchange backend with event-driven architecture, low latency
          matching, durable recovery, real-time streams, and developer-first
          APIs.
        </motion.p>
        <motion.div
          className="mt-9 flex flex-col gap-3 sm:flex-row"
          variants={fadeUp}
        >
          <a
            className={cn(
              buttonVariants({ variant: "primary", size: "lg" }),
              "text-zinc-900",
            )}
            href="#cta"
          >
            <span className="relative z-10 text-zinc-950">Launch Exchange</span>
            <ArrowRight
              className="relative z-10 h-4 w-4 text-zinc-950"
              aria-hidden="true"
            />
          </a>
          <a
            className={cn(buttonVariants({ variant: "secondary", size: "lg" }))}
            href={docsHref}
          >
            View Documentation
            <BookOpen className="h-4 w-4" aria-hidden="true" />
          </a>
        </motion.div>
        <motion.div
          className="mt-12 grid w-full max-w-3xl grid-cols-1 divide-y divide-[#27272a] rounded-lg border border-[#27272a] bg-[#111113]/65 text-left shadow-[0_1px_0_rgba(255,255,255,0.04)_inset] sm:grid-cols-3 sm:divide-x sm:divide-y-0"
          variants={fadeUp}
        >
          {stats.map((stat) => (
            <div className="p-5 text-center" key={stat.label}>
              <div className="text-xl font-semibold text-zinc-50">
                {stat.value}
              </div>
              <div className="mt-1 text-xs uppercase tracking-[0.16em] text-zinc-400">
                {stat.label}
              </div>
            </div>
          ))}
        </motion.div>
      </motion.div>
    </SectionWrapper>
  );
}

function ArchitectureSection() {
  const sectionRef = useRef<HTMLElement | null>(null);

  return (
    <SectionWrapper
      className="bg-[#111113]/[0.18]"
      id="architecture"
      ref={sectionRef}
    >
      <div className="mx-auto max-w-7xl">
        <SectionHeading
          eyebrow="Architecture"
          title="A clean execution pipeline from intent to recovery."
          description="The public API stays separate from the matching hot path. Commands are ordered, events are replayable, and durable state catches up through workers."
        />
        <ExchangePreview />
      </div>
    </SectionWrapper>
  );
}

function ExchangePreview() {
  return (
    <motion.div
      className="mx-auto mt-14 max-w-7xl"
      initial={{ opacity: 0, y: 28 }}
      viewport={{ once: true, amount: 0.22 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="relative overflow-hidden rounded-lg border border-white/10 bg-[#0b0b0c] shadow-[0_34px_110px_rgba(0,0,0,0.48),0_0_0_1px_rgba(255,255,255,0.04)_inset]">
        {/* Header */}
        <div className="flex h-11 items-center border-b border-white/10 px-5">
          <div className="flex gap-2">
            <span className="h-3 w-3 rounded-full bg-white/15" />
            <span className="h-3 w-3 rounded-full bg-white/15" />
            <span className="h-3 w-3 rounded-full bg-white/15" />
          </div>
        </div>

        {/* Content */}
        <div className="p-3 sm:p-4">
          <div className="overflow-hidden rounded-[14px] border border-white/10 bg-[#0f0f10] shadow-[0_1px_0_rgba(255,255,255,0.05)_inset]">
            <Image
              src="/exchange.png"
              alt="Exchange application interface"
              width={1732}
              height={908}
              className="aspect-[1732/908] w-full object-cover opacity-80"
            />
          </div>
        </div>

        {/* Glow overlay */}
        <div className="pointer-events-none absolute inset-0 rounded-[22px] ring-1 ring-white/[0.03]" />

        {/* Optional gradient glow */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-white/[0.02] to-transparent" />
      </div>
    </motion.div>
  );
}

function FeaturesSection() {
  const [activeFeature, setActiveFeature] = useState<string | null>(null);

  return (
    <SectionWrapper className="bg-[#09090b]" id="features">
      <div className="mx-auto max-w-[1060px]">
        <SectionHeading
          eyebrow="Features"
          title={
            <>
              <span className="text-neutral-500">The </span>
              parts that matter{" "}
              <span className="text-neutral-500">
                in a serious exchange backend.
              </span>
            </>
          }
          description="Built from simple service boundaries, explicit persistence, and a matching engine that can be reasoned about under load."
        />
        <motion.div
          className="mx-auto mt-12 grid max-w-[840px] grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
          initial="hidden"
          variants={stagger}
          viewport={{ once: true, amount: 0.2 }}
          whileInView="show"
        >
          {features.map((feature) => {
            const Icon = feature.icon;
            const isActive = activeFeature === feature.title;

            return (
              <motion.div key={feature.title} variants={fadeUp}>
                <Card
                  className={cn(
                    "relative flex min-h-[176px] items-center justify-center overflow-hidden border-[#27272a] bg-[#111113] px-4 py-6 text-center text-zinc-50 shadow-[0_12px_32px_rgba(0,0,0,0.28),0_1px_0_rgba(255,255,255,0.03)_inset] transition-all duration-300 sm:min-h-[188px]",
                    isActive
                      ? "-translate-y-1 border-white/[0.16] bg-[#141417]"
                      : "hover:-translate-y-1 hover:border-white/[0.16] hover:bg-[#141417]",
                  )}
                  onBlur={() => setActiveFeature(null)}
                  onFocus={() => setActiveFeature(feature.title)}
                  onMouseEnter={() => setActiveFeature(feature.title)}
                  onMouseLeave={() => setActiveFeature(null)}
                  tabIndex={0}
                >
                  {/* Animated dots */}
                  <motion.div
                    animate={{
                      height: isActive ? "calc(100% - 32px)" : "48px",
                      left: isActive ? "16px" : "calc(50% - 24px)",
                      top: isActive ? "16px" : "calc(50% - 55px)",
                      width: isActive ? "calc(100% - 32px)" : "48px",
                    }}
                    transition={{
                      duration: 0.45,
                      ease: [0.22, 1, 0.36, 1],
                    }}
                    className="pointer-events-none absolute"
                  >
                    <span className="absolute left-0 top-0 h-[5px] w-[5px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-zinc-600" />
                    <span className="absolute right-0 top-0 h-[5px] w-[5px] -translate-y-1/2 translate-x-1/2 rounded-full bg-zinc-600" />
                    <span className="absolute bottom-0 left-0 h-[5px] w-[5px] -translate-x-1/2 translate-y-1/2 rounded-full bg-zinc-600" />
                    <span className="absolute bottom-0 right-0 h-[5px] w-[5px] translate-x-1/2 translate-y-1/2 rounded-full bg-zinc-600" />
                  </motion.div>

                  {/* Default state */}
                  <motion.div
                    animate={{
                      opacity: isActive ? 0 : 1,
                      scale: isActive ? 0.95 : 1,
                      y: isActive ? -12 : 0,
                    }}
                    transition={{
                      duration: 0.3,
                      ease: [0.22, 1, 0.36, 1],
                    }}
                    className="flex flex-col items-center"
                  >
                    <div className="mb-5 flex h-[68px] w-[68px] items-center justify-center rounded-[15px] border border-[#27272a] bg-[#18181b]">
                      <Icon className="h-7 w-7 text-zinc-300" />
                    </div>

                    <CardTitle className="flex h-[42px] max-w-[9rem] items-center justify-center text-[17px] leading-[21px] text-zinc-50">
                      {feature.title}
                    </CardTitle>
                  </motion.div>

                  {/* Expanded state */}
                  <motion.div
                    animate={{
                      opacity: isActive ? 1 : 0,
                      y: isActive ? 0 : 14,
                      scale: isActive ? 1 : 0.96,
                    }}
                    transition={{
                      delay: isActive ? 0.12 : 0,
                      duration: 0.35,
                      ease: [0.22, 1, 0.36, 1],
                    }}
                    className="absolute inset-0 flex flex-col items-center justify-center px-6"
                  >
                    <CardTitle className="text-[17px] text-zinc-50">
                      {feature.title}
                    </CardTitle>

                    <p className="mt-4 max-w-[13rem] text-sm leading-6 text-zinc-400">
                      {feature.description}
                    </p>
                  </motion.div>
                </Card>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </SectionWrapper>
  );
}

function PerformanceSection() {
  return (
    <SectionWrapper className="bg-[#111113]/25" id="performance">
      <div className="mx-auto max-w-7xl">
        <SectionHeading
          eyebrow="Performance"
          title={
            <>
              <span className="text-neutral-500">Build around </span>
              hot path
            </>
          }
          description="The engine consumes ordered commands, keeps orderbooks in memory, and delegates persistence to idempotent workers."
        />
        <div className="mt-14 grid gap-4 lg:grid-cols-3">
          {performanceMetrics.map((metric) => (
            <Card
              className="overflow-hidden bg-[#09090b] p-7 transition-colors hover:border-zinc-500"
              key={metric.label}
            >
              <AnimatedCounter
                decimals={metric.decimals}
                prefix={metric.prefix}
                suffix={metric.suffix}
                value={metric.value}
              />
              <div className="mt-4 text-lg font-medium">{metric.label}</div>
              <p className="mt-3 text-sm leading-6 text-zinc-400">
                {metric.description}
              </p>
            </Card>
          ))}
        </div>
      </div>
    </SectionWrapper>
  );
}

function AnimatedCounter({
  value,
  prefix = "",
  suffix = "",
  decimals = 0,
}: {
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!inView) return;

    let frame = 0;
    const totalFrames = 58;

    const tick = () => {
      frame += 1;
      const progress = 1 - Math.pow(1 - frame / totalFrames, 3);
      setDisplay(value * Math.min(progress, 1));

      if (frame < totalFrames) {
        requestAnimationFrame(tick);
      }
    };

    requestAnimationFrame(tick);
  }, [inView, value]);

  const formatted =
    decimals > 0
      ? display.toLocaleString("en-US", {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        })
      : Math.round(display).toLocaleString("en-US");

  return (
    <div
      className="text-5xl font-semibold tracking-normal sm:text-6xl"
      ref={ref}
    >
      {prefix ? (
        <span className={prefix === "<" ? "text-neutral-500" : undefined}>
          {prefix}
        </span>
      ) : null}
      {formatted}
      {suffix ? (
        <span
          className={
            suffix === "+" || suffix === "%" ? "text-neutral-500" : undefined
          }
        >
          {suffix}
        </span>
      ) : null}
    </div>
  );
}

function DeveloperSection() {
  return (
    <SectionWrapper id="developer">
      <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.92fr_1.08fr] lg:items-center">
        <div>
          <h2 className="mt-4 max-w-xl text-3xl font-semibold leading-tight tracking-normal sm:text-5xl">
            Predictable APIs for teams that ship trading systems.
          </h2>
          <p className="mt-5 max-w-xl text-base leading-8 text-zinc-400">
            Order submission, market discovery, account queries, and WebSocket
            streams use explicit contracts with stable errors. The backend is
            approachable in local memory mode and production-ready with
            Postgres, Redis Streams, and workers.
          </p>
          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            {[
              "REST order entry",
              "Typed domain payloads",
              "Stable error codes",
              "Replayable stream model",
            ].map((item) => (
              <div
                className="flex items-center gap-3 text-sm text-zinc-400"
                key={item}
              >
                <Check className="h-4 w-4 text-blue-500" aria-hidden="true" />
                {item}
              </div>
            ))}
          </div>
        </div>
        <CodePanel />
      </div>
    </SectionWrapper>
  );
}

function CodePanel() {
  const [copied, setCopied] = useState(false);
  const code = `POST /api/orders

{
  "marketId": "BTC-PERP",
  "side": "BUY",
  "type": "LIMIT",
  "price": "100000",
  "quantity": "1",
  "timeInForce": "GTC",
  "postOnly": true,
  "leverage": 10
}`;

  async function copyCode() {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  return (
    <Card className="overflow-hidden bg-[#0c0c0f]">
      <div className="flex items-center justify-between border-b border-[#27272a] px-4 py-3">
        <div className="flex items-center gap-2">
          <Terminal className="h-4 w-4 text-zinc-400" aria-hidden="true" />
          <span className="text-sm font-medium text-zinc-400">orders.http</span>
        </div>
        <Button
          aria-label="Copy request example"
          onClick={copyCode}
          size="sm"
          type="button"
          variant="ghost"
        >
          {copied ? (
            <Check className="h-4 w-4 text-blue-500" aria-hidden="true" />
          ) : (
            <Copy className="h-4 w-4" aria-hidden="true" />
          )}
          <span className="hidden sm:inline">{copied ? "Copied" : "Copy"}</span>
        </Button>
      </div>
      <CardContent className="p-0">
        <pre className="overflow-x-auto p-5 text-sm leading-7 text-zinc-300">
          <code>
            <span className="text-blue-500">POST</span>{" "}
            <span className="text-zinc-100">/api/orders</span>
            {"\n\n"}
            {"{\n"}
            {"  "}
            <span className="text-blue-300">{'"marketId"'}</span>:{" "}
            <span className="text-emerald-300">{'"BTC-PERP"'}</span>,{"\n"}
            {"  "}
            <span className="text-blue-300">{'"side"'}</span>:{" "}
            <span className="text-emerald-300">{'"BUY"'}</span>,{"\n"}
            {"  "}
            <span className="text-blue-300">{'"type"'}</span>:{" "}
            <span className="text-emerald-300">{'"LIMIT"'}</span>,{"\n"}
            {"  "}
            <span className="text-blue-300">{'"price"'}</span>:{" "}
            <span className="text-emerald-300">{'"100000"'}</span>,{"\n"}
            {"  "}
            <span className="text-blue-300">{'"quantity"'}</span>:{" "}
            <span className="text-emerald-300">{'"1"'}</span>,{"\n"}
            {"  "}
            <span className="text-blue-300">{'"timeInForce"'}</span>:{" "}
            <span className="text-emerald-300">{'"GTC"'}</span>,{"\n"}
            {"  "}
            <span className="text-blue-300">{'"postOnly"'}</span>:{" "}
            <span className="text-purple-300">true</span>,{"\n"}
            {"  "}
            <span className="text-blue-300">{'"leverage"'}</span>:{" "}
            <span className="text-amber-300">10</span>
            {"\n}"}
          </code>
        </pre>
      </CardContent>
    </Card>
  );
}

function RoadmapSection() {
  return (
    <SectionWrapper className="bg-[#111113]/[0.14]" id="roadmap">
      <div className="mx-auto max-w-5xl">
        <SectionHeading
          eyebrow="Roadmap"
          title="A pragmatic path from reference backend to production surface."
          description="Future milestones focus on integration quality, operator confidence, and scaling the same clear architecture."
        />
        <div className="mt-14">
          {roadmap.map((item, index) => (
            <motion.div
              className="relative grid gap-6 border-l border-[#27272a] pb-10 pl-8 last:pb-0 sm:grid-cols-[12rem_1fr]"
              initial={{ opacity: 0, y: 18 }}
              key={item.title}
              viewport={{ once: true, amount: 0.45 }}
              whileInView={{ opacity: 1, y: 0 }}
            >
              <div className="absolute -left-[0.42rem] top-1 flex h-3 w-3 rounded-full border border-blue-500 bg-[#09090b] shadow-[0_0_0_6px_rgba(59,130,246,0.08)]" />
              <div className="text-sm uppercase tracking-[0.16em] text-zinc-400">
                Phase {index + 1}
              </div>
              <div>
                <h3 className="font-semibold">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-zinc-400">
                  {item.body}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </SectionWrapper>
  );
}

function CtaSection() {
  return (
    <SectionWrapper id="cta">
      <div className="mx-auto max-w-5xl rounded-lg border border-[#27272a] bg-[#111113] p-8 text-center shadow-[0_1px_0_rgba(255,255,255,0.04)_inset] sm:p-12">
        <h2 className="text-balance text-3xl font-semibold leading-tight tracking-normal sm:text-5xl">
          <span className="text-neutral-500">Build on a </span> Modern Exchange
          <span className="text-neutral-500"> Infrastructure</span>
        </h2>
        <p className="mx-auto mt-5 max-w-2xl text-base leading-8 text-zinc-400">
          Launch with a backend shaped around deterministic matching, durable
          persistence, real-time market streams, and operational clarity.
        </p>
        <div className="mt-8 pb-6 flex flex-col justify-center gap-3 sm:flex-row">
          <a
            className={cn(
              buttonVariants({ variant: "primary", size: "lg" }),
              "text-gray-950!",
            )}
            href="#developer"
          >
            Launch App
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </a>
          <a
            className={cn(buttonVariants({ variant: "secondary", size: "lg" }))}
            href={docsHref}
          >
            Read Docs
            <BookOpen className="h-4 w-4" aria-hidden="true" />
          </a>
        </div>
        <WorldMap
          theme="dark"
          lineColor="#3b82f6"
          dots={[
            {
              start: {
                lat: 64.2008,
                lng: -149.4937,
              }, // Alaska (Fairbanks)
              end: {
                lat: 34.0522,
                lng: -118.2437,
              }, // Los Angeles
            },
            {
              start: { lat: 64.2008, lng: -149.4937 }, // Alaska (Fairbanks)
              end: { lat: -15.7975, lng: -47.8919 }, // Brazil (Brasília)
            },
            {
              start: { lat: -15.7975, lng: -47.8919 }, // Brazil (Brasília)
              end: { lat: 38.7223, lng: -9.1393 }, // Lisbon
            },
            {
              start: { lat: 51.5074, lng: -0.1278 }, // London
              end: { lat: 28.6139, lng: 77.209 }, // New Delhi
            },
            {
              start: { lat: 28.6139, lng: 77.209 }, // New Delhi
              end: { lat: 43.1332, lng: 131.9113 }, // Vladivostok
            },
            {
              start: { lat: 28.6139, lng: 77.209 }, // New Delhi
              end: { lat: -1.2921, lng: 36.8219 }, // Nairobi
            },
          ]}
        />
      </div>
    </SectionWrapper>
  );
}

function Footer() {
  const links = [
    { label: "Github", href: githubHref, icon: FaGithub },
    { label: "Documentation", href: docsHref, icon: BookOpen },
    { label: "API", href: `${githubHref}/blob/main/docs/API.md`, icon: Code2 },
    { label: "Status", href: "#performance", icon: LineChart },
    { label: "Contact", href: `${githubHref}/issues`, icon: LockKeyhole },
  ];

  return (
    <footer className="px-[calc(64px+1.5rem)] py-10 sm:px-[calc(64px+2rem)] lg:px-[calc(64px+3.25rem)] xl:px-[calc(72px+3.5rem)]">
      <div className="flex w-full flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3 text-sm font-semibold">
            <a
              className="group flex items-center gap-2.5"
              href="#top"
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
                  fontSize: "1.15rem",
                  letterSpacing: "-0.025em",
                  color: "#ffffff",
                }}
              >
                flux
              </span>
            </a>
          </div>
          <p className="mt-3 text-sm text-zinc-400">
            Perpetual futures infrastructure for modern teams.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {links.map((link) => {
            const Icon = link.icon;

            return (
              <a
                className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm text-zinc-400 transition-colors hover:bg-white/[0.04] hover:text-zinc-50"
                href={link.href}
                key={link.label}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {link.label}
              </a>
            );
          })}
        </div>
      </div>
    </footer>
  );
}

function SectionHeading({
  eyebrow,
  title,
  description,
  tone = "dark",
}: {
  eyebrow: string;
  title: React.ReactNode;
  description: string;
  tone?: "dark" | "light";
}) {
  const isLight = tone === "light";

  return (
    <motion.div
      className="mx-auto max-w-3xl text-center"
      initial={{ opacity: 0, y: 24 }}
      viewport={{ once: true, amount: 0.35 }}
      whileInView={{ opacity: 1, y: 0 }}
    >
      <h2
        className={cn(
          "mt-4 text-balance text-3xl font-semibold leading-tight tracking-normal sm:text-5xl",
          isLight ? "text-[#27272a]" : "text-zinc-50",
        )}
      >
        {title}
      </h2>
      <p
        className={cn(
          "mt-5 text-base leading-8",
          isLight ? "text-zinc-600" : "text-neutral-600",
        )}
      >
        {description}
      </p>
    </motion.div>
  );
}

function SectionKicker({
  children,
  tone = "dark",
}: {
  children: React.ReactNode;
  tone?: "dark" | "light";
}) {
  const isLight = tone === "light";

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium uppercase tracking-[0.14em]",
        isLight
          ? "border-zinc-200 bg-white text-zinc-500"
          : "border-[#27272a] bg-[#111113] text-zinc-400",
      )}
    >
      <Clock3 className="h-3.5 w-3.5 text-blue-500" aria-hidden="true" />
      {children}
    </div>
  );
}
