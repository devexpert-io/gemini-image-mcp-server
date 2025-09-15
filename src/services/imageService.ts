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
  logoPath?: string;
}

export class ImageService {
  async saveImage(imageData: ImageData, options: SaveImageOptions = {}): Promise<string> {
    const { outputPath, description, logoPath } = options;

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

    // Add watermark if logoPath is provided
    if (logoPath && existsSync(resolve(logoPath))) {
      buffer = Buffer.from(await this.addWatermark(buffer, logoPath));
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