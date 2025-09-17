import { writeFile, mkdir } from 'fs/promises';
import { join, resolve, extname } from 'path';
import { existsSync } from 'fs';
import sharp from 'sharp';

export interface ImageData {
  base64: string;
  mimeType: string;
}

export interface SaveImageOptions {
  outputPath?: string;
  description?: string;
  watermarkPath?: string;
  watermarkPosition?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
}

export class ImageService {
  async saveImage(imageData: ImageData, options: SaveImageOptions = {}): Promise<string> {
    const { outputPath, description, watermarkPath, watermarkPosition } = options;

    // Determine file extension based on mimeType
    const extension = imageData.mimeType === 'image/png' ? '.png' :
                     imageData.mimeType === 'image/jpeg' ? '.jpg' :
                     imageData.mimeType === 'image/webp' ? '.webp' : '.png';

    // Generate filename based on description or timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const safeDescription = description
      ? description.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_').slice(0, 50)
      : 'image';
    const filename = `${safeDescription}_${timestamp}${extension}`;

    // Determine final path
    const finalPath = this.resolvePath(outputPath, filename);

    // Convert base64 to buffer
    let buffer = Buffer.from(imageData.base64, 'base64');

    // Add watermark if watermarkPath is provided
    if (watermarkPath && existsSync(resolve(watermarkPath))) {
      buffer = Buffer.from(await this.addWatermark(buffer, watermarkPath, watermarkPosition));
    }

    // Ensure directory exists and save
    await this.ensureDirectoryExists(join(finalPath, '..'));
    await writeFile(finalPath, buffer);

    return finalPath;
  }

  private resolvePath(outputPath?: string, filename?: string): string {
    if (!outputPath) {
      // Save to current directory
      return resolve(process.cwd(), filename!);
    }

    const resolvedPath = resolve(outputPath);

    // Check if it's a directory or a file
    if (outputPath.endsWith('/') || (!extname(outputPath) && existsSync(resolvedPath))) {
      // It's a directory
      return join(resolvedPath, filename!);
    } else {
      // It's a specific file path
      return resolvedPath;
    }
  }

  private async addWatermark(
    imageBuffer: Buffer,
    watermarkPath: string,
    position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' = 'bottom-right'
  ): Promise<Buffer> {
    const resolvedWatermarkPath = resolve(watermarkPath);

    // Get image dimensions
    const imageInfo = await sharp(imageBuffer).metadata();
    const imageWidth = imageInfo.width || 1024;
    const imageHeight = imageInfo.height || 1024;

    // Calculate watermark size (25% of image width, maintaining aspect ratio)
    const watermarkSize = Math.floor(imageWidth * 0.25);

    // Resize watermark and get actual dimensions
    const processedWatermark = await sharp(resolvedWatermarkPath)
      .resize(watermarkSize, watermarkSize, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .toBuffer();

    // Get actual dimensions of the processed watermark
    const watermarkInfo = await sharp(processedWatermark).metadata();
    const watermarkWidth = watermarkInfo.width || watermarkSize;
    const watermarkHeight = watermarkInfo.height || watermarkSize;

    // Add watermark in selected corner with consistent padding
    const padding = Math.floor(imageWidth * 0.03); // 3% of image width for consistent spacing
    let left = padding;
    let top = padding;
    const isRight = position.endsWith('right');
    const isBottom = position.startsWith('bottom');
    if (isRight) {
      left = imageWidth - watermarkWidth - padding;
    }
    if (isBottom) {
      top = imageHeight - watermarkHeight - padding;
    }

    return await sharp(imageBuffer)
      .composite([
        {
          input: processedWatermark,
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
