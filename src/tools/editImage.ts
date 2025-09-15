import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { GeminiService } from '../services/gemini.js';
import { ImageService } from '../services/imageService.js';
import { EditImageArgs } from '../types';

export const editImageTool: Tool = {
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
      logoPath: {
        type: 'string',
        description: 'Path to logo file to add as watermark in bottom-right corner (optional)',
      },
    },
    required: ['imagePath', 'description'],
  },
};

export async function handleEditImage(args: EditImageArgs, geminiService: GeminiService, imageService: ImageService) {
  if (!args.imagePath) {
    throw new Error('Image path is required');
  }
  if (!args.description) {
    throw new Error('Description is required');
  }

  // Edit image with Gemini
  const imageData = await geminiService.editImage(args);

  // Generate output description for filename
  let outputDescription = args.description.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_').slice(0, 30);
  if (!outputDescription) outputDescription = 'edited';

  // Save image with watermark if needed
  const filePath = await imageService.saveImage(imageData, {
    outputPath: args.outputPath,
    description: outputDescription,
    logoPath: args.logoPath
  });

  return {
    content: [
      {
        type: 'text',
        text: `Image edited successfully with description: "${args.description}"\nSaved to: ${filePath}`,
      },
      {
        type: 'image',
        data: imageData.base64,
        mimeType: imageData.mimeType,
      },
    ],
  };
}