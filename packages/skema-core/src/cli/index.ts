import 'dotenv/config';
import { startDaemon } from '../server/daemon';

const args = process.argv.slice(2);
const command = args[0];

function printHelp() {
  console.log('');
  console.log('  Skema - Drawing-based website development');
  console.log('');
  console.log('  Usage:');
  console.log('    npx skema          Start the daemon (default)');
  console.log('    npx skema init     Configure your project');
  console.log('    npx skema help     Show this help');
  console.log('');
  console.log('  Options (for daemon):');
  console.log('    -p, --port <port>  Port number (default: 9999)');
  console.log('    -d, --dir <path>   Working directory');
  console.log('    --provider <name>  Default AI provider (gemini|claude)');
  console.log('');
  console.log('  Examples:');
  console.log('    npx skema');
  console.log('    npx skema --port 8080');
  console.log('    npx skema init');
  console.log('');
}

function parseArgs(args: string[]) {
  const config: { port?: number; cwd?: string; defaultProvider?: 'gemini' | 'claude' } = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const next = args[i + 1];

    if (arg === '-p' || arg === '--port') {
      config.port = parseInt(next, 10);
      i++;
    } else if (arg === '-d' || arg === '--dir') {
      config.cwd = next;
      i++;
    } else if (arg === '--provider') {
      config.defaultProvider = next as 'gemini' | 'claude';
      i++;
    }
  }

  return config;
}

async function runInit() {
  // Dynamic import to keep init code separate
  await import('./init');
}

function runDaemon(args: string[]) {
  const config = parseArgs(args);
  startDaemon(config);
}

// Main
if (command === 'help' || command === '-h' || command === '--help') {
  printHelp();
} else if (command === 'init') {
  runInit();
} else if (command === 'serve') {
  // Support "skema serve" as alias
  runDaemon(args.slice(1));
} else {
  // Default: run daemon
  runDaemon(args);
}
