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

          {/* Package Install */}
          <section className="mb-16">
            <h2 className="mb-6 text-xs font-medium uppercase tracking-widest text-muted-foreground">Package</h2>
            <CodeBlock
              language="bash"
              code={`# Using bun (recommended)
bun add skema-core

# Using npm
npm install skema-core`}
            />
            <div className="mt-6 space-y-2 text-sm text-muted-foreground">
              <p>Requires <strong className="text-foreground">React 19+</strong> and <strong className="text-foreground">Node.js 18+</strong></p>
            </div>
          </section>

          {/* Quick Start */}
          <section className="mb-16">
            <h2 className="mb-6 text-xs font-medium uppercase tracking-widest text-muted-foreground">Basic Usage</h2>
            <CodeBlock
              language="tsx"
              code={`import { Skema } from 'skema-core';

export default function App() {
  return (
    <>
      <YourApp />
      {process.env.NODE_ENV === 'development' && <Skema />}
    </>
  );
}`}
            />
          </section>

          {/* Next.js */}
          <section className="mb-16">
            <h2 className="mb-6 text-xs font-medium uppercase tracking-widest text-muted-foreground">Next.js App Router</h2>
            <CodeBlock
              language="tsx"
              code={`// app/layout.tsx
import { Skema } from 'skema-core';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        {children}
        {process.env.NODE_ENV === 'development' && <Skema />}
      </body>
    </html>
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
