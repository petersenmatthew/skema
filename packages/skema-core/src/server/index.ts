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
