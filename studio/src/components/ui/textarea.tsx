import * as React from "react"
import { cn } from "@/lib/utils"

const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        "flex w-full border border-white/10 bg-white/5 px-4 py-3 shadow-sm backdrop-blur-xl transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50 text-sm resize-none",
        className
      )}
      {...props}
    />
  )
)
Textarea.displayName = "Textarea"
export { Textarea }
