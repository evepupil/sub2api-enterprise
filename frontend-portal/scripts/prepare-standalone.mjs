import { cp, lstat, mkdir, realpath, stat } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDirectory, '..');
const buildRoot = resolve(projectRoot, '.next-build');
const standaloneRoot = resolve(buildRoot, 'standalone');

function isWithin(root, candidate) {
  const relativePath = relative(root, candidate);
  return (
    relativePath === '' ||
    (!isAbsolute(relativePath) && relativePath !== '..' && !relativePath.startsWith(`..${sep}`))
  );
}

function assertWithin(root, candidate, label) {
  if (!isWithin(root, candidate)) {
    throw new Error(`${label} escapes its allowed directory: ${candidate}`);
  }
}

async function assertNoSymlinkInPath(root, candidate, label) {
  assertWithin(root, candidate, label);

  const relativePath = relative(root, candidate);
  let currentPath = root;
  for (const segment of relativePath.split(sep).filter(Boolean)) {
    currentPath = join(currentPath, segment);
    try {
      const entry = await lstat(currentPath);
      if (entry.isSymbolicLink()) {
        throw new Error(`${label} contains a symbolic link: ${currentPath}`);
      }
    } catch (error) {
      if (error?.code === 'ENOENT') {
        break;
      }
      throw error;
    }
  }
}

async function requireDirectory(directory, label) {
  try {
    const entry = await stat(directory);
    if (!entry.isDirectory()) {
      throw new Error(`${label} is not a directory: ${directory}`);
    }
  } catch (error) {
    if (error?.code === 'ENOENT') {
      throw new Error(
        `Missing ${label}: ${directory}. Run \`pnpm build\` before preparing standalone output.`,
      );
    }
    throw error;
  }
}

async function optionalDirectory(directory, label, allowedRoot) {
  try {
    const entry = await lstat(directory);
    if (entry.isSymbolicLink()) {
      throw new Error(`${label} must not be a symbolic link: ${directory}`);
    }
    if (!entry.isDirectory()) {
      throw new Error(`${label} is not a directory: ${directory}`);
    }

    const resolvedDirectory = await realpath(directory);
    const resolvedRoot = await realpath(allowedRoot);
    assertWithin(resolvedRoot, resolvedDirectory, label);
    return true;
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return false;
    }
    throw error;
  }
}

async function copyDirectory(source, destination, label) {
  assertWithin(standaloneRoot, destination, `${label} destination`);
  await assertNoSymlinkInPath(standaloneRoot, destination, `${label} destination`);
  await mkdir(destination, { recursive: true });
  await cp(source, destination, { recursive: true, force: true, errorOnExist: false });
  console.log(`Copied ${label}: ${source} -> ${destination}`);
}

async function main() {
  await requireDirectory(buildRoot, 'Next build output');
  await requireDirectory(standaloneRoot, 'Next standalone output');
  await assertNoSymlinkInPath(projectRoot, buildRoot, 'Next build output');
  await assertNoSymlinkInPath(buildRoot, standaloneRoot, 'Next standalone output');

  const serverFile = join(standaloneRoot, 'server.js');
  const serverEntry = await lstat(serverFile).catch((error) => {
    if (error?.code === 'ENOENT') {
      throw new Error(
        `Missing standalone server entry: ${serverFile}. Run \`pnpm build\` before preparing standalone output.`,
      );
    }
    throw error;
  });
  if (!serverEntry.isFile() || serverEntry.isSymbolicLink()) {
    throw new Error(`Standalone server entry is not a regular file: ${serverFile}`);
  }

  const publicDirectory = join(projectRoot, 'public');
  const staticDirectory = join(buildRoot, 'static');
  const hasPublic = await optionalDirectory(publicDirectory, 'public directory', projectRoot);
  const hasStatic = await optionalDirectory(staticDirectory, 'Next static directory', buildRoot);
  if (!hasStatic) {
    throw new Error('Next static assets are missing. Run `pnpm build` before preparing output.');
  }

  if (hasPublic) {
    await copyDirectory(publicDirectory, join(standaloneRoot, 'public'), 'public assets');
  } else {
    console.log('Skipped public assets: directory does not exist.');
  }

  await copyDirectory(
    staticDirectory,
    join(standaloneRoot, '.next-build', 'static'),
    'Next static assets',
  );
}

main().catch((error) => {
  console.error(
    `Standalone preparation failed: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exitCode = 1;
});
