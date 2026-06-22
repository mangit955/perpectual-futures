"use client";

import {
  Modal,
  ModalBody,
  ModalContent,
  ModalTrigger,
} from "@/components/ui/animated-modal";
import { Mail, Lock, Shield, Zap, TrendingUp, Eye } from "lucide-react";

export function AuthModal() {
  return (
    <Modal>
      <ModalTrigger className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-white hover:bg-white/10">
        Sign In
      </ModalTrigger>

      <ModalBody className="max-w-5xl overflow-hidden border border-white/10 bg-black p-0">
        <ModalContent className="p-0">
          <div className="grid min-h-[650px] grid-cols-1 lg:grid-cols-2">
            {/* LEFT SIDE */}
            <div className="flex flex-col justify-center px-10 py-12">
              {/* Logo */}
              <div className="mb-10 flex items-center gap-3">
                <div className="flex gap-1">
                  <div className="h-3 w-3 rounded-sm bg-white" />
                  <div className="h-5 w-2 rounded-full bg-white" />
                </div>

                <span className="text-lg font-semibold text-white">flux</span>
              </div>

              <h1 className="mb-4 text-5xl font-semibold tracking-tight text-white">
                Welcome back!
              </h1>

              <p className="mb-10 max-w-md text-neutral-400">
                Log in to trade perpetual futures, manage your portfolio, and
                access real-time markets on Flux.
              </p>

              {/* Email */}
              <div className="mb-5">
                <label className="mb-2 block text-xs uppercase tracking-wider text-neutral-500">
                  Email
                </label>

                <div className="flex h-12 items-center rounded-xl border border-white/10 bg-white/[0.03] px-4">
                  <Mail className="mr-3 h-4 w-4 text-neutral-500" />
                  <input
                    type="email"
                    placeholder="name@example.com"
                    className="w-full bg-transparent text-white outline-none placeholder:text-neutral-500"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="mb-2 block text-xs uppercase tracking-wider text-neutral-500">
                  Password
                </label>

                <div className="flex h-12 items-center rounded-xl border border-white/10 bg-white/[0.03] px-4">
                  <Lock className="mr-3 h-4 w-4 text-neutral-500" />
                  <input
                    type="password"
                    placeholder="Create a password"
                    className="w-full bg-transparent text-white outline-none placeholder:text-neutral-500"
                  />

                  <Eye className="h-4 w-4 text-neutral-500" />
                </div>
              </div>

              {/* Button */}
              <button className="mt-6 h-12 rounded-xl bg-white text-black font-medium transition hover:bg-neutral-200">
                Sign In
              </button>

              {/* Divider */}
              <div className="my-8 flex items-center">
                <div className="h-px flex-1 bg-white/10" />
                <span className="mx-4 text-sm text-neutral-500">or</span>
                <div className="h-px flex-1 bg-white/10" />
              </div>

              {/* Social */}
              <div className="grid grid-cols-3 gap-3">
                <button className="flex h-12 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-white transition hover:bg-white/[0.06]">
                  G
                </button>

                <button className="flex h-12 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-white transition hover:bg-white/[0.06]">
                  f
                </button>

                <button className="flex h-12 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-white transition hover:bg-white/[0.06]">
                  
                </button>
              </div>

              <p className="mt-8 text-sm text-neutral-500">
                Don't have an account?{" "}
                <span className="cursor-pointer text-white">Sign up</span>
              </p>
            </div>

            {/* RIGHT SIDE */}
            <div className="relative hidden lg:flex flex-col justify-end overflow-hidden border-l border-white/10">
              {/* Background */}
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,#bfa57a_0%,#2a2118_30%,#000_100%)]" />

              <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-green-900/30" />

              <div className="relative z-10 p-8">
                <div className="mb-4 flex gap-3">
                  <span className="rounded-full border border-white/10 bg-black/30 px-4 py-2 text-xs text-white backdrop-blur-md">
                    ⚡ Built for Speed
                  </span>

                  <span className="rounded-full border border-white/10 bg-black/30 px-4 py-2 text-xs text-white backdrop-blur-md">
                    🛡 Secure by Design
                  </span>
                </div>

                <div className="rounded-3xl border border-white/10 bg-black/20 p-8 backdrop-blur-xl">
                  <h3 className="mb-4 text-3xl font-medium text-white">
                    Access the fastest perpetuals trading experience.
                  </h3>

                  <p className="mb-8 text-neutral-300">
                    Deep liquidity, low latency execution, and
                    institutional-grade infrastructure.
                  </p>

                  <div className="space-y-5">
                    <div className="flex items-center gap-4">
                      <TrendingUp className="h-5 w-5 text-white" />
                      <span className="text-neutral-200">
                        Real-time market data
                      </span>
                    </div>

                    <div className="flex items-center gap-4">
                      <Shield className="h-5 w-5 text-white" />
                      <span className="text-neutral-200">
                        Non-custodial & secure
                      </span>
                    </div>

                    <div className="flex items-center gap-4">
                      <Zap className="h-5 w-5 text-white" />
                      <span className="text-neutral-200">
                        Built for traders, by traders
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </ModalContent>
      </ModalBody>
    </Modal>
  );
}
