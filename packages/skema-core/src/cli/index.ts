import 'dotenv/config';
import { startDaemon, type ExecutionMode } from '../server/daemon';

const args = process.argv.slice(2);
const command = args[0];

function printHelp() {
  console.log('');
  console.log('  Skema - Drawing-based website development');
  console.log('');
  console.log('  Usage:');
  console.log('    npx skema-core          Start the daemon (default)');
  console.log('    npx skema-core --mcp    Start as MCP server (for Cursor/Claude Desktop)');
  console.log('    npx skema-core init     Configure your project');
  console.log('    npx skema-core help     Show this help');
  console.log('');
  console.log('  Options (for daemon):');
  console.log('    -p, --port <port>       Port number (default: 9999)');
  console.log('    -d, --dir <path>        Working directory');
  console.log('    --provider <name>       Default AI provider (gemini|claude)');
  console.log('    --mode <mode>           Execution mode (direct-cli|mcp)');
  console.log('    --mcp                   Start as MCP server (stdio transport)');
  console.log('');
  console.log('  Execution Modes:');
  console.log('    direct-cli    Use Gemini/Claude CLI agents (default, no API key needed)');
  console.log('    mcp           Route through AI agent (Cursor, Claude Desktop)');
  console.log('');
  console.log('  Examples:');
  console.log('    npx skema-core');
  console.log('    npx skema-core --port 8080');
  console.log('    npx skema-core --provider claude');
  console.log('    npx skema-core --mcp');
  console.log('    npx skema-core init');
  console.log('');
  console.log('  Note: After installing skema-core, you can also use "skema" directly.');
  console.log('');
}

interface ParsedConfig {
  port?: number;
  cwd?: string;
  defaultProvider?: 'gemini' | 'claude';
  defaultMode?: ExecutionMode;
  mcp?: boolean;
}

function parseArgs(args: string[]): ParsedConfig {
  const config: ParsedConfig = {};

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
    } else if (arg === '--mode') {
      config.defaultMode = next as ExecutionMode;
      i++;
    } else if (arg === '--mcp') {
      config.mcp = true;
    }
  }

  return config;
}

async function runInit() {
  // Dynamic import to keep init code separate
  await import('./init');
}

async function runMcpServer() {
  // Dynamic import the MCP server
  const { startMcpServer } = await import('../mcp/server');
  await startMcpServer();
}

function runDaemon(args: string[]) {
  const config = parseArgs(args);
  
  // If --mcp flag is set, start MCP server instead
  if (config.mcp) {
    runMcpServer().catch((error) => {
      console.error('[Skema] MCP server error:', error);
      process.exit(1);
    });
    return;
  }
  
  startDaemon({
    port: config.port,
    cwd: config.cwd,
    defaultProvider: config.defaultProvider,
    defaultMode: config.defaultMode,
  });
}

// Main
if (command === 'help' || command === '-h' || command === '--help') {
  printHelp();
} else if (command === 'init') {
  runInit();
} else if (command === 'serve') {
  // Support "skema serve" as alias
  runDaemon(args.slice(1));
} else if (command === 'mcp' || command === '--mcp') {
  // Direct MCP server start
  runMcpServer().catch((error) => {
    console.error('[Skema] MCP server error:', error);
    process.exit(1);
  });
} else {
  // Default: run daemon
  runDaemon(args);
}
