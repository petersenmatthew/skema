// =============================================================================
// Skema MCP Server Entry Point
// =============================================================================

import 'dotenv/config';
import { startMcpServer } from './server';

// Start the MCP server
startMcpServer().catch((error) => {
  console.error('[Skema MCP] Fatal error:', error);
  process.exit(1);
});
