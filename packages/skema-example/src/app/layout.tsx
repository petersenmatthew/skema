import React from "react"
import type { Metadata } from 'next'
import './globals.css'
import { SkemaWrapper } from "@/components/skema-wrapper"

export const metadata: Metadata = {
  title: 'Skema Documentation',
  description: 'A drawing-based website development tool that transforms how you annotate and communicate design changes.',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Clash Display font from Fontshare */}
        <link
          href="https://api.fontshare.com/v2/css?f[]=clash-display@200,300,400,500,600,700&display=swap"
          rel="stylesheet"
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                const theme = localStorage.getItem('theme');
                if (theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                  document.documentElement.classList.add('dark');
                }
              })();
            `,
          }}
        />
      </head>
      <body className="font-clash antialiased" suppressHydrationWarning>
        {children}
        <SkemaWrapper />
      </body>
    </html>
  )
}
