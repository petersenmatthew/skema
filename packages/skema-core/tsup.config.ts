import { defineConfig } from 'tsup';

export default defineConfig([
  // Client-side React components
  {
    entry: { index: 'src/index.ts' },
    format: ['cjs', 'esm'],
    dts: true,
    splitting: false,
    sourcemap: true,
    clean: true,
    external: ['react', 'react-dom'],
    treeshake: true,
    minify: false,
  },
  // Server-side utilities (Node.js only)
  {
    entry: { server: 'src/server/index.ts' },
    format: ['cjs', 'esm'],
    dts: true,
    splitting: false,
    sourcemap: true,
    clean: false,
    platform: 'node',
    treeshake: true,
    minify: false,
  },
  // CLI tool
  {
    entry: { cli: 'src/cli/init.ts' },
    format: ['cjs'],
    dts: false,
    splitting: false,
    sourcemap: false,
    clean: false,
    platform: 'node',
    banner: {
      js: '#!/usr/bin/env node',
    },
    treeshake: true,
    minify: false,
  },
]);
