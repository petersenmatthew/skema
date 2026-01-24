'use client';

import dynamic from 'next/dynamic';

// Import Skema dynamically to avoid SSR issues with tldraw
const Skema = dynamic(() => import('skema-core').then((mod) => mod.Skema), {
  ssr: false,
});

export default function Home() {
  return (
    <main>
      {/* Demo page content */}
      <header style={{
        backgroundColor: '#1e293b',
        color: 'white',
        padding: '20px 40px',
      }}>
        <nav style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          maxWidth: '1200px',
          margin: '0 auto',
        }}>
          <div style={{ fontSize: '24px', fontWeight: 'bold' }}>
            Skema Demo
          </div>
          <div style={{ display: 'flex', gap: '24px' }}>
            <a href="#features" style={{ color: 'white' }}>Features</a>
            <a href="#about" style={{ color: 'white' }}>About</a>
            <a href="#contact" style={{ color: 'white' }}>Contact</a>
          </div>
        </nav>
      </header>

      {/* Hero Section */}
      <section style={{
        padding: '80px 40px',
        textAlign: 'center',
        background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
        color: 'white',
      }}>
        <h1 style={{ fontSize: '48px', marginBottom: '20px' }}>
          Welcome to Skema
        </h1>
        <p style={{ fontSize: '20px', marginBottom: '32px', maxWidth: '600px', margin: '0 auto 32px' }}>
          A drawing-based website development tool that transforms how you annotate and communicate design changes.
        </p>
        <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
          <button style={{
            padding: '14px 28px',
            fontSize: '16px',
            backgroundColor: 'white',
            color: '#3b82f6',
            border: 'none',
            borderRadius: '8px',
            fontWeight: '600',
          }}>
            Get Started
          </button>
          <button style={{
            padding: '14px 28px',
            fontSize: '16px',
            backgroundColor: 'transparent',
            color: 'white',
            border: '2px solid white',
            borderRadius: '8px',
            fontWeight: '600',
          }}>
            Learn More
          </button>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" style={{
        padding: '80px 40px',
        maxWidth: '1200px',
        margin: '0 auto',
      }}>
        <h2 style={{ fontSize: '36px', textAlign: 'center', marginBottom: '48px' }}>
          Features
        </h2>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '32px',
        }}>
          <div style={{
            padding: '32px',
            borderRadius: '12px',
            backgroundColor: '#f8fafc',
            border: '1px solid #e2e8f0',
          }}>
            <div style={{ fontSize: '32px', marginBottom: '16px' }}>🎨</div>
            <h3 style={{ fontSize: '20px', marginBottom: '12px' }}>Draw Anywhere</h3>
            <p style={{ color: '#64748b' }}>
              Use tldraw-powered tools to draw directly on your website. Circle elements, draw arrows, add annotations.
            </p>
          </div>
          <div style={{
            padding: '32px',
            borderRadius: '12px',
            backgroundColor: '#f8fafc',
            border: '1px solid #e2e8f0',
          }}>
            <div style={{ fontSize: '32px', marginBottom: '16px' }}>🎯</div>
            <h3 style={{ fontSize: '20px', marginBottom: '12px' }}>DOM Picker</h3>
            <p style={{ color: '#64748b' }}>
              Select any element on the page. Skema captures the selector, bounding box, and context automatically.
            </p>
          </div>
          <div style={{
            padding: '32px',
            borderRadius: '12px',
            backgroundColor: '#f8fafc',
            border: '1px solid #e2e8f0',
          }}>
            <div style={{ fontSize: '32px', marginBottom: '16px' }}>📤</div>
            <h3 style={{ fontSize: '20px', marginBottom: '12px' }}>Export to Agents</h3>
            <p style={{ color: '#64748b' }}>
              Export annotations in a structured JSON format optimized for AI coding agents like Claude.
            </p>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" style={{
        padding: '80px 40px',
        backgroundColor: '#f1f5f9',
      }}>
        <div style={{ maxWidth: '800px', margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ fontSize: '36px', marginBottom: '24px' }}>About Skema</h2>
          <p style={{ fontSize: '18px', color: '#475569', marginBottom: '16px' }}>
            Skema is built for developers who want to communicate visual changes quickly and precisely. 
            Instead of taking screenshots and annotating them in external tools, Skema lets you draw 
            directly on your live website.
          </p>
          <p style={{ fontSize: '18px', color: '#475569' }}>
            All annotations are captured with DOM context, making it easy for AI agents or team 
            members to understand exactly what you mean.
          </p>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" style={{
        padding: '80px 40px',
        maxWidth: '600px',
        margin: '0 auto',
      }}>
        <h2 style={{ fontSize: '36px', textAlign: 'center', marginBottom: '32px' }}>
          Contact Us
        </h2>
        <form style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
              Name
            </label>
            <input
              type="text"
              placeholder="Your name"
              style={{
                width: '100%',
                padding: '12px 16px',
                borderRadius: '8px',
                border: '1px solid #d1d5db',
                fontSize: '16px',
              }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
              Email
            </label>
            <input
              type="email"
              placeholder="your@email.com"
              style={{
                width: '100%',
                padding: '12px 16px',
                borderRadius: '8px',
                border: '1px solid #d1d5db',
                fontSize: '16px',
              }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
              Message
            </label>
            <textarea
              rows={4}
              placeholder="Your message..."
              style={{
                width: '100%',
                padding: '12px 16px',
                borderRadius: '8px',
                border: '1px solid #d1d5db',
                fontSize: '16px',
                resize: 'vertical',
              }}
            />
          </div>
          <button
            type="submit"
            style={{
              padding: '14px 28px',
              fontSize: '16px',
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontWeight: '600',
            }}
          >
            Send Message
          </button>
        </form>
      </section>

      {/* Footer */}
      <footer style={{
        padding: '40px',
        backgroundColor: '#1e293b',
        color: '#94a3b8',
        textAlign: 'center',
      }}>
        <p>© 2024 Skema. Built with Next.js and tldraw.</p>
        <p style={{ marginTop: '8px', fontSize: '14px' }}>
          Press <kbd style={{
            backgroundColor: '#334155',
            padding: '2px 8px',
            borderRadius: '4px',
            margin: '0 4px',
          }}>⌘⇧E</kbd> to toggle Skema overlay
        </p>
      </footer>

      {/* Skema Overlay - only renders in development */}
      {process.env.NODE_ENV === 'development' && <Skema />}
    </main>
  );
}
