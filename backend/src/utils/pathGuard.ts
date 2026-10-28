import path from 'path';

/**
 * Resolves a user-supplied file path and ensures it lives inside repoRoot.
 * Throws if the resolved path escapes the root — this blocks path traversal
 * attacks like "../../etc/passwd".
 */
export function assertWithinRepo(repoRoot: string, filePath: string): string {
  const resolvedRoot = path.resolve(repoRoot);
  // Resolve relative to root so callers can pass relative or absolute paths
  const resolvedFile = path.isAbsolute(filePath)
    ? path.resolve(filePath)
    : path.resolve(repoRoot, filePath);

  const rootWithSep = resolvedRoot.endsWith(path.sep)
    ? resolvedRoot
    : resolvedRoot + path.sep;

  if (resolvedFile !== resolvedRoot && !resolvedFile.startsWith(rootWithSep)) {
    throw new Error(
      `Security: path "${filePath}" resolves outside the repository root`
    );
  }

  return resolvedFile;
}

export function toRelative(repoRoot: string, absolutePath: string): string {
  return path.relative(path.resolve(repoRoot), absolutePath);
}
