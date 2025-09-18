import { access, cp, mkdir } from 'node:fs/promises';
import { constants } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '..');
const sourceDir = resolve(projectRoot, 'assets');
const targetDir = resolve(projectRoot, 'dist', 'assets');

async function ensureDir(path) {
  await mkdir(path, { recursive: true });
}

async function main() {
  try {
    await access(sourceDir, constants.F_OK);
  } catch {
    // Nothing to copy if assets directory is missing.
    return;
  }

  await ensureDir(targetDir);
  await cp(sourceDir, targetDir, { recursive: true, force: true });
}

main().catch((error) => {
  console.error('Failed to copy asset files into dist:', error);
  process.exitCode = 1;
});
