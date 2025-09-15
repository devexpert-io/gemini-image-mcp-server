import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { GeminiService } from '../services/gemini.js';
import { EditImageArgs } from '../types/index.js';

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

export async function handleEditImage(args: EditImageArgs, geminiService: GeminiService) {
  if (!args.imagePath) {
    throw new Error('Image path is required');
  }
  if (!args.description) {
    throw new Error('Description is required');
  }

  const result = await geminiService.editImage(args);

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
}