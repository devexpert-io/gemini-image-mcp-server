#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { GeminiService } from './services/gemini.js';
import { ImageService } from './services/imageService.js';
import { generateImageTool, handleGenerateImage } from './tools/index.js';
import { GenerateImageArgs } from './types';

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
        tools: [generateImageTool],
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        if (request.params.name === 'generate_image') {
          const args = request.params.arguments as unknown as GenerateImageArgs;
          return await handleGenerateImage(args, this.geminiService, this.imageService);
        } else {
          throw new Error(`Unknown tool: ${request.params.name}`);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        throw new Error(`Error generating image: ${errorMessage}`);
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
