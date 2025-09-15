import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import { writeFile, mkdir, readFile } from 'fs/promises';
import { join, resolve, extname } from 'path';
import { existsSync } from 'fs';
import sharp from 'sharp';
import { GenerateImageArgs, EditImageArgs, ImageResult } from '../types/index.js';

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

  async generateImage(args: GenerateImageArgs): Promise<ImageResult> {
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
        const filePath = await this.saveImage(
          part.inlineData.data,
          part.inlineData.mimeType,
          args.outputPath,
          args.description,
          args.logoPath
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

  async editImage(args: EditImageArgs): Promise<ImageResult> {
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
        // Generate output filename with "_edited" suffix if no output path specified
        let outputDescription = args.description.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_').slice(0, 30);
        if (!outputDescription) outputDescription = 'edited';

        const filePath = await this.saveImage(
          part.inlineData.data,
          part.inlineData.mimeType,
          args.outputPath,
          outputDescription,
          args.logoPath
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
    description?: string,
    logoPath?: string
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

    // Convert base64 to buffer
    let buffer = Buffer.from(base64Data, 'base64');

    // Add watermark if logoPath is provided
    if (logoPath && existsSync(resolve(logoPath))) {
      buffer = Buffer.from(await this.addWatermark(buffer, logoPath));
    }

    await writeFile(finalPath, buffer);

    return finalPath;
  }

  private async addWatermark(imageBuffer: Buffer, logoPath: string): Promise<Buffer> {
    const resolvedLogoPath = resolve(logoPath);

    // Get image dimensions
    const imageInfo = await sharp(imageBuffer).metadata();
    const imageWidth = imageInfo.width || 1024;
    const imageHeight = imageInfo.height || 1024;

    // Calculate logo size (25% of image width, maintaining aspect ratio)
    const logoSize = Math.floor(imageWidth * 0.25);

    // Resize logo and get actual dimensions
    const processedLogo = await sharp(resolvedLogoPath)
      .resize(logoSize, logoSize, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .toBuffer();

    // Get actual dimensions of the processed logo
    const logoInfo = await sharp(processedLogo).metadata();
    const actualLogoWidth = logoInfo.width || logoSize;
    const actualLogoHeight = logoInfo.height || logoSize;

    // Add watermark to bottom-right corner with consistent padding
    const padding = Math.floor(imageWidth * 0.03); // 3% of image width for consistent spacing
    const left = imageWidth - actualLogoWidth - padding;
    const top = imageHeight - actualLogoHeight - padding;

    return await sharp(imageBuffer)
      .composite([
        {
          input: processedLogo,
          left,
          top,
          blend: 'over'
        }
      ])
      .toBuffer();
  }

  private async ensureDirectoryExists(dirPath: string): Promise<void> {
    if (!existsSync(dirPath)) {
      await mkdir(dirPath, { recursive: true });
    }
  }
}