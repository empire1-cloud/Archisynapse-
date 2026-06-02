import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap font-black uppercase tracking-widest text-[10px] transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
        outline: "border border-white/10 bg-transparent text-foreground/70 hover:bg-white/5",
        ghost: "text-foreground/60 hover:bg-white/5",
        glow: "bg-primary/10 border border-primary/30 text-primary hover:bg-primary/20",
        glass: "bg-white/5 border border-white/10 text-foreground/80 hover:bg-white/10 shadow-xl backdrop-blur-xl",
      },
      size: {
        default: "h-11 px-6 rounded-2xl",
        sm: "h-9 px-4 rounded-xl text-[9px]",
        lg: "h-12 px-10 rounded-2xl",
        icon: "h-11 w-11 p-0 rounded-2xl",
        pill: "h-9 rounded-full px-8 text-[10px]",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
)

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
  }
)
Button.displayName = "Button"
export { Button, buttonVariants }
