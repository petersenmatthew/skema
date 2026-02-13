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
              <a href="https://github.com/petersenmatthew/skema" className="inline-flex h-9 items-center justify-center rounded-md border border-border px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted">GitHub</a>
            </div>
          </section>

          {/* New Heart Icon */}
          <div className="mt-8 mb-8 flex justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-24 w-24 text-red-500">
              <path fillRule="evenodd" d="M11.645 20.91L.007.003-.02-.012c-2.712-1.609-4.707-3.794-5.836-6.091-.88-1.815-1.221-3.6-1.189-5.351.059-1.745.545-3.5 1.905-4.86l.004-.004c1.3-.004 2.583.196 3.656.79l1.04-.66c.52-.33 1.25-.33 1.77 0l1.04.66c1.073-.594 2.356-.794 3.656-.79l.004.004 1.905 4.86c1.36 1.36 1.845 3.115 1.905 4.86.032 1.751-.308 3.536-1.189 5.351-1.129 2.297-3.124 4.482-5.836 6.091-.018.01-.035.019-.053.028-.007.003-.013.006-.02.009-.016.008-.028.017-.039.025a1.693 1.693 0 0 1-.122.075c-.07.04-1.371.74-2.825-.494Z" clipRule="evenodd" />
            </svg>
          </div>

          {/* What is Skema */}
          <section className="mb-20">
            <div className="leading-relaxed text-lg text-muted-foreground">
              <ThemedLogo className="inline-block h-6 w-auto align-middle" /> is an <a href="https://www.npmjs.com/package/skema-core" className="rounded bg-muted px-1.5 py-0.5 font-mono text-sm text-foreground no-underline transition-opacity hover:opacity-70">npm package</a> that provides a drawing overlay for annotating and manipulating DOM elements visually. It sits on top of your localhost website, allowing developers to annotate, draw, and select DOM elements directly on the live page.
            </div>
            <p className="mt-4 leading-relaxed text-lg text-muted-foreground">
              <strong className="text-foreground">We made website development drawable.</strong> Scribble on your localhost like a whiteboard,
              point at what bothers you, and connect directly to AI coding agents.
              Because explaining which "the button should be 50% left" is way harder than just... moving it.
            </p>
          </section>

          {/* Key Concepts */}
          <section className="mb-20">
            <h2 className="mb-6 text-xs font-medium uppercase tracking-widest text-muted-foreground">Key Concepts</h2>
            <div className="space-y-4">
              <Link href="/features#drawing-overlay" className="flex justify-between border-b border-border pb-4 text-foreground no-underline transition-colors hover:opacity-70">
                <span className="font-mono text-sm">Drawing Overlay</span>
                <span className="text-sm text-muted-foreground">Transparent layer powered by tldraw</span>
              </Link>
              <Link href="/features#lasso-select" className="flex justify-between border-b border-border pb-4 text-foreground no-underline transition-colors hover:opacity-70">
                <span className="font-mono text-sm">Lasso Select</span>
                <span className="text-sm text-muted-foreground">Freeform multi-element selection</span>
              </Link>
              <Link href="/features#context-capture" className="flex justify-between border-b border-border pb-4 text-foreground no-underline transition-colors hover:opacity-70">
                <span className="font-mono text-sm">Context Capture</span>
                <span className="text-sm text-muted-foreground">Screenshot + DOM analysis</span>
              </Link>
              <Link href="/features#ai-generation" className="flex justify-between border-b border-border pb-4 text-foreground no-underline transition-colors hover:opacity-70">
                <span className="font-mono text-sm">AI Code Generation</span>
                <span className="text-sm text-muted-foreground">Gemini CLI integration</span>
              </Link>
              <Link href="/features#instant-updates" className="flex justify-between pb-4 text-foreground no-underline transition-colors hover:opacity-70">
                <span className="font-mono text-sm">Instant Updates</span>
                <span className="text-sm text-muted-foreground">Zero-friction workflow</span>
              </Link>
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
      <p className="pb-12 text-center text-xs text-muted-foreground">
        Made by Matthew Petersen & Justin Wu
      </p>
    </div>
  )
}
