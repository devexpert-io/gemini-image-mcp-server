#!/usr/bin/env node

import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { writeFile, mkdir, readFile } from 'fs/promises';
import { join, resolve, extname } from 'path';
import { existsSync } from 'fs';

interface GenerateImageArgs {
  description: string;
  aspectRatio?: '1:1' | '16:9' | '9:16' | '4:3' | '3:4';
  style?: string;
  outputPath?: string;
}

interface EditImageArgs {
  imagePath: string;
  description: string;
  outputPath?: string;
}

class GeminiImageMCPServer {
  private server: Server;
  private genAI: GoogleGenerativeAI | null = null;

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

    this.setupToolHandlers();
    this.initializeGemini();
  }

  private initializeGemini() {
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      console.error('Error: GOOGLE_API_KEY environment variable is required');
      process.exit(1);
    }

    this.genAI = new GoogleGenerativeAI(apiKey);
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'generate_image',
            description: 'Generate an image using Google Gemini AI based on a text description. Optimized for social media images with 1:1 format by default.',
            inputSchema: {
              type: 'object',
              properties: {
                description: {
                  type: 'string',
                  description: 'Detailed description of the image to generate. For better social media results, include details about colors, style and composition.',
                },
                aspectRatio: {
                  type: 'string',
                  enum: ['1:1', '16:9', '9:16', '4:3', '3:4'],
                  description: 'Aspect ratio of the image. Default: 1:1 (ideal for social media)',
                  default: '1:1',
                },
                style: {
                  type: 'string',
                  description: 'Additional style for the image (optional). Examples: "minimalist", "colorful", "professional", "artistic"',
                },
                outputPath: {
                  type: 'string',
                  description: 'Path where to save the image (optional). If not specified, saves in current directory. Can be a folder or complete path with filename.',
                },
              },
              required: ['description'],
            },
          } as Tool,
          {
            name: 'edit_image',
            description: 'Edit an existing image using Google Gemini AI based on text instructions.',
            inputSchema: {
              type: 'object',
              properties: {
                imagePath: {
                  type: 'string',
                  description: 'Path to the image file to edit (absolute or relative path)',
                },
                description: {
                  type: 'string',
                  description: 'Detailed description of the changes to make to the image. Be specific about what you want to modify, add, remove, or enhance.',
                },
                outputPath: {
                  type: 'string',
                  description: 'Path where to save the edited image (optional). If not specified, saves in current directory with "_edited" suffix.',
                },
              },
              required: ['imagePath', 'description'],
            },
          } as Tool,
        ],
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      if (request.params.name === 'generate_image') {
        const args = request.params.arguments as unknown as GenerateImageArgs;

      if (!args.description) {
        throw new Error('Description is required');
      }

      try {
        const result = await this.generateImage(args);
        return {
          content: [
            {
              type: 'text',
              text: `Image generated successfully with description: "${args.description}"\nSaved to: ${result.filePath}`,
            },
            {
              type: 'image',
              data: result.base64,
              mimeType: result.mimeType,
            },
          ],
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        throw new Error(`Error generating image: ${errorMessage}`);
      }
      } else if (request.params.name === 'edit_image') {
        const args = request.params.arguments as unknown as EditImageArgs;

        if (!args.imagePath) {
          throw new Error('Image path is required');
        }
        if (!args.description) {
          throw new Error('Description is required');
        }

        try {
          const result = await this.editImage(args);
          return {
            content: [
              {
                type: 'text',
                text: `Image edited successfully with description: "${args.description}"\nSaved to: ${result.filePath}`,
              },
              {
                type: 'image',
                data: result.base64,
                mimeType: result.mimeType,
              },
            ],
          };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          throw new Error(`Error editing image: ${errorMessage}`);
        }
      } else {
        throw new Error(`Unknown tool: ${request.params.name}`);
      }
    });
  }

  private async generateImage(args: GenerateImageArgs): Promise<{base64: string, mimeType: string, filePath: string}> {
    if (!this.genAI) {
      throw new Error('Google AI is not initialized');
    }

    const aspectRatio = args.aspectRatio || '1:1';

    // Build optimized prompt for image generation
    let fullPrompt = `Generate an image with the following description: ${args.description}`;

    // Add format specifications
    fullPrompt += ` The image should have an aspect ratio of ${aspectRatio}.`;

    // Add style if specified
    if (args.style) {
      fullPrompt += ` The style should be ${args.style}.`;
    }

    // Social media optimizations for 1:1 format
    if (aspectRatio === '1:1') {
      fullPrompt += ' The composition should be attractive for social media, with well-centered elements and vibrant colors.';
    }

    const safetySettings = [
      {
        category: HarmCategory.HARM_CATEGORY_HARASSMENT,
        threshold: HarmBlockThreshold.BLOCK_NONE,
      },
      {
        category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
        threshold: HarmBlockThreshold.BLOCK_NONE,
      },
      {
        category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
        threshold: HarmBlockThreshold.BLOCK_NONE,
      },
      {
        category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
        threshold: HarmBlockThreshold.BLOCK_NONE,
      },
    ];

    const model = this.genAI.getGenerativeModel({
      model: 'gemini-2.5-flash-image-preview',
      safetySettings
    });

    const response = await model.generateContent(fullPrompt);

    // Extract image from response
    const candidate = response.response.candidates?.[0];
    if (!candidate?.content?.parts) {
      throw new Error('Could not generate image');
    }

    for (const part of candidate.content.parts) {
      if (part.inlineData?.data && part.inlineData?.mimeType) {
        const filePath = await this.saveImage(
          part.inlineData.data,
          part.inlineData.mimeType,
          args.outputPath,
          args.description
        );

        return {
          base64: part.inlineData.data,
          mimeType: part.inlineData.mimeType,
          filePath,
        };
      }
    }

    throw new Error('No image found in response');
  }

  private async editImage(args: EditImageArgs): Promise<{base64: string, mimeType: string, filePath: string}> {
    if (!this.genAI) {
      throw new Error('Google AI is not initialized');
    }

    // Read the input image
    const imagePath = resolve(args.imagePath);
    if (!existsSync(imagePath)) {
      throw new Error(`Image file not found: ${imagePath}`);
    }

    const imageBuffer = await readFile(imagePath);
    const imageBase64 = imageBuffer.toString('base64');

    // Determine MIME type from file extension
    const extension = extname(imagePath).toLowerCase();
    const mimeType = extension === '.png' ? 'image/png' :
                    extension === '.jpg' || extension === '.jpeg' ? 'image/jpeg' :
                    extension === '.webp' ? 'image/webp' : 'image/png';

    const safetySettings = [
      {
        category: HarmCategory.HARM_CATEGORY_HARASSMENT,
        threshold: HarmBlockThreshold.BLOCK_NONE,
      },
      {
        category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
        threshold: HarmBlockThreshold.BLOCK_NONE,
      },
      {
        category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
        threshold: HarmBlockThreshold.BLOCK_NONE,
      },
      {
        category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
        threshold: HarmBlockThreshold.BLOCK_NONE,
      },
    ];

    const model = this.genAI.getGenerativeModel({
      model: 'gemini-2.5-flash-image-preview',
      safetySettings
    });

    // Create the edit prompt
    const editPrompt = `Edit this image based on the following instructions: ${args.description}`;

    const response = await model.generateContent([
      editPrompt,
      {
        inlineData: {
          mimeType,
          data: imageBase64,
        },
      },
    ]);

    // Extract the edited image from response
    const candidate = response.response.candidates?.[0];
    if (!candidate?.content?.parts) {
      throw new Error('Could not edit image');
    }

    for (const part of candidate.content.parts) {
      if (part.inlineData?.data && part.inlineData?.mimeType) {
        // Generate output filename with "_edited" suffix if no output path specified
        let outputDescription = args.description.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_').slice(0, 30);
        if (!outputDescription) outputDescription = 'edited';

        const filePath = await this.saveImage(
          part.inlineData.data,
          part.inlineData.mimeType,
          args.outputPath,
          outputDescription
        );

        return {
          base64: part.inlineData.data,
          mimeType: part.inlineData.mimeType,
          filePath,
        };
      }
    }

    throw new Error('No edited image found in response');
  }

  private async saveImage(
    base64Data: string,
    mimeType: string,
    outputPath?: string,
    description?: string
  ): Promise<string> {
    // Determine file extension based on mimeType
    const extension = mimeType === 'image/png' ? '.png' :
                     mimeType === 'image/jpeg' ? '.jpg' :
                     mimeType === 'image/webp' ? '.webp' : '.png';

    // Generate filename based on description or timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const safeDescription = description
      ? description.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_').slice(0, 50)
      : 'image';
    const filename = `${safeDescription}_${timestamp}${extension}`;

    let finalPath: string;

    if (!outputPath) {
      // Save to current directory
      finalPath = resolve(process.cwd(), filename);
    } else {
      const resolvedPath = resolve(outputPath);

      // Check if it's a directory or a file
      if (outputPath.endsWith('/') || (!extname(outputPath) && existsSync(resolvedPath))) {
        // It's a directory
        await this.ensureDirectoryExists(resolvedPath);
        finalPath = join(resolvedPath, filename);
      } else {
        // It's a specific file path
        const dir = join(resolvedPath, '..');
        await this.ensureDirectoryExists(dir);
        finalPath = resolvedPath;
      }
    }

    // Convert base64 to buffer and save
    const buffer = Buffer.from(base64Data, 'base64');
    await writeFile(finalPath, buffer);

    return finalPath;
  }

  private async ensureDirectoryExists(dirPath: string): Promise<void> {
    if (!existsSync(dirPath)) {
      await mkdir(dirPath, { recursive: true });
    }
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Gemini Image MCP Server running on stdio');
  }
}

const server = new GeminiImageMCPServer();
server.run().catch(console.error);