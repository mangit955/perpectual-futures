"use client";

import { type ReactNode } from "react";

export function LayoutFrame({ children }: { children: ReactNode }) {
  return (
    <div className="relative">
      <div className="pointer-events-none fixed bottom-0 left-[64px] top-0 z-30 w-px bg-neutral-800 xl:left-[72px]" />
      <div className="pointer-events-none fixed bottom-0 right-[64px] top-0 z-30 w-px bg-neutral-800 xl:right-[72px]" />
      {children}
    </div>
  );
}

export function SectionDivider() {
  return (
    <div className="relative z-30">
      <div className="h-px w-full bg-neutral-800" />
      <div className="absolute left-[64px] top-1/2 -translate-x-1/2 -translate-y-1/2 xl:left-[72px]">
        <PlusMarker />
      </div>
      <div className="absolute right-[64px] top-1/2 translate-x-1/2 -translate-y-1/2 xl:right-[72px]">
        <PlusMarker />
      </div>
    </div>
  );
}

function PlusMarker() {
  return (
    <div className="relative h-9 w-9 bg-[#09090b]">
      <div className="absolute left-1/2 top-[7px] h-[22px] w-px -translate-x-1/2 bg-neutral-500" />
      <div className="absolute left-[7px] top-1/2 h-px w-[22px] -translate-y-1/2 bg-neutral-500" />
    </div>
  );
}
