export interface GenerateImageArgs {
  description: string;
  aspectRatio?: '1:1' | '16:9' | '9:16' | '4:3' | '3:4';
  style?: string;
  outputPath?: string;
  logoPath?: string;
}

export interface EditImageArgs {
  imagePath: string;
  description: string;
  outputPath?: string;
  logoPath?: string;
}

export interface ImageResult {
  base64: string;
  mimeType: string;
  filePath: string;
}