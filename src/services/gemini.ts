import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import { readFile } from 'fs/promises';
import { resolve, extname } from 'path';
import { existsSync } from 'fs';
import { ErrorCode } from '@modelcontextprotocol/sdk/types.js';

import { ensureMcpError, internalError, invalidParams } from '../utils/errors.js';
import { GenerateImageArgs } from '../types';

export interface ImageData {
  base64: string;
  mimeType: string;
}

export class GeminiService {
  private genAI: GoogleGenerativeAI;

  constructor(apiKey: string) {
    this.genAI = new GoogleGenerativeAI(apiKey);
  }

  private getSafetySettings() {
    return [
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
  }

  async generateImage(args: GenerateImageArgs): Promise<ImageData> {
    const aspectRatio = args.aspectRatio || '1:1';

    // Build optimized prompt for image generation
    let fullPrompt = `Generate an image with the following description: ${args.description}`;

    // Add format specifications
    fullPrompt += ` The image should have an aspect ratio of ${aspectRatio}.`;

    // Add style if specified
    if (args.style) {
      fullPrompt += ` The style should be ${args.style}.`;
    }

    const model = this.genAI.getGenerativeModel({
      model: 'gemini-2.5-flash-image-preview',
      safetySettings: this.getSafetySettings()
    });

    // If images are provided as context, attach them as inline parts
    const parts: any[] = [fullPrompt];
    if (args.images && args.images.length > 0) {
      for (const imgPathRaw of args.images) {
        const imagePath = resolve(imgPathRaw);
        if (!existsSync(imagePath)) {
          throw invalidParams(`Context image not found: ${imagePath}`, { imagePath });
        }
        let buffer: Buffer;
        try {
          buffer = await readFile(imagePath);
        } catch (error) {
          throw invalidParams(`Unable to read context image: ${imagePath}`, {
            imagePath,
            cause: error instanceof Error ? error.message : String(error),
          });
        }
        const base64 = buffer.toString('base64');
        const ext = extname(imagePath).toLowerCase();
        const mimeType = ext === '.png' ? 'image/png' :
                        ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' :
                        ext === '.webp' ? 'image/webp' : 'image/png';
        parts.push({ inlineData: { mimeType, data: base64 } });
      }
    }

    let response;
    try {
      response = await model.generateContent(parts);
    } catch (error) {
      throw ensureMcpError(error, ErrorCode.InternalError, 'Gemini image generation request failed', {
        stage: 'GeminiService.generateContent',
      });
    }

    // Extract image from response
    const candidate = response.response.candidates?.[0];
    if (!candidate?.content?.parts) {
      throw internalError('Gemini response did not include any content parts', {
        reason: 'emptyCandidate',
      });
    }

    for (const part of candidate.content.parts) {
      if (part.inlineData?.data && part.inlineData?.mimeType) {
        return {
          base64: part.inlineData.data,
          mimeType: part.inlineData.mimeType,
        };
      }
    }

    throw internalError('Gemini response did not contain image data', {
      reason: 'missingInlineData',
    });
  }

  // Editing is unified into generation with context images.

}
