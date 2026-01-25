import { Header } from "@/components/docs/header"
import { ThemedLogo } from "@/components/docs/themed-logo"

const features = [
  {
    id: "drawing-overlay",
    symbol: "◎",
    title: "Drawing Overlay",
    description:
      "Scribble, circle, arrow, or highlight anything on your live localhost. No more describing layout issues, just point at what needs fixing.",
    highlight: "Full tldraw canvas overlay",
  },
  {
    id: "lasso-select",
    symbol: "⌘",
    title: "Lasso Select",
    description:
      "Click any element to capture it, or draw a freeform lasso to select multiple at once. We automatically extract CSS selectors, tag names, and bounding boxes.",
    highlight: "Multi-element selection",
  },
  {
    id: "context-capture",
    symbol: "▣",
    title: "Context Capture",
    description:
      "Every annotation captures a screenshot of your drawing plus all relevant DOM context. AI sees exactly what you see, including nearby styles and CSS classes.",
    highlight: "Screenshot + DOM analysis",
  },
  {
    id: "ai-generation",
    symbol: "◆",
    title: "AI Code Generation",
    description:
      "Type what you want, hit submit, and watch Gemini generate the exact code changes. It understands your drawing, your selected elements, and your project's style patterns.",
    highlight: "Gemini CLI integration",
  },
  {
    id: "instant-updates",
    symbol: "↯",
    title: "Instant Updates",
    description:
      "Generated code gets written directly to your source files. No copy-pasting, no switching windows. Your hot-reloading dev server shows changes immediately.",
    highlight: "Zero-friction workflow",
  },
]

const workflow = [
  {
    step: "01",
    title: "Activate Overlay",
    description: "Press ⌘+Shift+E to toggle Skema on top of your localhost.",
  },
  {
    step: "02",
    title: "Draw or Select",
    description: "Circle a button, arrow to where it should move, or lasso multiple elements.",
  },
  {
    step: "03",
    title: "Describe the Change",
    description: "Type what you want: \"make this button bigger\" or \"add a hover effect\".",
  },
  {
    step: "04",
    title: "Generate & Apply",
    description: "AI generates the code, writes it to your files, and commits to git.",
  },
]

export default function FeaturesPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <main className="pb-24">
        <div className="mx-auto max-w-3xl px-6 py-16">
          {/* Hero */}
          <section className="mb-20 text-center">
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
              Turn Drawings into Code
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
              <ThemedLogo className="inline-block h-5 w-auto align-middle" /> bridges the gap between visual design and code.
              Draw on your UI, describe what you want, and let AI do the rest.
            </p>
          </section>

          {/* Workflow */}
          <section className="mb-24">
            <h2 className="mb-10 text-center text-xs font-medium uppercase tracking-widest text-muted-foreground">
              How it Works
            </h2>
            <div className="grid gap-6 sm:grid-cols-2">
              {workflow.map((item) => (
                <div
                  key={item.step}
                  className="group relative rounded-xl border border-border bg-muted/20 p-6 transition-all hover:border-foreground/20 hover:bg-muted/40"
                >
                  <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-foreground text-sm font-bold text-background">
                    {item.step}
                  </div>
                  <h3 className="mb-2 text-lg font-medium">{item.title}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {item.description}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* Features Grid */}
          <section className="mb-20">
            <h2 className="mb-10 text-center text-xs font-medium uppercase tracking-widest text-muted-foreground">
              Core Features
            </h2>
            <div className="space-y-8">
              {features.map((feature, index) => (
                <div
                  id={feature.id}
                  key={feature.title}
                  className={`flex gap-6 ${index % 2 === 1 ? "flex-row-reverse" : ""
                    }`}
                >
                  <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl border border-border bg-muted/30 text-xl font-medium">
                    {feature.symbol}
                  </div>
                  <div className="flex-1">
                    <h3 className="mb-2 text-lg font-medium">{feature.title}</h3>
                    <p className="mb-3 text-sm leading-relaxed text-muted-foreground">
                      {feature.description}
                    </p>
                    <span className="inline-flex items-center rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
                      {feature.highlight}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Bottom CTA */}
          <section className="rounded-2xl border border-border bg-gradient-to-br from-muted/30 to-muted/10 p-8 text-center">
            <h2 className="mb-3 text-2xl font-bold">Ready to draw your code?</h2>
            <p className="mb-6 text-muted-foreground">
              Install Skema in under a minute and start annotating.
            </p>
            <a
              href="/install"
              className="inline-flex h-11 items-center justify-center rounded-lg bg-foreground px-6 text-sm font-medium text-background transition-colors hover:bg-foreground/90"
            >
              Get Started →
            </a>
          </section>
        </div>
      </main>
    </div>
  )
}
