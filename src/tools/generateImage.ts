import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { GeminiService } from '../services/gemini.js';
import { ImageService } from '../services/imageService.js';
import { GenerateImageArgs } from '../types';

export const generateImageTool: Tool = {
  name: 'generate_image',
  description: 'Create an image using Google Gemini AI from a text description, optionally providing one or more context images to guide the result.',
  inputSchema: {
    type: 'object',
    properties: {
      description: {
        type: 'string',
        description: 'Detailed description of the image to generate. For better social media results, include details about colors, style and composition.',
      },
      images: {
        type: 'array',
        items: { type: 'string' },
        description: 'Optional array of image file paths to use as visual context (absolute or relative).',
      },
      watermarkPosition: {
        type: 'string',
        enum: ['top-left', 'top-right', 'bottom-left', 'bottom-right'],
        description: 'Optional watermark position when using `watermarkPath`.',
        default: 'bottom-right',
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
      watermarkPath: {
        type: 'string',
        description: 'Path to watermark image file to overlay in a corner (optional)',
      },
    },
    required: ['description'],
  },
};

export async function handleGenerateImage(args: GenerateImageArgs, geminiService: GeminiService, imageService: ImageService) {
  if (!args.description) {
    throw new Error('Description is required');
  }

  const imageData = await geminiService.generateImage(args);

  const filePath = await imageService.saveImage(imageData, {
    outputPath: args.outputPath,
    description: args.description,
    watermarkPath: args.watermarkPath,
    watermarkPosition: args.watermarkPosition
  });

  return {
    content: [
      {
        type: 'text',
        text: filePath,
      },
    ],
  };
}
