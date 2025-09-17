export interface GenerateImageArgs {
  description: string;
  aspectRatio?: '1:1' | '16:9' | '9:16' | '4:3' | '3:4';
  style?: string;
  outputPath?: string;
  watermarkPath?: string;
  watermarkPosition?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  images?: string[]; // Optional array of image paths used as visual context
}
