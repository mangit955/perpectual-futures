import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "relative inline-flex items-center justify-center gap-2 overflow-hidden whitespace-nowrap rounded-md text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/70 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary:
          "bg-zinc-50 text-zinc-950 shadow-[0_0_0_1px_rgba(255,255,255,0.1),0_18px_50px_rgba(255,255,255,0.08)] before:absolute before:inset-0 before:-translate-x-full before:bg-[linear-gradient(110deg,transparent,rgba(255,255,255,0.34),transparent)] before:transition-transform before:duration-700 hover:bg-white/90 hover:before:translate-x-full",
        secondary:
          "border border-[#27272a] bg-[#111113] text-zinc-50 hover:border-zinc-500 hover:bg-[#18181b]",
        ghost: "text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-50",
        accent:
          "bg-blue-500 text-white shadow-[0_18px_44px_rgba(59,130,246,0.20)] before:absolute before:inset-0 before:-translate-x-full before:bg-[linear-gradient(110deg,transparent,rgba(255,255,255,0.20),transparent)] before:transition-transform before:duration-700 hover:bg-blue-500 hover:before:translate-x-full",
      },
      size: {
        sm: "h-9 px-3",
        md: "h-10 px-4",
        lg: "h-11 px-5",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

export interface ButtonProps
  extends
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button
      className={cn(buttonVariants({ variant, size, className }))}
      ref={ref}
      {...props}
    />
  ),
);
Button.displayName = "Button";

export { Button, buttonVariants };
