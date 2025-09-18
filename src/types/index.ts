export interface GenerateImageArgs {
  description: string;
  aspectRatio?: 'square' | 'portrait' | 'landscape';
  style?: string;
  outputPath?: string;
  watermarkPath?: string;
  watermarkPosition?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  images?: string[]; // Optional array of image paths used as visual context
}
