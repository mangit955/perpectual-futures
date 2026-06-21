import { forwardRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export const SectionWrapper = forwardRef<HTMLElement, {
  children: ReactNode;
  className?: string;
  id?: string;
}>(({ children, className, id }, ref) => (
  <section
    className={cn(
      "relative isolate overflow-hidden px-[calc(64px+1.5rem)] py-24 sm:px-[calc(64px+2rem)] lg:px-[calc(64px+3.25rem)] xl:px-[calc(72px+3.5rem)]",
      className,
    )}
    id={id}
    ref={ref}
  >
    {children}
  </section>
));
SectionWrapper.displayName = "SectionWrapper";
