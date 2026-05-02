import { cn } from "@/lib/utils"

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "shimmer-bg rounded-md border border-border/40",
        className
      )}
      {...props}
    />
  )
}

export { Skeleton }
