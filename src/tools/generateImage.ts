import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { GeminiService } from '../services/gemini.js';
import { GenerateImageArgs } from '../types/index.js';

export const generateImageTool: Tool = {
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
};

export async function handleGenerateImage(args: GenerateImageArgs, geminiService: GeminiService) {
  if (!args.description) {
    throw new Error('Description is required');
  }

  const result = await geminiService.generateImage(args);

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
}