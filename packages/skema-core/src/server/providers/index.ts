// =============================================================================
// Execution Mode & Provider Types
// =============================================================================

/**
 * Execution modes:
 * - 'direct-cli': Annotations processed instantly via CLI agents (gemini/claude CLI tools)
 * - 'mcp': Annotations routed through an AI agent (Cursor, Claude Desktop, etc.)
 */
export type ExecutionMode = 'direct-cli' | 'mcp';
export type ProviderName = 'gemini' | 'claude';
