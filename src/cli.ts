#!/usr/bin/env node

import { McpError } from '@modelcontextprotocol/sdk/types.js';

import { createRequire } from 'module';

import { createGeminiImageServices, MissingEnvironmentError } from './services/serviceFactory.js';
import { handleEditImage, handleGenerateImage } from './tools/index.js';
import type { EditImageArgs, GenerateImageArgs } from './types/index.js';

type CommandName = 'generate' | 'edit';

const require = createRequire(import.meta.url);
const packageJson = require('../package.json') as { version?: string };

interface CommandContext {
  args: string[];
}

interface GenerateCommandOptions {
  prompt: string;
  aspect?: 'square' | 'portrait' | 'landscape';
  style?: string;
  contexts: string[];
  output?: string;
  watermark?: string;
  watermarkPosition?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
}

interface EditCommandOptions {
  prompt: string;
  input: string;
  output?: string;
}

const SUPPORTED_ASPECTS = new Set(['square', 'landscape', 'portrait']);
const SUPPORTED_WATERMARK_POSITIONS = new Set([
  'top-left',
  'top-right',
  'bottom-left',
  'bottom-right',
]);

async function main() {
  const context: CommandContext = { args: process.argv.slice(2) };

  if (context.args.length === 0) {
    printGlobalHelp();
    return;
  }

  const firstArg = context.args[0];
  if (isHelpFlag(firstArg)) {
    printGlobalHelp();
    return;
  }

  if (isVersionFlag(firstArg)) {
    printVersion();
    return;
  }

  const commandName = firstArg as CommandName;
  if (!isSupportedCommand(commandName)) {
    console.error(`Unknown command: ${firstArg}`);
    printGlobalHelp();
    process.exitCode = 1;
    return;
  }

  const commandArgs = context.args.slice(1);
  if (commandArgs.some(isVersionFlag)) {
    printVersion();
    return;
  }

  if (commandArgs.some(isHelpFlag)) {
    printCommandHelp(commandName);
    return;
  }

  try {
    switch (commandName) {
      case 'generate':
        await runGenerate(commandArgs);
        break;
      case 'edit':
        await runEdit(commandArgs);
        break;
      default:
        // This should never happen due to earlier checks.
        throw new Error(`Unsupported command: ${commandName}`);
    }
  } catch (error) {
    handleCommandError(error, commandName);
  }
}

function isSupportedCommand(command: string): command is CommandName {
  return command === 'generate' || command === 'edit';
}

function isHelpFlag(value: string): boolean {
  return value === '--help' || value === '-h';
}

function isVersionFlag(value: string): boolean {
  return value === '--version' || value === '-v';
}

function printVersion() {
  const version = packageJson.version ?? '0.0.0';
  console.log(version);
}

function printGlobalHelp() {
  console.log(
    [
      `Usage: gemini-image <command> [options]`,
      '',
      'Commands:',
      '  generate   Create a new image with Google Gemini.',
      '  edit       Modify an existing image with Google Gemini.',
      '',
      'Global Options:',
      '  -h, --help     Show this help message.',
      '  -v, --version  Show the CLI version.',
      '',
      'Environment:',
      '  GOOGLE_API_KEY must be set before running any command.',
      '',
      `Run 'gemini-image <command> --help' for command-specific options.`,
    ].join('\n')
  );
}

function printCommandHelp(command: CommandName) {
  if (command === 'generate') {
    printGenerateHelp();
    return;
  }
  printEditHelp();
}

function printGenerateHelp() {
  console.log(
    [
      'Usage: gemini-image generate --prompt "<description>" [options]',
      '',
      'Options:',
      '  -p, --prompt <text>          Detailed description of the image to create. (required)',
      '  -a, --aspect <ratio>         Aspect ratio: square, landscape, or portrait. Defaults to square.',
      '  -s, --style <style>          Optional artistic style hint.',
      '  -c, --context <path>         Reference image to guide generation. Repeat for multiple images.',
      '  -o, --output <path>          Where to save the generated image. Defaults to current directory.',
      '      --watermark <path>       Apply a watermark image over the result.',
      '      --watermark-position <p> Position for the watermark: top-left, top-right, bottom-left, bottom-right.',
      '  -h, --help                   Show this help message.',
      '',
      'Examples:',
      '  gemini-image generate --prompt "A banana astronaut on Mars" --output ./images/',
      '  gemini-image generate -p "A watercolor landscape" -a landscape --style "watercolor"',
      '  gemini-image generate -p "Product shot" -c ./context.png --watermark ./logo.png',
    ].join('\n')
  );
}

function printEditHelp() {
  console.log(
    [
      'Usage: gemini-image edit --prompt "<instructions>" --input <imagePath> [options]',
      '',
      'Options:',
      '  -p, --prompt <text>   Instructions describing the desired edits. (required)',
      '  -i, --input <path>    Path to the source image to edit. (required)',
      '  -o, --output <path>   Where to save the edited image. Defaults to current directory.',
      '  -h, --help            Show this help message.',
      '',
      'Example:',
      '  gemini-image edit -p "Add neon lights to the skyline" -i ./city.png -o ./images/city-neon.png',
    ].join('\n')
  );
}

async function runGenerate(rawArgs: string[]) {
  const parsed = parseGenerateCommand(rawArgs);
  const services = createServicesOrExit();
  if (!services) {
    return;
  }

  const { geminiService, imageService } = services;

  const args: GenerateImageArgs = {
    description: parsed.prompt.trim(),
    aspectRatio: parsed.aspect,
    style: parsed.style,
    outputPath: parsed.output,
    watermarkPath: parsed.watermark,
    watermarkPosition: parsed.watermarkPosition ?? (parsed.watermark ? 'bottom-right' : undefined),
    images: parsed.contexts.length > 0 ? parsed.contexts : undefined,
  };

  const result = await handleGenerateImage(args, geminiService, imageService);
  const filePath = extractTextContent(result);
  if (!filePath) {
    console.error('Image generated, but no output path was returned.');
    process.exitCode = 1;
    return;
  }
  console.log(`Saved image to ${filePath}`);
}

async function runEdit(rawArgs: string[]) {
  const parsed = parseEditCommand(rawArgs);
  const services = createServicesOrExit();
  if (!services) {
    return;
  }

  const { geminiService, imageService } = services;

  const args: EditImageArgs = {
    description: parsed.prompt.trim(),
    image: parsed.input,
    outputPath: parsed.output,
  };

  const result = await handleEditImage(args, geminiService, imageService);
  const filePath = extractTextContent(result);
  if (!filePath) {
    console.error('Image edited, but no output path was returned.');
    process.exitCode = 1;
    return;
  }
  console.log(`Saved image to ${filePath}`);
}

function parseGenerateCommand(args: string[]): GenerateCommandOptions {
  const options: GenerateCommandOptions = {
    prompt: '',
    contexts: [],
  };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];

    if (isHelpFlag(arg)) {
      printGenerateHelp();
      process.exit(0);
    }

    if (arg.startsWith('--prompt=')) {
      options.prompt = arg.slice('--prompt='.length);
      continue;
    }
    if (arg === '--prompt' || arg === '-p') {
      const { value, nextIndex } = requireOptionValue(args, i, '--prompt');
      options.prompt = value;
      i = nextIndex;
      continue;
    }

    if (arg.startsWith('--aspect=')) {
      options.aspect = parseAspect(arg.slice('--aspect='.length));
      continue;
    }
    if (arg === '--aspect' || arg === '-a') {
      const { value, nextIndex } = requireOptionValue(args, i, '--aspect');
      options.aspect = parseAspect(value);
      i = nextIndex;
      continue;
    }

    if (arg.startsWith('--style=')) {
      options.style = arg.slice('--style='.length);
      continue;
    }
    if (arg === '--style' || arg === '-s') {
      const { value, nextIndex } = requireOptionValue(args, i, '--style');
      options.style = value;
      i = nextIndex;
      continue;
    }

    if (arg.startsWith('--context=')) {
      options.contexts.push(arg.slice('--context='.length));
      continue;
    }
    if (arg === '--context' || arg === '-c') {
      const { value, nextIndex } = requireOptionValue(args, i, '--context');
      options.contexts.push(value);
      i = nextIndex;
      continue;
    }

    if (arg.startsWith('--output=')) {
      options.output = arg.slice('--output='.length);
      continue;
    }
    if (arg === '--output' || arg === '-o') {
      const { value, nextIndex } = requireOptionValue(args, i, '--output');
      options.output = value;
      i = nextIndex;
      continue;
    }

    if (arg.startsWith('--watermark=')) {
      options.watermark = arg.slice('--watermark='.length);
      continue;
    }
    if (arg === '--watermark') {
      const { value, nextIndex } = requireOptionValue(args, i, '--watermark');
      options.watermark = value;
      i = nextIndex;
      continue;
    }

    if (arg.startsWith('--watermark-position=')) {
      options.watermarkPosition = parseWatermarkPosition(
        arg.slice('--watermark-position='.length)
      );
      continue;
    }
    if (arg === '--watermark-position') {
      const { value, nextIndex } = requireOptionValue(args, i, '--watermark-position');
      options.watermarkPosition = parseWatermarkPosition(value);
      i = nextIndex;
      continue;
    }

    throw new Error(`Unknown option for generate command: ${arg}`);
  }

  if (!options.prompt.trim()) {
    throw new Error('Missing required option: --prompt');
  }

  return options;
}

function parseEditCommand(args: string[]): EditCommandOptions {
  const options: EditCommandOptions = {
    prompt: '',
    input: '',
  };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];

    if (isHelpFlag(arg)) {
      printEditHelp();
      process.exit(0);
    }

    if (arg.startsWith('--prompt=')) {
      options.prompt = arg.slice('--prompt='.length);
      continue;
    }
    if (arg === '--prompt' || arg === '-p') {
      const { value, nextIndex } = requireOptionValue(args, i, '--prompt');
      options.prompt = value;
      i = nextIndex;
      continue;
    }

    if (arg.startsWith('--input=')) {
      options.input = arg.slice('--input='.length);
      continue;
    }
    if (arg === '--input' || arg === '-i') {
      const { value, nextIndex } = requireOptionValue(args, i, '--input');
      options.input = value;
      i = nextIndex;
      continue;
    }

    if (arg.startsWith('--output=')) {
      options.output = arg.slice('--output='.length);
      continue;
    }
    if (arg === '--output' || arg === '-o') {
      const { value, nextIndex } = requireOptionValue(args, i, '--output');
      options.output = value;
      i = nextIndex;
      continue;
    }

    throw new Error(`Unknown option for edit command: ${arg}`);
  }

  if (!options.prompt.trim()) {
    throw new Error('Missing required option: --prompt');
  }
  if (!options.input.trim()) {
    throw new Error('Missing required option: --input');
  }

  return options;
}

function requireOptionValue(args: string[], index: number, optionName: string): {
  value: string;
  nextIndex: number;
} {
  const currentArg = args[index];
  const equalsIndex = currentArg.indexOf('=');
  if (equalsIndex > -1) {
    return {
      value: currentArg.slice(equalsIndex + 1),
      nextIndex: index,
    };
  }

  const nextValue = args[index + 1];
  if (nextValue === undefined) {
    throw new Error(`Option ${optionName} requires a value.`);
  }

  return {
    value: nextValue,
    nextIndex: index + 1,
  };
}

function parseAspect(value: string): 'square' | 'landscape' | 'portrait' {
  if (!SUPPORTED_ASPECTS.has(value)) {
    throw new Error(`Invalid aspect ratio: ${value}. Expected square, landscape, or portrait.`);
  }
  return value as 'square' | 'landscape' | 'portrait';
}

function parseWatermarkPosition(
  value: string
): 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' {
  if (!SUPPORTED_WATERMARK_POSITIONS.has(value)) {
    throw new Error(
      `Invalid watermark position: ${value}. Expected top-left, top-right, bottom-left, or bottom-right.`
    );
  }
  return value as 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
}

function extractTextContent(result: { content?: Array<{ type: string; text?: string }> }): string | null {
  if (!result.content) {
    return null;
  }
  for (const item of result.content) {
    if (item.type === 'text' && typeof item.text === 'string') {
      return item.text;
    }
  }
  return null;
}

function createServicesOrExit() {
  try {
    return createGeminiImageServices();
  } catch (error) {
    if (error instanceof MissingEnvironmentError) {
      console.error(`Error: ${error.message}`);
    } else if (error instanceof Error) {
      console.error(`Error: ${error.message}`);
    } else {
      console.error(`Error: ${String(error)}`);
    }
    process.exitCode = 1;
    return null;
  }
}

function handleCommandError(error: unknown, command: CommandName) {
  if (error instanceof McpError) {
    const cleanMessage = sanitizeMcpErrorMessage(error.message);
    console.error(`[${command}] ${cleanMessage}`);
    printErrorDetails(error.data);
    process.exitCode = 1;
    return;
  }

  if (error instanceof Error) {
    console.error(`[${command}] ${error.message}`);
    process.exitCode = 1;
    return;
  }

  console.error(`[${command}] ${String(error)}`);
  process.exitCode = 1;
}

function extractErrorCause(data: unknown): string | null {
  if (!data || typeof data !== 'object') {
    return null;
  }

  const record = data as Record<string, unknown>;
  if (!('cause' in record) || record.cause === undefined || record.cause === null) {
    return null;
  }

  return String(record.cause);
}

function sanitizeMcpErrorMessage(message: string): string {
  const match = /^MCP error [^:]+: (.*)$/.exec(message);
  if (match) {
    return match[1];
  }
  return message;
}

function printErrorDetails(data: unknown) {
  const pairs = formatErrorData(data);
  const cause = extractErrorCause(data);

  if (cause) {
    console.error(`Cause: ${cause}`);
  }

  if (pairs.length > 0) {
    console.error('Details:');
    for (const pair of pairs) {
      console.error(`  - ${pair}`);
    }
  }
}

function formatErrorData(data: unknown): string[] {
  if (!data || typeof data !== 'object') {
    return [];
  }

  const record = data as Record<string, unknown>;
  const excludedKeys = new Set(['cause']);

  return Object.entries(record)
    .filter(([key]) => !excludedKeys.has(key))
    .map(([key, value]) => `${key}: ${String(value)}`);
}

main().catch((error) => {
  if (error instanceof Error) {
    console.error(error.message);
  } else {
    console.error(String(error));
  }
  process.exitCode = 1;
});
