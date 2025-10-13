import { GeminiService } from './gemini.js';
import { ImageService } from './imageService.js';

export interface GeminiImageServices {
  geminiService: GeminiService;
  imageService: ImageService;
}

class MissingEnvironmentError extends Error {
  constructor(variableName: string) {
    super(`${variableName} environment variable is required`);
    this.name = 'MissingEnvironmentError';
  }
}

export function createGeminiImageServices(): GeminiImageServices {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new MissingEnvironmentError('GOOGLE_API_KEY');
  }

  return {
    geminiService: new GeminiService(apiKey),
    imageService: new ImageService(),
  };
}

export { MissingEnvironmentError };
