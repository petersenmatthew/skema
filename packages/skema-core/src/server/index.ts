// Server-side utilities for Skema
// These require Node.js and should only be used in server contexts (API routes, etc.)

export {
  // Core functions
  buildPromptFromAnnotation,
  spawnGeminiCLI,
  createGeminiCLIStream,
  runGeminiCLI,
  // Undo/revert functions
  revertAnnotation,
  getTrackedAnnotations,
  // Next.js route handlers
  createGeminiRouteHandler,
  createRevertRouteHandler,
  POST,
  DELETE,
  // Types
  type GeminiCLIOptions,
  type GeminiCLIEvent,
  type ProjectContext,
} from './gemini-cli';

// Export individual prompt builders for customization/inspection
// See /server/prompts.ts for full documentation
export {
  buildFastDomSelectionPrompt,
  buildDetailedDomSelectionPrompt,
  buildGesturePrompt,
  buildDrawingToCodePrompt,
  IMAGE_ANALYSIS_PROMPT,
  // Types for prompt inputs
  type DomSelectionInput,
  type DetailedDomSelectionInput,
  type GestureInput,
  type DrawingInput,
} from './prompts';

// =============================================================================
// WebSocket Daemon (Option 2)
// =============================================================================

export {
  startDaemon,
  type DaemonConfig,
  type DaemonInstance,
  type IncomingMessage,
  type OutgoingMessage,
} from './daemon';

// =============================================================================
// AI CLI Provider Abstraction (Gemini/Claude CLI switching)
// =============================================================================

export {
  spawnAICLI,
  runAICLI,
  isProviderAvailable,
  getAvailableProviders as getCLIProviders,
  type AIProvider as CLIProvider,
  type AIProviderConfig,
  type AIStreamEvent,
  type AIRunResult,
} from './ai-provider';

// =============================================================================
// Vision Analysis (Image/Drawing Analysis)
// =============================================================================

export {
  analyzeImage,
  isVisionAvailable,
  type VisionAnalysisResult,
  type VisionConfig,
} from './vision';

// =============================================================================
// Execution Mode & Provider Types
// =============================================================================

export {
  type ExecutionMode,
  type ProviderName,
} from './providers';

// =============================================================================
// Annotation Store (MCP-mode annotation queuing)
// =============================================================================

export {
  queueAnnotation,
  getPendingAnnotations,
  getAllAnnotations,
  getAnnotation,
  acknowledgeAnnotation,
  resolveAnnotation,
  dismissAnnotation,
  removeAnnotation,
  clearAnnotations,
  getPendingCount,
  onStoreEvent,
  type StoredAnnotation,
  type AnnotationStatus,
} from './annotation-store';
