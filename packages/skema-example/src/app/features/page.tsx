import { Header } from "@/components/docs/header"
import { ThemedLogo } from "@/components/docs/themed-logo"

const demoMoments = [
  {
    id: "draw-from-scratch",
    title: "Draw from Scratch",
    description:
      "Start with a blank canvas and sketch a new UI element directly on top of your app.",
    badge: "Create",
    gifPlaceholder: "GIF_PLACEHOLDER_DRAW",
  },
  {
    id: "lasso-or-select",
    title: "Select with Lasso or Click",
    description:
      "Use lasso for grouped edits or click-select for precision targeting on a single element.",
    badge: "Select",
    gifPlaceholder: "GIF_PLACEHOLDER_SELECT",
  },
  {
    id: "iterative-loop",
    title: "Iterate in a Tight Loop",
    description:
      "Prompt, preview, refine, and repeat until the result matches your intent.",
    badge: "Refine",
    gifPlaceholder: "GIF_PLACEHOLDER_ITERATE",
  },
  {
    id: "gesture-erase",
    title: "Erase with Gestures",
    description:
      "Natural erase gestures remove marks quickly so you can keep momentum while editing.",
    badge: "Edit",
    gifPlaceholder: "GIF_PLACEHOLDER_ERASE",
  },
  {
    id: "undo-change",
    title: "Undo Any Change",
    description:
      "Roll back instantly when you want to test alternatives or recover from a wrong move.",
    badge: "Control",
    gifPlaceholder: "GIF_PLACEHOLDER_UNDO",
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
        <div className="mx-auto max-w-5xl px-6 py-16">
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

          {/* Demo Moments */}
          <section className="mb-20">
            <div className="mb-10 text-center">
              <h2 className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                Product Demos
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground">
                A quick look at the core interactions you can showcase in short clips.
              </p>
            </div>
            <div className="space-y-12">
              {demoMoments.map((feature) => (
                <div id={feature.id} key={feature.title} className="space-y-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="inline-flex items-center rounded-full bg-muted px-3 py-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      {feature.badge}
                    </span>
                    <h3 className="text-lg font-medium">{feature.title}</h3>
                  </div>
                  <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
                    {feature.description}
                  </p>
                  <div className="rounded-2xl border border-border/80 bg-muted/20 p-3">
                    <div className="flex aspect-[16/9] min-h-[260px] w-full items-center justify-center rounded-xl border border-dashed border-border/70 bg-background/80 text-xs uppercase tracking-[0.16em] text-muted-foreground">
                      {feature.gifPlaceholder}
                    </div>
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
