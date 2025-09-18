import { ErrorCode, Tool } from '@modelcontextprotocol/sdk/types.js';

import { GeminiService } from '../services/gemini.js';
import { ImageService } from '../services/imageService.js';
import { ensureMcpError, invalidParams } from '../utils/errors.js';
import { EditImageArgs } from '../types';

export const editImageTool: Tool = {
  name: 'edit_image',
  description:
    'Modify an existing image using Google Gemini AI based on a text instruction. Provide the path to the image you want to edit and describe the changes that should be applied.',
  inputSchema: {
    type: 'object',
    properties: {
      description: {
        type: 'string',
        description:
          'Describe the changes that should be applied to the provided image. Be specific about elements to add, remove, or modify.',
      },
      image: {
        type: 'string',
        description: 'Path to the image file that should be edited. Can be absolute or relative to the server.',
      },
      outputPath: {
        type: 'string',
        description:
          'Optional path where the edited image should be saved. If omitted, saves in the current working directory using an auto-generated filename.',
      },
    },
    required: ['description', 'image'],
  },
};

export async function handleEditImage(
  args: EditImageArgs,
  geminiService: GeminiService,
  imageService: ImageService
) {
  const description = args.description?.trim();
  if (!description) {
    throw invalidParams('Description is required to edit an image');
  }

  if (!args.image || !args.image.trim()) {
    throw invalidParams('Image path is required to edit an image');
  }

  try {
    const imageData = await geminiService.generateImage({
      description,
      images: [args.image],
    });

    const filePath = await imageService.saveImage(imageData, {
      description,
      outputPath: args.outputPath,
    });

    return {
      content: [
        {
          type: 'text',
          text: filePath,
        },
      ],
    };
  } catch (error) {
    throw ensureMcpError(error, ErrorCode.InternalError, 'Failed to edit image', {
      stage: 'edit_image.tool',
    });
  }
}
