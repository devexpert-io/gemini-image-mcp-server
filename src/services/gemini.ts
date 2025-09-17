import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import { readFile } from 'fs/promises';
import { resolve, extname } from 'path';
import { existsSync } from 'fs';
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
          throw new Error(`Context image not found: ${imagePath}`);
        }
        const buffer = await readFile(imagePath);
        const base64 = buffer.toString('base64');
        const ext = extname(imagePath).toLowerCase();
        const mimeType = ext === '.png' ? 'image/png' :
                        ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' :
                        ext === '.webp' ? 'image/webp' : 'image/png';
        parts.push({ inlineData: { mimeType, data: base64 } });
      }
    }

    const response = await model.generateContent(parts);

    // Extract image from response
    const candidate = response.response.candidates?.[0];
    if (!candidate?.content?.parts) {
      throw new Error('Could not generate image');
    }

    for (const part of candidate.content.parts) {
      if (part.inlineData?.data && part.inlineData?.mimeType) {
        return {
          base64: part.inlineData.data,
          mimeType: part.inlineData.mimeType,
        };
      }
    }

    throw new Error('No image found in response');
  }

  // Editing is unified into generation with context images.

}
