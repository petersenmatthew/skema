import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

const ROUTE_CONTENT = `export { POST, DELETE } from 'skema-core/server';
`;

function init() {
  const cwd = process.cwd();

  // Detect if this is a Next.js App Router project
  const appDir = existsSync(join(cwd, 'app')) ? join(cwd, 'app') :
    existsSync(join(cwd, 'src/app')) ? join(cwd, 'src/app') : null;

  if (!appDir) {
    console.error(' Could not find app/ or src/app/ directory.');
    console.error('   Make sure you run this from a Next.js App Router project root.');
    process.exit(1);
  }

  const apiDir = join(appDir, 'api', 'gemini');
  const routePath = join(apiDir, 'route.ts');

  // Check if route already exists
  if (existsSync(routePath)) {
    console.log('[OK] API route already exists at', routePath.replace(cwd, '.'));
    return;
  }

  // Create directories if needed
  if (!existsSync(apiDir)) {
    mkdirSync(apiDir, { recursive: true });
    console.log('[OK] Created', apiDir.replace(cwd, '.'));
  }

  // Write the route file
  writeFileSync(routePath, ROUTE_CONTENT);
  console.log('[OK] Created', routePath.replace(cwd, '.'));
  console.log('');
  console.log('[Done] Skema is ready! The Gemini CLI integration is now set up.');
  console.log('');
  console.log('Usage:');
  console.log('  1. Add <Skema /> to your page');
  console.log('  2. Press Cmd+Shift+E to toggle the overlay');
  console.log('  3. Annotate elements and Gemini CLI will make the changes');
}

init();
