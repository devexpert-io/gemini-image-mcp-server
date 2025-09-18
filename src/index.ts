#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { GeminiService } from './services/gemini.js';
import { ImageService } from './services/imageService.js';
import { editImageTool, handleEditImage, generateImageTool, handleGenerateImage } from './tools/index.js';
import { EditImageArgs, GenerateImageArgs } from './types';
import { ensureMcpError, invalidParams } from './utils/errors.js';

class GeminiImageMCPServer {
  private server: Server;
  private geminiService!: GeminiService;
  private imageService!: ImageService;

  constructor() {
    this.server = new Server(
      {
        name: 'gemini-image-mcp-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.initializeServices();
    this.setupToolHandlers();
  }

  private initializeServices() {
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      console.error('Error: GOOGLE_API_KEY environment variable is required');
      process.exit(1);
    }

    this.geminiService = new GeminiService(apiKey);
    this.imageService = new ImageService();
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [generateImageTool, editImageTool],
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        if (request.params.name === 'generate_image') {
          const args = request.params.arguments as unknown as GenerateImageArgs;
          return await handleGenerateImage(args, this.geminiService, this.imageService);
        }

        if (request.params.name === 'edit_image') {
          const args = request.params.arguments as unknown as EditImageArgs;
          return await handleEditImage(args, this.geminiService, this.imageService);
        }

        throw invalidParams(`Unknown tool: ${request.params.name}`, {
          tool: request.params.name,
        });
      } catch (error) {
        const mcpError = ensureMcpError(error, ErrorCode.InternalError, 'Tool execution failed', {
          tool: request.params.name,
        });

        const logPayload = {
          tool: request.params.name,
          code: mcpError.code,
          data: mcpError.data,
        };

        if (mcpError.code === ErrorCode.InvalidParams) {
          console.warn('[tools/call] Client error', logPayload);
        } else {
          console.error('[tools/call] Internal error', {
            ...logPayload,
            original: error instanceof Error ? error.stack || error.message : error,
          });
        }

        throw mcpError;
      }
    });
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Gemini Image MCP Server running on stdio');
  }
}

const server = new GeminiImageMCPServer();
server.run().catch(console.error);
