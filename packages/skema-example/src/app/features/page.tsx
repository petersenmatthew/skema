import { Header } from "@/components/docs/header"
import { ThemedLogo } from "@/components/docs/themed-logo"

// TEMP: Product Demos section commented out until real demo videos are recorded.
// Re-enable by uncommenting this array AND the matching <section> block below.
// const demoMoments = [
//   {
//     id: "draw-from-scratch",
//     title: "Draw from Scratch",
//     description:
//       "Start with a blank canvas and sketch a new UI element directly on top of your app.",
//     badge: "Create",
//     gifPlaceholder: "GIF_PLACEHOLDER_DRAW",
//   },
//   {
//     id: "lasso-or-select",
//     title: "Select with Lasso or Click",
//     description:
//       "Use lasso for grouped edits or click-select for precision targeting on a single element.",
//     badge: "Select",
//     gifPlaceholder: "GIF_PLACEHOLDER_SELECT",
//   },
//   {
//     id: "iterative-loop",
//     title: "Iterate in a Tight Loop",
//     description:
//       "Prompt, preview, refine, and repeat until the result matches your intent.",
//     badge: "Refine",
//     gifPlaceholder: "GIF_PLACEHOLDER_ITERATE",
//   },
//   {
//     id: "gesture-erase",
//     title: "Erase with Gestures",
//     description:
//       "Natural erase gestures remove marks quickly so you can keep momentum while editing.",
//     badge: "Edit",
//     gifPlaceholder: "GIF_PLACEHOLDER_ERASE",
//   },
//   {
//     id: "undo-change",
//     title: "Undo Any Change",
//     description:
//       "Roll back instantly when you want to test alternatives or recover from a wrong move.",
//     badge: "Control",
//     gifPlaceholder: "GIF_PLACEHOLDER_UNDO",
//   },
// ]

type WorkflowShape = "square" | "triangle" | "parallelogram" | "circle"

const workflow: Array<{
  step: string
  shape: WorkflowShape
  title: string
  description: string
}> = [
  {
    step: "1",
    shape: "square",
    title: "Activate Overlay",
    description: "Press ⌘+Shift+E to toggle Skema on top of your localhost.",
  },
  {
    step: "2",
    shape: "triangle",
    title: "Draw or Select",
    description: "Circle a button, arrow to where it should move, or lasso multiple elements.",
  },
  {
    step: "3",
    shape: "parallelogram",
    title: "Describe the Change",
    description: "Type what you want: \"make this button bigger\" or \"add a hover effect\".",
  },
  {
    step: "4",
    shape: "circle",
    title: "Generate & Apply",
    description: "AI generates the code, writes it to your files, and commits to git.",
  },
]

// Shape colors and SVG paths are copied verbatim from the Skema toolbar icons
// in packages/skema-core/src/components/toolbar/ToolbarIcons.tsx (SelectIcon,
// DrawIcon, LassoIcon, EraseIcon) so these workflow badges look identical to
// the buttons in the in-product toolbar. The inner tool graphics are omitted —
// the step number is layered on top of the colored shape instead.
//
// Per the toolbar, the eraser/parallelogram is rendered slightly wider than
// the other three (30x25 viewBox vs 25x25), matching width="36" vs width="30"
// in SkemaToolbar.
function WorkflowStepShape({ shape, label }: { shape: WorkflowShape; label: string }) {
  const HEIGHT = 44
  // Parallelogram preserves its 30:25 aspect ratio; the other three are square.
  const width = shape === "parallelogram" ? Math.round(HEIGHT * (30 / 25)) : HEIGHT

  // Vertical fraction of the viewBox where each shape is visually centered.
  // Square/circle/parallelogram all sit at 50%; the triangle's centroid is
  // 1/3 from the base, so its label needs to shift down to ~67%.
  const labelCenterY: Record<WorkflowShape, number> = {
    square: 0.5,
    triangle: 16.67 / 25, // (3 + 24 + 24) / 3 / 25
    parallelogram: 0.5,
    circle: 0.5,
  }
  const labelOffsetY = (labelCenterY[shape] - 0.5) * HEIGHT

  return (
    <div
      className="relative mb-4 inline-flex items-center justify-center"
      style={{ width, height: HEIGHT }}
    >
      {shape === "square" && (
        <svg
          width={width}
          height={HEIGHT}
          viewBox="0 0 25 25"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <rect width="25" height="25" rx="2" fill="#00C851" />
        </svg>
      )}
      {shape === "triangle" && (
        <svg
          width={width}
          height={HEIGHT}
          viewBox="0 0 25 25"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <path
            d="M11.268 3C12.0378 1.6667 13.9623 1.6667 14.7321 3L25.1244 21C25.8942 22.3333 24.9319 24 23.3923 24H2.6077C1.0681 24 0.1058 22.3333 0.8756 21L11.268 3Z"
            fill="#F24E1E"
          />
        </svg>
      )}
      {shape === "parallelogram" && (
        <svg
          width={width}
          height={HEIGHT}
          viewBox="0 0 30 25"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <path
            d="M0.308 1.2407C0.151 0.61 0.628 0 1.278 0H23.664C24.118 0 24.516 0.3065 24.631 0.746L30.671 23.746C30.837 24.38 30.359 25 29.704 25H6.982C6.523 25 6.122 24.6868 6.012 24.2407L0.308 1.2407Z"
            fill="#FFBA00"
          />
        </svg>
      )}
      {shape === "circle" && (
        <svg
          width={width}
          height={HEIGHT}
          viewBox="0 0 25 25"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <circle cx="12.5" cy="12.5" r="12.5" fill="#2C7FFF" />
        </svg>
      )}
      <span
        className="absolute text-[18px] font-bold leading-none text-white"
        style={{
          left: "50%",
          top: "50%",
          transform: `translate(-50%, calc(-50% + ${labelOffsetY}px))`,
        }}
      >
        {label}
      </span>
    </div>
  )
}

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
                  <WorkflowStepShape shape={item.shape} label={item.step} />
                  <h3 className="mb-2 text-lg font-medium">{item.title}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {item.description}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* TEMP: Product Demos section hidden until real demo videos are
              recorded. Re-enable by uncommenting this block AND the
              `demoMoments` array at the top of this file. */}
          {/*
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
          */}

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
