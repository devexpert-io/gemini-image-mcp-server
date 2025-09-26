import { GoogleGenerativeAI, HarmBlockThreshold, HarmCategory } from '@google/generative-ai';
import { readFile } from 'fs/promises';
import { extname, isAbsolute, resolve } from 'path';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { ErrorCode } from '@modelcontextprotocol/sdk/types.js';

import { ensureMcpError, internalError, invalidParams } from '../utils/errors.js';
import { GenerateImageArgs } from '../types';

const ASPECT_HELPER_IMAGES = {
    square: fileURLToPath(new URL('../../assets/square.png', import.meta.url)),
    landscape: fileURLToPath(new URL('../../assets/landscape.png', import.meta.url)),
    portrait: fileURLToPath(new URL('../../assets/portrait.png', import.meta.url))
} as const;

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
        const aspectRatio = (args.aspectRatio ?? 'square') as 'square' | 'portrait' | 'landscape';
        const helperPath = ASPECT_HELPER_IMAGES[aspectRatio];
        return this._generateImageInternal(args, helperPath);
    }

    async editImage(args: GenerateImageArgs): Promise<ImageData> {
        // When editing, don't use aspect ratio helper to preserve original dimensions
        return this._generateImageInternal(args, null);
    }

    private async _generateImageInternal(args: GenerateImageArgs, helperPath: string | null): Promise<ImageData> {
        // Build optimized prompt for image generation
        let fullPrompt = `${args.description}`;

        // Add style if specified
        if (args.style) {
            fullPrompt += ` The style should be ${args.style}.`;
        }

        if (helperPath) {
            fullPrompt += '. Use the white image only as a guide for the aspect ratio.';
        }

        const model = this.genAI.getGenerativeModel({
            model: 'gemini-2.5-flash-image-preview',
            safetySettings: this.getSafetySettings()
        });

        // If images are provided as context, attach them as inline parts
        const parts: any[] = [{ text: fullPrompt }];

        if (args.images) {
            for (const userImage of args.images) {
                parts.push(await toInlinePart(userImage));
            }
        }

        if (helperPath) {
            parts.push(await toInlinePart(helperPath));
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
            const finishReason = candidate?.finishReason ?? 'unknown';

            throw internalError(`Gemini finish reason: ${String(finishReason)}`, {
                reason: 'emptyCandidate',
                finishReason,
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
}

type InlinePart = { inlineData: { mimeType: string; data: string } };

async function toInlinePart(imgPathRaw: string): Promise<InlinePart> {
    const imagePath = isAbsolute(imgPathRaw) ? imgPathRaw : resolve(imgPathRaw);
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

    return { inlineData: { mimeType, data: base64 } };
}
