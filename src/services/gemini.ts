import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import { readFile } from 'fs/promises';
import { resolve, extname } from 'path';
import { existsSync } from 'fs';
import { GenerateImageArgs, EditImageArgs } from '../types';

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

    const response = await model.generateContent(fullPrompt);

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

  async editImage(args: EditImageArgs): Promise<ImageData> {
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

    const model = this.genAI.getGenerativeModel({
      model: 'gemini-2.5-flash-image-preview',
      safetySettings: this.getSafetySettings()
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
        return {
          base64: part.inlineData.data,
          mimeType: part.inlineData.mimeType,
        };
      }
    }

    throw new Error('No edited image found in response');
  }

}