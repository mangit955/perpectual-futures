"use client";

import { useEffect, useRef, useState } from "react";
import {
  motion,
  useInView,
  useMotionValueEvent,
  useScroll,
  useSpring,
  useTransform,
} from "framer-motion";
import { FaGithub } from "react-icons/fa";
import {
  ArrowRight,
  BookOpen,
  Boxes,
  Check,
  ChevronRight,
  CircleDot,
  Clock3,
  Code2,
  Copy,
  Database,
  FileCode2,
  Gauge,
  LineChart,
  LockKeyhole,
  Network,
  RadioTower,
  Server,
  ShieldCheck,
  Terminal,
  Workflow,
  Zap,
} from "lucide-react";
import { Navbar } from "@/components/landing/navbar";
import { LayoutFrame, SectionDivider } from "@/components/layout/layout-frame";
import { SectionWrapper } from "@/components/landing/section-wrapper";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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

const architectureStages = [
  {
    id: "clients",
    title: "Website / Mobile",
    description: "Clients submit signed intent through a narrow API surface.",
    icon: Network,
  },
  {
    id: "backend",
    title: "Backend",
    description:
      "Auth, validation, risk pre-checks, Postgres writes, and outbox rows.",
    icon: Server,
  },
  {
    id: "queue",
    title: "Event Queue",
    description:
      "Redis Streams order commands and execution events per market.",
    icon: Workflow,
  },
  {
    id: "engine",
    title: "Matching Engine",
    description:
      "Deterministic price-time priority with fills emitted from the hot path.",
    icon: Gauge,
  },
  {
    id: "snapshots",
    title: "Snapshots",
    description: "Orderbooks recover from snapshots plus stream replay.",
    icon: Database,
  },
];

const features = [
  {
    title: "Event Sourced Matching",
    description:
      "Commands and engine events move through ordered streams, keeping execution deterministic and auditable.",
    icon: Workflow,
  },
  {
    title: "Snapshot Recovery",
    description:
      "The orderbook restores from periodic snapshots and replays only the events needed to catch up.",
    icon: Database,
  },
  {
    title: "Low Latency Execution",
    description:
      "The matching engine owns the in-memory book and avoids database writes in the hot path.",
    icon: Zap,
  },
  {
    title: "Real-Time Market Data",
    description:
      "Public and private streams fan out trades, orderbook deltas, positions, and mark prices.",
    icon: RadioTower,
  },
  {
    title: "API First",
    description:
      "REST order entry, stable error codes, and predictable payloads make integrations straightforward.",
    icon: FileCode2,
  },
  {
    title: "Risk Engine",
    description:
      "Margin, funding, liquidation, and insurance fund logic are separated and covered by focused tests.",
    icon: ShieldCheck,
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
          Perpetual Futures Infrastructure
          <CanvasText
            text="Built for Speed"
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
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start 70%", "end 40%"],
  });
  const smoothProgress = useSpring(scrollYProgress, {
    stiffness: 90,
    damping: 24,
    mass: 0.4,
  });
  const [activeIndex, setActiveIndex] = useState(0);

  useMotionValueEvent(smoothProgress, "change", (latest) => {
    setActiveIndex(
      Math.min(
        architectureStages.length - 1,
        Math.max(0, Math.floor(latest * architectureStages.length)),
      ),
    );
  });

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
        <div className="mt-14 grid gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
          <motion.div
            className="space-y-4"
            initial="hidden"
            variants={stagger}
            viewport={{ once: true, amount: 0.35 }}
            whileInView="show"
          >
            {architectureStages.map((stage, index) => {
              const Icon = stage.icon;
              const isActive = index <= activeIndex;

              return (
                <motion.div
                  className={cn(
                    "group rounded-lg border bg-[#111113] p-5 transition-all duration-300",
                    isActive
                      ? "border-blue-500/60 shadow-[0_0_0_1px_rgba(59,130,246,0.12),0_24px_60px_rgba(59,130,246,0.08)]"
                      : "border-[#27272a] hover:border-zinc-500",
                  )}
                  key={stage.id}
                  variants={fadeUp}
                >
                  <div className="flex items-start gap-4">
                    <span
                      className={cn(
                        "flex h-10 w-10 shrink-0 items-center justify-center rounded-md border transition-colors",
                        isActive
                          ? "border-blue-500/50 bg-blue-500/10 text-blue-500"
                          : "border-[#27272a] bg-[#09090b] text-zinc-400 group-hover:text-zinc-50",
                      )}
                    >
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <div>
                      <h3 className="font-semibold text-zinc-50">
                        {stage.title}
                      </h3>
                      <p className="mt-1 text-sm leading-6 text-zinc-400">
                        {stage.description}
                      </p>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
          <ArchitectureDiagram
            activeIndex={activeIndex}
            progress={smoothProgress}
          />
        </div>
      </div>
    </SectionWrapper>
  );
}

function ArchitectureDiagram({
  activeIndex,
  progress,
}: {
  activeIndex: number;
  progress: ReturnType<typeof useSpring>;
}) {
  const flowHeight = useTransform(progress, [0, 1], ["0%", "100%"]);

  return (
    <div className="relative rounded-lg border border-[#27272a] bg-[#111113] p-4 shadow-[0_1px_0_rgba(255,255,255,0.04)_inset] sm:p-6">
      <div className="absolute inset-0 rounded-lg bg-[radial-gradient(circle_at_50%_0%,rgba(59,130,246,0.12),transparent_26rem)]" />
      <div className="relative mx-auto max-w-xl">
        <div className="absolute left-1/2 top-8 hidden h-[calc(100%-4rem)] w-px -translate-x-1/2 bg-border sm:block" />
        <motion.div
          className="absolute left-1/2 top-8 hidden w-px -translate-x-1/2 bg-blue-500 shadow-[0_0_24px_rgba(59,130,246,0.7)] sm:block"
          style={{ height: flowHeight }}
        />
        <div className="space-y-4">
          {architectureStages.map((stage, index) => {
            const Icon = stage.icon;
            const isActive = index <= activeIndex;

            return (
              <motion.div
                animate={{
                  opacity: isActive ? 1 : 0.68,
                  scale: isActive ? 1 : 0.985,
                }}
                className="relative grid gap-3 sm:grid-cols-[1fr_3rem_1fr] sm:items-center"
                key={stage.id}
                transition={{ duration: 0.25 }}
              >
                <div
                  className={cn(
                    "rounded-lg border p-4 transition-colors duration-300",
                    index % 2 === 0 ? "sm:col-start-1" : "sm:col-start-3",
                    isActive
                      ? "border-blue-500/55 bg-[#09090b]"
                      : "border-[#27272a] bg-[#09090b]/70",
                  )}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-md border",
                        isActive
                          ? "border-blue-500/50 bg-blue-500/10 text-blue-500"
                          : "border-[#27272a] text-zinc-400",
                      )}
                    >
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <div>
                      <div className="text-sm font-semibold">{stage.title}</div>
                      <div className="mt-0.5 text-xs text-zinc-400">
                        {stage.id === "queue"
                          ? "ordered stream"
                          : "isolated service"}
                      </div>
                    </div>
                  </div>
                </div>
                <span
                  className={cn(
                    "hidden h-8 w-8 items-center justify-center rounded-full border bg-[#111113] sm:flex sm:col-start-2 sm:row-start-1",
                    isActive
                      ? "border-blue-500 text-blue-500"
                      : "border-[#27272a] text-zinc-400",
                  )}
                >
                  <CircleDot className="h-4 w-4" aria-hidden="true" />
                </span>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function FeaturesSection() {
  return (
    <SectionWrapper id="features">
      <div className="mx-auto max-w-7xl">
        <SectionHeading
          eyebrow="Features"
          title="The parts that matter in a serious exchange backend."
          description="Built from simple service boundaries, explicit persistence, and a matching engine that can be reasoned about under load."
        />
        <motion.div
          className="mt-14 grid gap-4 md:grid-cols-2 lg:grid-cols-3"
          initial="hidden"
          variants={stagger}
          viewport={{ once: true, amount: 0.2 }}
          whileInView="show"
        >
          {features.map((feature) => {
            const Icon = feature.icon;

            return (
              <motion.div key={feature.title} variants={fadeUp}>
                <Card className="group relative h-full overflow-hidden transition-all duration-300 before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-white/20 before:to-transparent before:opacity-0 before:transition-opacity before:duration-300 hover:-translate-y-1 hover:border-white/[0.16] hover:shadow-[0_22px_70px_rgba(0,0,0,0.30)] hover:before:opacity-100">
                  <CardHeader>
                    <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-md border border-[#27272a] bg-[#09090b] text-zinc-400 transition-colors group-hover:border-blue-500/50 group-hover:text-blue-500">
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <CardTitle>{feature.title}</CardTitle>
                    <CardDescription>{feature.description}</CardDescription>
                  </CardHeader>
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
          title="Built around the hot path."
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
      {prefix}
      {formatted}
      {suffix}
    </div>
  );
}

function DeveloperSection() {
  return (
    <SectionWrapper id="developer">
      <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.92fr_1.08fr] lg:items-center">
        <div>
          <SectionKicker>Developer Experience</SectionKicker>
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
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <motion.div
      className="mx-auto max-w-3xl text-center"
      initial={{ opacity: 0, y: 24 }}
      viewport={{ once: true, amount: 0.35 }}
      whileInView={{ opacity: 1, y: 0 }}
    >
      <SectionKicker>{eyebrow}</SectionKicker>
      <h2 className="mt-4 text-balance text-3xl font-semibold leading-tight tracking-normal sm:text-5xl">
        {title}
      </h2>
      <p className="mt-5 text-base leading-8 text-zinc-400">{description}</p>
    </motion.div>
  );
}

function SectionKicker({ children }: { children: React.ReactNode }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-[#27272a] bg-[#111113] px-3 py-1.5 text-xs font-medium uppercase tracking-[0.14em] text-zinc-400">
      <Clock3 className="h-3.5 w-3.5 text-blue-500" aria-hidden="true" />
      {children}
    </div>
  );
}
