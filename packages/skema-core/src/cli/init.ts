import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

// =============================================================================
// Framework Detection
// =============================================================================

type Framework = 'nextjs' | 'vite' | 'cra' | 'remix' | 'unknown';

function detectFramework(cwd: string): Framework {
  const packageJsonPath = join(cwd, 'package.json');
  if (!existsSync(packageJsonPath)) return 'unknown';

  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
  const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };

  if (deps['next']) return 'nextjs';
  if (deps['vite']) return 'vite';
  if (deps['react-scripts']) return 'cra';
  if (deps['@remix-run/react']) return 'remix';

  return 'unknown';
}

// =============================================================================
// Next.js Setup
// =============================================================================

function setupNextjs(cwd: string): boolean {
  const configFiles = ['next.config.js', 'next.config.mjs', 'next.config.ts'];
  let configPath: string | null = null;

  for (const file of configFiles) {
    if (existsSync(join(cwd, file))) {
      configPath = join(cwd, file);
      break;
    }
  }

  if (configPath) {
    let content = readFileSync(configPath, 'utf-8');
    let modified = false;

    if (!content.includes('reactStrictMode')) {
      content = content.replace(
        /(const\s+\w+\s*=\s*\{)/,
        '$1\n  reactStrictMode: false, // Required for tldraw'
      );
      modified = true;
    } else if (content.includes('reactStrictMode: true')) {
      content = content.replace(
        'reactStrictMode: true',
        'reactStrictMode: false // Required for tldraw'
      );
      modified = true;
    }

    if (!content.includes('transpilePackages')) {
      content = content.replace(
        /(const\s+\w+\s*=\s*\{)/,
        "$1\n  transpilePackages: ['skema-core'],"
      );
      modified = true;
    } else if (!content.includes("'skema-core'") && !content.includes('"skema-core"')) {
      content = content.replace(
        /transpilePackages:\s*\[/,
        "transpilePackages: ['skema-core', "
      );
      modified = true;
    }

    if (modified) {
      writeFileSync(configPath, content);
      console.log(`  ✓ Updated ${configPath.replace(cwd, '.')}`);
      return true;
    } else {
      console.log(`  ✓ ${configPath.replace(cwd, '.')} already configured`);
      return false;
    }
  } else {
    writeFileSync(
      join(cwd, 'next.config.js'),
      `/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false, // Required for tldraw
  transpilePackages: ['skema-core'],
};

module.exports = nextConfig;
`
    );
    console.log('  ✓ Created next.config.js');
    return true;
  }
}

// =============================================================================
// Vite/CRA Setup - Handle StrictMode in entry file
// =============================================================================

function removeStrictModeWrapper(cwd: string): boolean {
  // Common entry file locations
  const entryFiles = [
    'src/main.tsx',
    'src/main.jsx',
    'src/index.tsx',
    'src/index.jsx',
  ];

  for (const file of entryFiles) {
    const filePath = join(cwd, file);
    if (!existsSync(filePath)) continue;

    let content = readFileSync(filePath, 'utf-8');

    // Check if StrictMode is used
    if (!content.includes('StrictMode')) {
      console.log(`  ✓ No StrictMode wrapper found in ${file}`);
      return false;
    }

    // Remove StrictMode wrapper - handle various patterns
    const patterns = [
      // <React.StrictMode>...</React.StrictMode>
      /<React\.StrictMode>\s*([\s\S]*?)\s*<\/React\.StrictMode>/g,
      // <StrictMode>...</StrictMode>
      /<StrictMode>\s*([\s\S]*?)\s*<\/StrictMode>/g,
    ];

    let modified = false;
    for (const pattern of patterns) {
      if (pattern.test(content)) {
        content = content.replace(pattern, '$1');
        modified = true;
      }
    }

    // Also remove the import if no longer used
    if (modified && !content.includes('StrictMode')) {
      content = content.replace(/,?\s*StrictMode\s*,?/g, (match) => {
        // Clean up import statement
        return match.includes(',') ? ', ' : '';
      });
      // Clean up empty imports
      content = content.replace(/import\s*{\s*}\s*from\s*['"]react['"]\s*;?\n?/g, '');
      content = content.replace(/import\s*{\s*,\s*/g, 'import { ');
      content = content.replace(/,\s*}\s*from/g, ' } from');
    }

    if (modified) {
      writeFileSync(filePath, content);
      console.log(`  ✓ Removed StrictMode wrapper from ${file}`);
      console.log('    (Required for tldraw compatibility)');
      return true;
    }
  }

  return false;
}

// =============================================================================
// Main Init
// =============================================================================

function init() {
  const cwd = process.cwd();
  let modified = false;

  console.log('');
  console.log('  Skema Init');
  console.log('');

  // Detect framework
  const framework = detectFramework(cwd);
  console.log(`  Detected: ${framework === 'unknown' ? 'React app' : framework}`);
  console.log('');

  // Framework-specific setup
  switch (framework) {
    case 'nextjs':
      modified = setupNextjs(cwd) || modified;
      break;

    case 'vite':
    case 'cra':
    case 'remix':
    case 'unknown':
      // For non-Next.js, handle StrictMode in entry file
      modified = removeStrictModeWrapper(cwd) || modified;
      break;
  }

  // ==========================================================================
  // Print usage instructions
  // ==========================================================================
  console.log('');

  if (modified) {
    console.log('  Skema configured successfully!');
  } else {
    console.log('  Skema ready to use!');
  }

  console.log('');
  console.log('  Usage:');
  console.log('');
  console.log('    import { Skema } from "skema-core";');
  console.log('');

  if (framework === 'nextjs') {
    console.log('    // In your layout.tsx or page');
    console.log('    {process.env.NODE_ENV === "development" && <Skema />}');
  } else {
    console.log('    // In your App.tsx or main entry');
    console.log('    {import.meta.env.DEV && <Skema />}');
  }

  console.log('');
  console.log('  Start the daemon:');
  console.log('');
  console.log('    npx skema-serve');
  console.log('');
  console.log('  Then press ⌘⇧E (Cmd+Shift+E) to toggle Skema');
  console.log('');
}

// Run if called directly
if (require.main === module) {
  init();
}

export { init };
