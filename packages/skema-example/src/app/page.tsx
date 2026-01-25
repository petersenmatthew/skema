'use client';

import dynamic from 'next/dynamic';
import { useCallback } from 'react';
import type { Annotation } from 'skema-core';

// Import Skema dynamically to avoid SSR issues with tldraw
const Skema = dynamic(() => import('skema-core').then((mod) => mod.Skema), {
  ssr: false,
});

export default function Home() {
  const handleAnnotationSubmit = useCallback(async (annotation: Annotation, comment: string) => {
    console.log('[Skema] Annotation submitted:', { annotation, comment });

    try {
      const response = await fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          annotation: { ...annotation, comment },
          projectContext: {
            pathname: window.location.pathname,
            viewport: {
              width: window.innerWidth,
              height: window.innerHeight,
            },
          },
        }),
      });

      if (!response.body) {
        throw new Error('No response body');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const event = JSON.parse(line.slice(6));
              console.log('[Gemini CLI]', event.type, event);
            } catch {
              // Ignore parse errors
            }
          }
        }
      }
    } catch (error) {
      console.error('[Gemini CLI] Request failed:', error);
    }
  }, []);

  const handleAnnotationDelete = useCallback(async (annotationId: string) => {
    console.log('[Skema] Annotation deleted, reverting changes:', annotationId);

    try {
      const response = await fetch('/api/gemini', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ annotationId }),
      });

      const result = await response.json();
      console.log('[Skema] Revert result:', result);

      // Reload the page to see reverted changes (Next.js doesn't detect external file changes)
      if (result.success && result.message !== 'No changes to revert') {
        window.location.reload();
      }
    } catch (error) {
      console.error('[Skema] Revert failed:', error);
    }
  }, []);

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
            <a href="#features" style={{ color: 'white' }}><span style={{
                background: 'linear-gradient(to right, #FF0000, #FF7F7F)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}>Features</span></a>
            <a href="#about" style={{ color: 'white' }}>About</a>
            <a href="#contact" style={{ color: 'white' }}>Contact</a>
          </div>
        </nav>
      </header>

      {/* Hero Section */}
      <section style={{
        padding: '96px 40px',
        textAlign: 'left',
        backgroundColor: '#ffffff',
        color: '#000000',
      }}>
        <h1 style={{
          fontSize: '60px',
          marginBottom: '20px',
          fontWeight: 'bold',
          background: 'linear-gradient(to right, #4CAF50, #8BC34A)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }}>
          Welcome to Skema
        </h1>
        <p style={{ fontSize: '20px', marginBottom: '32px', maxWidth: '600px', color: '#666666' }}>
          A drawing-based website development tool that transforms how you annotate and communicate design changes.
        </p>
        <div style={{ display: 'flex', gap: '16px', justifyContent: 'left' }}>
          <button className="btn btn-primary">
            Get Started
          </button>
          <button className="btn btn-secondary">
            
          </button>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" style={{
        padding: '80px 40px',
        maxWidth: '1200px',
        margin: '0 auto',
      }}>
        <h2 style={{
          fontSize: '48px',
          textAlign: 'center',
          marginBottom: '48px',
          background: 'linear-gradient(45deg, #FF6B6B, #5F27CD)',
          WebkitBackgroundClip: 'text',
          backgroundClip: 'text',
          color: 'transparent',
        }}>
                        <span style={{
                          background: 'linear-gradient(to right, #6366F1, #3B82F6)',
                          WebkitBackgroundClip: 'text',
                          WebkitTextFillColor: 'transparent',
                        }}>Features</span>        </h2>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '32px',
        }}>
          <div style={{
            padding: '32px',
            borderRadius: '12px',
            background: '#f3f4f6',
            border: '1px solid #e2e8f0',
          }}>
            <h3 style={{ fontSize: '20px', marginBottom: '12px', color: '#334155' }}>✏️ Draw Anywhere</h3>
            <p style={{ color: '#475569' }}>
              Use tldraw-powered tools to draw directly on your website. Circle elements, draw arrows, add annotations.
            </p>
          </div>
          <div style={{
            padding: '32px',
            borderRadius: '12px',
            background: '#f3f4f6',
            border: '1px solid #e2e8f0',
          }}>
            <div style={{ fontSize: '32px', marginBottom: '16px', color: '#334155' }}>🎯</div>
            <h3 style={{ fontSize: '20px', marginBottom: '12px', color: '#334155' }}>DOM Picker</h3>
            <p style={{ color: '#475569' }}>
              Select any element on the page. Skema captures the selector, bounding box, and context automatically.
            </p>
          </div>
          <div style={{
            padding: '32px',
            borderRadius: '12px',
            background: '#f3f4f6',
            border: '1px solid #e2e8f0',
          }}>
            <div style={{ fontSize: '32px', marginBottom: '16px', color: '#334155' }}>🩹</div>
            <h3 style={{ fontSize: '20px', marginBottom: '12px', color: '#334155' }}>Export to Agents</h3>
            <p style={{ color: '#475569' }}>
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
      {process.env.NODE_ENV === 'development' && (
        <Skema onAnnotationSubmit={handleAnnotationSubmit} onAnnotationDelete={handleAnnotationDelete} />
      )}
    </main>
  );
}
