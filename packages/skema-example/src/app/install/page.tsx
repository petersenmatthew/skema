import { Header } from "@/components/docs/header"
import { CodeBlock } from "@/components/docs/code-block"
import { Kbd } from "@/components/docs/kbd"

export default function InstallPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <main className="pb-24">
        <div className="mx-auto max-w-2xl px-6 py-16">
          {/* Title */}
          <section className="mb-16">
            <h1 className="text-4xl font-bold tracking-tight">Installation</h1>
            <p className="mt-4 text-muted-foreground">
              Get up and running with Skema in minutes.
            </p>
          </section>

          {/* Step 1: Package Install */}
          <section className="mb-16">
            <h2 className="mb-6 text-xs font-medium uppercase tracking-widest text-muted-foreground">1. Install Package</h2>
            <CodeBlock
              language="bash"
              code={`bun add skema-core
# or: npm install skema-core`}
            />
            <p className="mt-4 text-sm text-muted-foreground">
              Requires <strong className="text-foreground">React 19+</strong> and <strong className="text-foreground">Next.js App Router</strong>
            </p>
          </section>

          {/* Step 2: Create API Route */}
          <section className="mb-16">
            <h2 className="mb-6 text-xs font-medium uppercase tracking-widest text-muted-foreground">2. Create API Route</h2>
            <CodeBlock
              language="bash"
              code={`bunx skema init
# or: npx skema init`}
            />
            <p className="mt-4 text-sm text-muted-foreground">
              Creates <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">app/api/gemini/route.ts</code> to handle annotations.
            </p>
          </section>

          {/* Step 3: Add API Key */}
          <section className="mb-16">
            <h2 className="mb-6 text-xs font-medium uppercase tracking-widest text-muted-foreground">3. Add Gemini API Key</h2>
            <CodeBlock
              language="bash"
              code={`# .env
GEMINI_API_KEY=your_api_key_here`}
            />
            <p className="mt-4 text-sm text-muted-foreground">
              Get your key at{" "}
              <a
                href="https://aistudio.google.com/apikey"
                target="_blank"
                rel="noopener noreferrer"
                className="text-foreground underline underline-offset-2 hover:text-primary"
              >
                aistudio.google.com/apikey
              </a>
            </p>
          </section>

          {/* Step 4: Add Component */}
          <section className="mb-16">
            <h2 className="mb-6 text-xs font-medium uppercase tracking-widest text-muted-foreground">4. Add to Your App</h2>
            <CodeBlock
              language="tsx"
              code={`import { Skema } from 'skema-core';

export default function Page() {
  return (
    <>
      <main>{/* Your content */}</main>
      {process.env.NODE_ENV === 'development' && <Skema />}
    </>
  );
}`}
            />
          </section>

          {/* Keyboard Shortcuts */}
          <section>
            <h2 className="mb-6 text-xs font-medium uppercase tracking-widest text-muted-foreground">Keyboard Shortcuts</h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Toggle overlay</span>
                <Kbd keys={["Cmd", "Shift", "E"]} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">DOM Picker</span>
                <Kbd keys={["P"]} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Lasso Select</span>
                <Kbd keys={["S"]} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Draw tool</span>
                <Kbd keys={["D"]} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Cancel</span>
                <Kbd keys={["Esc"]} />
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}
