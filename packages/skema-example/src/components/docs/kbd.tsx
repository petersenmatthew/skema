import { cn } from "@/lib/utils"

interface KbdProps {
  keys: string[]
  className?: string
}

export function Kbd({ keys, className }: KbdProps) {
  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      {keys.map((key, i) => (
        <span key={i}>
          <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
            {key}
          </kbd>
          {i < keys.length - 1 && <span className="mx-0.5 text-muted-foreground/50">+</span>}
        </span>
      ))}
    </span>
  )
}
