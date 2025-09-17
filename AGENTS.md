# Repository Guidelines

## Project Structure & Module Organization
- `src/index.ts`: MCP server entry (stdio transport).
- `src/services/`: Core services (`gemini.ts`, `imageService.ts`).
- `src/tools/`: Tool definitions and handlers (`generateImage.ts`, `index.ts`).
- `src/types/`: Shared TypeScript types.
- `dist/`: Compiled JS output (entry: `dist/index.js`).
- `.env.example`: Environment variable template.

## Build, Test, and Development Commands
- `npm run build`: Compile TypeScript → `dist/` via `tsc`.
- `npm run dev`: TypeScript watch compile (no auto-runner).
- `npm start`: Run compiled server (`node dist/index.js`).

Example local run:
```bash
GOOGLE_API_KEY=your-key npm run build && npm start
```

## Coding Style & Naming Conventions
- Language: TypeScript (Node >= 18, ESM).
- Imports: Use explicit `.js` extensions in source (ESM-compatible output), e.g. `import { X } from './services/gemini.js'`.
- Indentation: 2 spaces; avoid tabs.
- Naming: `camelCase` for vars/functions, `PascalCase` for classes, file names `camelCase.ts` (e.g., `imageService.ts`).
- Keep modules focused: services = external APIs/IO; tools = MCP schemas + handlers; types = DTOs.

## Testing Guidelines
- No test framework configured yet. If adding tests, propose the tooling in the PR and place tests near sources (e.g., `src/**/__tests__/*.test.ts`).
- Provide manual verification steps (inputs, expected outputs, saved image paths) for image tools.

## Commit & Pull Request Guidelines
- Commits: Imperative, concise subject (e.g., “Add watermark functionality”, “Refactor services”). Include rationale in body when non-trivial.
- PRs must include:
  - Summary of changes and motivation.
  - Steps to run and verify (`GOOGLE_API_KEY`, commands, sample tool calls).
  - Screenshots or sample outputs when affecting generated/edited images.
  - Any config updates (`README.md`, `.env.example`).
- Keep changes minimal and scoped; follow existing file layout.

## Security & Configuration Tips
- Required env: `GOOGLE_API_KEY` (do not commit keys). Use `.env.example` as reference.
- Large file handling: image outputs are written to disk; prefer relative `outputPath` under a dedicated folder (e.g., `./images/`).
- Watermarks: optional via `logoPath`; ensure assets are licensed for use.

## Architecture Overview
- MCP server exposes one tool: `generate_image` (accepts optional `images[]` as visual context).
- `GeminiService` wraps Google Generative AI; `ImageService` manages saving and optional watermarking.
