// =============================================================================
// Skema MCP Server Implementation
// =============================================================================

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  type CallToolRequest,
  type ReadResourceRequest,
} from '@modelcontextprotocol/sdk/types.js';
import * as fs from 'fs';
import * as path from 'path';
import { getProvider, getAvailableProviders, type ProviderName } from '../server/providers';
import { analyzeImage as analyzeImageWithVision } from '../server/vision';
import { buildDrawingToCodePrompt, buildDetailedDomSelectionPrompt } from '../server/prompts';

// =============================================================================
// Types
// =============================================================================

interface SkemaGenerateInput {
  comment: string;
  annotationType: 'dom_selection' | 'drawing' | 'gesture';
  provider?: ProviderName;
  // DOM selection fields
  selector?: string;
  tagName?: string;
  text?: string;
  elementPath?: string;
  // Drawing fields
  drawingImage?: string;
  drawingSvg?: string;
  boundingBox?: { x: number; y: number; width: number; height: number };
}

interface FileOperationInput {
  path: string;
  content?: string;
}

// =============================================================================
// Server State
// =============================================================================

let currentProvider: ProviderName = 'gemini';
let workingDirectory: string = process.cwd();

// =============================================================================
// Tool Handlers
// =============================================================================

async function handleGenerate(input: SkemaGenerateInput): Promise<string> {
  const providerName = input.provider || currentProvider;
  const provider = getProvider(providerName);
  
  if (!provider) {
    return `Error: Provider ${providerName} is not available. Check API key configuration.`;
  }

  // Build prompt based on annotation type
  let prompt: string;
  
  if (input.annotationType === 'drawing') {
    // If there's an image, analyze it first
    let visionDescription: string | undefined;
    if (input.drawingImage) {
      try {
        visionDescription = await provider.analyzeImage(
          input.drawingImage,
          'Analyze this UI wireframe sketch for a front-end developer. Describe the layout and elements.'
        );
      } catch (error) {
        console.error('[Skema MCP] Vision analysis failed:', error);
      }
    }

    prompt = buildDrawingToCodePrompt({
      comment: input.comment,
      boundingBox: input.boundingBox,
      drawingSvg: input.drawingSvg,
      drawingImage: input.drawingImage,
      visionDescription,
    });
  } else {
    // DOM selection or gesture
    prompt = buildDetailedDomSelectionPrompt({
      comment: input.comment,
      selector: input.selector,
      tagName: input.tagName,
      text: input.text,
      elementPath: input.elementPath,
    });
  }

  // Stream generation and collect results
  let result = '';
  try {
    for await (const event of provider.generateStream(prompt)) {
      if (event.type === 'text' && event.content) {
        result += event.content;
      } else if (event.type === 'error') {
        return `Error during generation: ${event.content}`;
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return `Generation failed: ${message}`;
  }

  return result || 'Generation completed but no output was produced.';
}

async function handleAnalyzeImage(input: { image: string; prompt?: string }): Promise<string> {
  const provider = getProvider(currentProvider);
  
  if (!provider) {
    return `Error: Provider ${currentProvider} is not available for vision analysis.`;
  }

  try {
    const description = await provider.analyzeImage(
      input.image,
      input.prompt || 'Analyze this image and describe what you see.'
    );
    return description;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return `Vision analysis failed: ${message}`;
  }
}

async function handleReadFile(input: FileOperationInput): Promise<string> {
  try {
    const filePath = path.isAbsolute(input.path) 
      ? input.path 
      : path.join(workingDirectory, input.path);
    
    const content = fs.readFileSync(filePath, 'utf-8');
    return content;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return `Error reading file: ${message}`;
  }
}

async function handleWriteFile(input: FileOperationInput): Promise<string> {
  if (!input.content) {
    return 'Error: No content provided for write operation.';
  }

  try {
    const filePath = path.isAbsolute(input.path) 
      ? input.path 
      : path.join(workingDirectory, input.path);
    
    // Ensure directory exists
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(filePath, input.content, 'utf-8');
    return `Successfully wrote to ${filePath}`;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return `Error writing file: ${message}`;
  }
}

async function handleListFiles(input: { directory?: string }): Promise<string> {
  try {
    const dir = input.directory 
      ? (path.isAbsolute(input.directory) ? input.directory : path.join(workingDirectory, input.directory))
      : workingDirectory;
    
    const files = fs.readdirSync(dir, { withFileTypes: true });
    const fileList = files.map(f => `${f.isDirectory() ? '[dir] ' : ''}${f.name}`);
    return fileList.join('\n');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return `Error listing files: ${message}`;
  }
}

async function handleSetProvider(input: { provider: ProviderName }): Promise<string> {
  const availableProviders = getAvailableProviders();
  
  if (!availableProviders.includes(input.provider)) {
    return `Provider ${input.provider} is not available. Available providers: ${availableProviders.join(', ')}`;
  }

  currentProvider = input.provider;
  return `Provider set to ${input.provider}`;
}

async function handleGetStatus(): Promise<string> {
  const availableProviders = getAvailableProviders();
  return JSON.stringify({
    currentProvider,
    availableProviders,
    workingDirectory,
  }, null, 2);
}

// =============================================================================
// MCP Server Setup
// =============================================================================

export async function startMcpServer(): Promise<void> {
  const server = new Server(
    {
      name: 'skema',
      version: '0.2.0',
    },
    {
      capabilities: {
        tools: {},
        resources: {},
      },
    }
  );

  // ==========================================================================
  // Tool Definitions
  // ==========================================================================

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: 'skema_generate',
          description: 'Generate code changes based on an annotation (DOM selection, drawing, or gesture)',
          inputSchema: {
            type: 'object',
            properties: {
              comment: { type: 'string', description: 'User comment describing the change' },
              annotationType: { 
                type: 'string', 
                enum: ['dom_selection', 'drawing', 'gesture'],
                description: 'Type of annotation'
              },
              provider: { 
                type: 'string', 
                enum: ['gemini', 'claude', 'openai'],
                description: 'AI provider to use (optional, defaults to current provider)'
              },
              selector: { type: 'string', description: 'CSS selector for DOM selection' },
              tagName: { type: 'string', description: 'HTML tag name' },
              text: { type: 'string', description: 'Text content of element' },
              elementPath: { type: 'string', description: 'DOM path to element' },
              drawingImage: { type: 'string', description: 'Base64 PNG of drawing' },
              drawingSvg: { type: 'string', description: 'SVG representation of drawing' },
              boundingBox: {
                type: 'object',
                properties: {
                  x: { type: 'number' },
                  y: { type: 'number' },
                  width: { type: 'number' },
                  height: { type: 'number' },
                },
              },
            },
            required: ['comment', 'annotationType'],
          },
        },
        {
          name: 'skema_analyze_image',
          description: 'Analyze an image using vision AI',
          inputSchema: {
            type: 'object',
            properties: {
              image: { type: 'string', description: 'Base64 encoded image' },
              prompt: { type: 'string', description: 'Analysis prompt (optional)' },
            },
            required: ['image'],
          },
        },
        {
          name: 'skema_read_file',
          description: 'Read contents of a file',
          inputSchema: {
            type: 'object',
            properties: {
              path: { type: 'string', description: 'File path (absolute or relative to working directory)' },
            },
            required: ['path'],
          },
        },
        {
          name: 'skema_write_file',
          description: 'Write content to a file',
          inputSchema: {
            type: 'object',
            properties: {
              path: { type: 'string', description: 'File path (absolute or relative to working directory)' },
              content: { type: 'string', description: 'Content to write' },
            },
            required: ['path', 'content'],
          },
        },
        {
          name: 'skema_list_files',
          description: 'List files in a directory',
          inputSchema: {
            type: 'object',
            properties: {
              directory: { type: 'string', description: 'Directory path (optional, defaults to working directory)' },
            },
          },
        },
        {
          name: 'skema_set_provider',
          description: 'Set the AI provider to use',
          inputSchema: {
            type: 'object',
            properties: {
              provider: { 
                type: 'string', 
                enum: ['gemini', 'claude', 'openai'],
                description: 'Provider name'
              },
            },
            required: ['provider'],
          },
        },
        {
          name: 'skema_status',
          description: 'Get current Skema status including provider and available providers',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
      ],
    };
  });

  // ==========================================================================
  // Tool Call Handler
  // ==========================================================================

  server.setRequestHandler(CallToolRequestSchema, async (request: CallToolRequest) => {
    const { name, arguments: args } = request.params;

    try {
      let result: string;

      switch (name) {
        case 'skema_generate':
          result = await handleGenerate(args as SkemaGenerateInput);
          break;
        case 'skema_analyze_image':
          result = await handleAnalyzeImage(args as { image: string; prompt?: string });
          break;
        case 'skema_read_file':
          result = await handleReadFile(args as FileOperationInput);
          break;
        case 'skema_write_file':
          result = await handleWriteFile(args as FileOperationInput);
          break;
        case 'skema_list_files':
          result = await handleListFiles(args as { directory?: string });
          break;
        case 'skema_set_provider':
          result = await handleSetProvider(args as { provider: ProviderName });
          break;
        case 'skema_status':
          result = await handleGetStatus();
          break;
        default:
          result = `Unknown tool: ${name}`;
      }

      return {
        content: [{ type: 'text', text: result }],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: 'text', text: `Error: ${message}` }],
        isError: true,
      };
    }
  });

  // ==========================================================================
  // Resource Definitions
  // ==========================================================================

  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    return {
      resources: [
        {
          uri: 'skema://status',
          name: 'Skema Status',
          description: 'Current Skema configuration and status',
          mimeType: 'application/json',
        },
        {
          uri: 'skema://providers',
          name: 'Available Providers',
          description: 'List of available AI providers',
          mimeType: 'application/json',
        },
      ],
    };
  });

  server.setRequestHandler(ReadResourceRequestSchema, async (request: ReadResourceRequest) => {
    const { uri } = request.params;

    switch (uri) {
      case 'skema://status':
        return {
          contents: [{
            uri,
            mimeType: 'application/json',
            text: JSON.stringify({
              currentProvider,
              availableProviders: getAvailableProviders(),
              workingDirectory,
            }, null, 2),
          }],
        };
      case 'skema://providers':
        return {
          contents: [{
            uri,
            mimeType: 'application/json',
            text: JSON.stringify({
              available: getAvailableProviders(),
              current: currentProvider,
            }, null, 2),
          }],
        };
      default:
        throw new Error(`Unknown resource: ${uri}`);
    }
  });

  // ==========================================================================
  // Start Server
  // ==========================================================================

  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error('[Skema MCP] Server started');
  console.error('[Skema MCP] Working directory:', workingDirectory);
  console.error('[Skema MCP] Available providers:', getAvailableProviders().join(', ') || 'none');
}
