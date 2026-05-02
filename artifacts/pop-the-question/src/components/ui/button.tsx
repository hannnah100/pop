import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"
import { playSfx, unlockAudio } from "@/lib/sfx"
import { hapticTap } from "@/lib/haptics"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-base font-semibold font-sans transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 active:scale-[0.98]",
  {
    variants: {
      variant: {
        // Default = static warm gradient (red → orange → gold) per design spec.
        default:
          "bg-rainbow-warm text-white border-0 shadow-[0_4px_16px_-4px_hsl(var(--primary)/0.40)] hover:shadow-[0_8px_24px_-4px_hsl(var(--accent)/0.50)] hover:-translate-y-0.5",
        destructive:
          "bg-destructive text-destructive-foreground shadow-[0_4px_16px_-4px_hsl(var(--destructive)/0.40)] hover:shadow-[0_8px_24px_-4px_hsl(var(--destructive)/0.55)] hover:-translate-y-0.5",
        outline:
          "border-2 border-white/15 bg-transparent text-foreground hover:bg-white/5 hover:border-accent/50",
        secondary:
          "bg-secondary text-secondary-foreground shadow-[0_4px_16px_-4px_hsl(var(--secondary)/0.40)] hover:brightness-110 hover:-translate-y-0.5",
        ghost: "border-0 hover:bg-white/5",
        link: "text-accent underline-offset-4 hover:underline",
      },
      size: {
        // Mobile-first: minimum 48px tap target by default.
        default: "min-h-12 px-5 py-3",
        sm: "min-h-10 rounded-lg px-4 text-sm",
        lg: "min-h-14 rounded-2xl px-8 text-lg",
        icon: "h-12 w-12",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, onClick, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    const handleClick: React.MouseEventHandler<HTMLButtonElement> = (e) => {
      unlockAudio()
      hapticTap()
      playSfx("tap")
      onClick?.(e)
    }
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        onClick={handleClick}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
