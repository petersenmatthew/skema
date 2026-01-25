import { Header } from "@/components/docs/header"
import { CodeBlock } from "@/components/docs/code-block"
import { Kbd } from "@/components/docs/kbd"

export default function FeaturesPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <main className="pb-24">
        <div className="mx-auto max-w-2xl px-6 py-16">
          {/* Title */}
          <section className="mb-16">
            <h1 className="text-4xl font-bold tracking-tight">Features</h1>
            <p className="mt-4 text-muted-foreground">
              Core capabilities and API reference.
            </p>
          </section>

          {/* Features */}
          <section className="mb-20">
            <h2 className="mb-8 text-xs font-medium uppercase tracking-widest text-muted-foreground">Core Tools</h2>

            <div className="space-y-12">
              <div>
                <h3 className="mb-3 text-lg font-medium">Drawing Overlay</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Full tldraw canvas as a transparent overlay. Pencil, lines, arrows, rectangles, ellipses, text, and eraser tools.
                </p>
              </div>

              <div>
                <h3 className="mb-3 text-lg font-medium">DOM Picker</h3>
                <p className="mb-4 text-sm leading-relaxed text-muted-foreground">
                  Click on any element to capture its CSS selector, tag name, path, text content, bounding box, and attributes.
                </p>
                <div className="rounded-lg border border-border bg-muted/20 p-4">
                  <ol className="list-inside list-decimal space-y-1 text-sm text-muted-foreground">
                    <li>Press <Kbd keys={["P"]} /> to activate</li>
                    <li>Hover to highlight elements</li>
                    <li>Click to capture</li>
                  </ol>
                </div>
              </div>

              <div>
                <h3 className="mb-3 text-lg font-medium">Lasso Select</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Draw a freeform selection to capture multiple elements at once. Double-click to select individually.
                </p>
              </div>
            </div>
          </section>

          {/* API Reference */}
          <section className="mb-20">
            <h2 className="mb-8 text-xs font-medium uppercase tracking-widest text-muted-foreground">API Reference</h2>

            <div className="mb-8">
              <h3 className="mb-4 text-lg font-medium">Props</h3>
              <div className="space-y-3 text-sm">
                <div className="flex items-start justify-between gap-4 border-b border-border pb-3">
                  <div>
                    <code className="font-mono">enabled</code>
                    <span className="ml-2 text-muted-foreground">boolean</span>
                  </div>
                  <span className="text-muted-foreground">true</span>
                </div>
                <div className="flex items-start justify-between gap-4 border-b border-border pb-3">
                  <div>
                    <code className="font-mono">onAnnotationsChange</code>
                    <span className="ml-2 text-muted-foreground">function</span>
                  </div>
                  <span className="text-muted-foreground">-</span>
                </div>
                <div className="flex items-start justify-between gap-4 border-b border-border pb-3">
                  <div>
                    <code className="font-mono">onAnnotationSubmit</code>
                    <span className="ml-2 text-muted-foreground">function</span>
                  </div>
                  <span className="text-muted-foreground">-</span>
                </div>
                <div className="flex items-start justify-between gap-4 border-b border-border pb-3">
                  <div>
                    <code className="font-mono">toggleShortcut</code>
                    <span className="ml-2 text-muted-foreground">string</span>
                  </div>
                  <span className="font-mono text-muted-foreground">'mod+shift+e'</span>
                </div>
                <div className="flex items-start justify-between gap-4 pb-3">
                  <div>
                    <code className="font-mono">zIndex</code>
                    <span className="ml-2 text-muted-foreground">number</span>
                  </div>
                  <span className="font-mono text-muted-foreground">99999</span>
                </div>
              </div>
            </div>
          </section>

          {/* Types */}
          <section className="mb-20">
            <h2 className="mb-6 text-xs font-medium uppercase tracking-widest text-muted-foreground">Types</h2>
            <CodeBlock
              language="typescript"
              code={`interface DOMSelection {
  id: string;
  selector: string;
  tagName: string;
  elementPath: string;
  text: string;
  boundingBox: BoundingBox;
  timestamp: number;
  pathname: string;
  cssClasses?: string;
  attributes?: Record<string, string>;
  comment?: string;
}`}
            />
          </section>

          {/* AI Integration */}
          <section>
            <h2 className="mb-6 text-xs font-medium uppercase tracking-widest text-muted-foreground">AI Integration</h2>
            <p className="mb-6 text-sm leading-relaxed text-muted-foreground">
              Connect Skema with AI coding agents for real-time design feedback.
            </p>
            <CodeBlock
              language="tsx"
              code={`const handleAnnotationSubmit = async (
  annotation: Annotation,
  comment: string
) => {
  await fetch('/api/ai-agent', {
    method: 'POST',
    body: JSON.stringify({ annotation, comment }),
  });
};

<Skema onAnnotationSubmit={handleAnnotationSubmit} />`}
            />
          </section>
        </div>
      </main>
    </div>
  )
}
