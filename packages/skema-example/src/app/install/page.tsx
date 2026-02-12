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
              Requires <strong className="text-foreground">React 19+</strong>. Works with Next.js, Vite, Remix, and Create React App.
            </p>
          </section>

          {/* Step 2: Configure Project */}
          <section className="mb-16">
            <h2 className="mb-6 text-xs font-medium uppercase tracking-widest text-muted-foreground">2. Configure Project</h2>
            <CodeBlock
              language="bash"
              code={`bunx skema-core init
# or: npx skema-core init`}
            />
            <p className="mt-4 text-sm text-muted-foreground">
              Detects your framework and configures it automatically — disables{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">React.StrictMode</code> for tldraw compatibility
              and adds <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">transpilePackages</code> for Next.js.
            </p>
          </section>

          {/* Step 3: Add Component */}
          <section className="mb-16">
            <h2 className="mb-6 text-xs font-medium uppercase tracking-widest text-muted-foreground">3. Add to Your App</h2>
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

          {/* Step 4: Start the Daemon */}
          <section className="mb-16">
            <h2 className="mb-6 text-xs font-medium uppercase tracking-widest text-muted-foreground">4. Start the Daemon</h2>
            <CodeBlock
              language="bash"
              code={`bunx skema-core
# or: npx skema-core`}
            />
            <p className="mt-4 text-sm text-muted-foreground">
              Run this in a separate terminal. Starts a WebSocket server on{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">ws://localhost:9999</code> that
              connects to your AI provider. Requires{" "}
              <a
                href="https://github.com/google-gemini/gemini-cli"
                target="_blank"
                rel="noopener noreferrer"
                className="text-foreground underline underline-offset-2 hover:text-primary"
              >
                Gemini CLI
              </a>
              {" "}or{" "}
              <a
                href="https://docs.anthropic.com/en/docs/claude-code"
                target="_blank"
                rel="noopener noreferrer"
                className="text-foreground underline underline-offset-2 hover:text-primary"
              >
                Claude Code
              </a>
              {" "}installed globally.
            </p>
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
                <span className="text-sm text-muted-foreground">Select Tool</span>
                <Kbd keys={["S"]} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Draw Tool</span>
                <Kbd keys={["D"]} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Lasso Select</span>
                <Kbd keys={["L"]} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Eraser</span>
                <Kbd keys={["E"]} />
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
