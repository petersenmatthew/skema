import { Header } from "@/components/docs/header"
import { ThemedLogo } from "@/components/docs/themed-logo"
import Link from "next/link"

export default function OverviewPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <main className="pb-24">
        <div className="mx-auto max-w-2xl px-6 py-16">
          {/* Hero */}
          <section className="mb-24">
            <ThemedLogo className="h-30 w-auto" />
            <p className="mt-6 text-lg leading-relaxed text-muted-foreground">
              art == design == code.
            </p>
            <div className="mt-8 flex gap-3">
              <Link
                href="/install"
                className="inline-flex h-9 items-center justify-center rounded-md bg-foreground px-4 text-sm font-medium text-background transition-colors hover:bg-foreground/90"
              >
                Get Started
              </Link>
              <a
                href="https://github.com"
                className="inline-flex h-9 items-center justify-center rounded-md border border-border px-4 text-sm font-medium transition-colors hover:bg-muted"
              >
                GitHub
              </a>
            </div>
          </section>

          {/* What is Skema */}
          <section className="mb-20">
            <p className="leading-relaxed text-muted-foreground">
              <ThemedLogo className="inline-block h-6 w-auto align-middle" /> is a React component library that provides a tldraw-powered drawing overlay for annotating and manipulating DOM elements visually. It sits on top of your localhost website, allowing developers to annotate, draw, and select DOM elements directly on the live page.
            </p>
            <p className="mt-4 leading-relaxed text-muted-foreground">
              We made website development drawable. Scribble on your localhost like a whiteboard,
              point at what bothers you, and let AI do the actual coding part.
              Because explaining "the button should be 50% left" is way harder than just... moving it.
            </p>
          </section>

          {/* Key Concepts */}
          <section className="mb-20">
            <h2 className="mb-6 text-xs font-medium uppercase tracking-widest text-muted-foreground">Key Concepts</h2>
            <div className="space-y-4">
              <div className="flex justify-between border-b border-border pb-4">
                <span className="font-mono text-sm">Drawing Overlay</span>
                <span className="text-sm text-muted-foreground">Transparent layer powered by tldraw</span>
              </div>
              <div className="flex justify-between border-b border-border pb-4">
                <span className="font-mono text-sm">DOM Picker</span>
                <span className="text-sm text-muted-foreground">Select and capture any element</span>
              </div>
              <div className="flex justify-between border-b border-border pb-4">
                <span className="font-mono text-sm">Lasso Select</span>
                <span className="text-sm text-muted-foreground">Freeform multi-element selection</span>
              </div>
              <div className="flex justify-between pb-4">
                <span className="font-mono text-sm">Annotations</span>
                <span className="text-sm text-muted-foreground">Structured data for export</span>
              </div>
            </div>
          </section>

          {/* Architecture */}
          <section>
            <h2 className="mb-6 text-xs font-medium uppercase tracking-widest text-muted-foreground">Architecture</h2>
            <div className="rounded-lg border border-border bg-muted/20 p-6">
              <pre className="font-mono text-sm leading-relaxed text-muted-foreground">
                {`skema/
├── packages/
│   ├── skema-core/           # Main React component
│   │   ├── src/
│   │   │   ├── components/   # Skema overlay
│   │   │   ├── tools/        # Custom tldraw tools
│   │   │   └── utils/        # Coordinate utilities
│   │   └── package.json
│   └── skema-example/        # Next.js demo
└── package.json              # Root workspace`}
              </pre>
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}
