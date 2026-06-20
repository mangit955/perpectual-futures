import { forwardRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export const SectionWrapper = forwardRef<HTMLElement, {
  children: ReactNode;
  className?: string;
  id?: string;
}>(({ children, className, id }, ref) => (
  <section
    className={cn("relative isolate overflow-hidden px-4 py-24 sm:px-6 lg:px-10", className)}
    id={id}
    ref={ref}
  >
    {children}
  </section>
));
SectionWrapper.displayName = "SectionWrapper";
