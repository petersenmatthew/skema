import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Skema Example',
  description: 'Drawing-based website development tool demo',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
