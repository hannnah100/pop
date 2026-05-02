import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"
import { playSfx, unlockAudio } from "@/lib/sfx"
import { hapticTap } from "@/lib/haptics"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap text-base font-bold font-sans transition-transform duration-75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-40 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 active:scale-[0.95] active:translate-y-[2px]",
  {
    variants: {
      variant: {
        default:
          "bg-[#FF1493] text-black border-[3px] border-black shadow-[4px_4px_0_#000] hover:bg-[#FFD700] hover:-rotate-1 active:shadow-[2px_2px_0_#000]",
        destructive:
          "bg-[#FF0000] text-white border-[3px] border-black shadow-[4px_4px_0_#000] hover:bg-[#FF6B6B] hover:text-black active:shadow-[2px_2px_0_#000]",
        outline:
          "bg-white text-black border-[3px] border-black shadow-[4px_4px_0_#000] hover:bg-[#00E5FF] active:shadow-[2px_2px_0_#000]",
        secondary:
          "bg-[#00C853] text-black border-[3px] border-black shadow-[4px_4px_0_#000] hover:bg-[#FFD700] active:shadow-[2px_2px_0_#000]",
        ghost:
          "bg-transparent border-0 shadow-none hover:bg-[#FFD700] hover:text-black",
        link:
          "text-[#FF1493] underline-offset-4 hover:underline border-0 shadow-none",
      },
      size: {
        default: "min-h-12 px-5 py-3",
        sm: "min-h-10 px-4 text-sm",
        lg: "min-h-14 px-8 text-lg",
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
