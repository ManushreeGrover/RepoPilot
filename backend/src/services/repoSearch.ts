import fs from 'fs';
import path from 'path';
import ignore from 'ignore';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SearchMatch {
  file: string;       // relative path from repo root
  line: number;       // 1-based line number
  column: number;     // 1-based column
  content: string;    // the matching line (trimmed)
  before: string[];   // up to 2 lines before
  after: string[];    // up to 2 lines after
}

export interface SearchOptions {
  caseSensitive?: boolean;
  maxResults?: number;
  filePattern?: string; // e.g. "*.ts" (not a full glob — just extension matching for now)
}

// ─── Constants ───────────────────────────────────────────────────────────────

const ALWAYS_IGNORE_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', 'out', '__pycache__',
  '.next', '.nuxt', 'coverage', '.nyc_output', 'vendor', '.cache',
  '.parcel-cache', '.turbo', 'tmp', 'temp',
  // Python virtual environments
  '.venv', 'venv', 'env', '.env', 'virtualenv', 'site-packages',
  // Tool/config directories — not application code
  '.claude', '.cursor', '.idea', '.vscode',
]);

const TEXT_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  '.py', '.go', '.rs', '.java', '.rb', '.php', '.cs', '.cpp', '.cc', '.c', '.h',
  '.swift', '.kt', '.scala', '.vue', '.svelte', '.sh', '.bash',
  '.html', '.css', '.scss', '.sass', '.less',
  '.json', '.yaml', '.yml', '.toml', '.xml',
  '.md', '.txt', '.sql', '.graphql', '.env.example', '.env.sample',
]);

const MAX_FILE_SIZE = 500_000; // 500 KB — skip larger files during search
const DEFAULT_MAX_RESULTS = 100;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isTextFile(filePath: string, sizeBytes: number): boolean {
  if (sizeBytes > MAX_FILE_SIZE) return false;
  const ext = path.extname(filePath).toLowerCase();
  if (TEXT_EXTENSIONS.has(ext)) return true;
  // Files with no extension but common names
  const base = path.basename(filePath);
  return ['Makefile', 'Dockerfile', 'Jenkinsfile', '.gitignore', '.env.example'].includes(base);
}

function buildIgnoreFilter(rootPath: string) {
  const ig = ignore();
  const gitignorePath = path.join(rootPath, '.gitignore');
  if (fs.existsSync(gitignorePath)) {
    try { ig.add(fs.readFileSync(gitignorePath, 'utf8')); } catch { /* skip */ }
  }
  return ig;
}

// ─── Walker ──────────────────────────────────────────────────────────────────

interface FileEntry {
  absolutePath: string;
  relativePath: string;
  sizeBytes: number;
}

function collectFiles(
  dirPath: string,
  ig: ReturnType<typeof ignore>,
  repoRoot: string,
  maxDepth = 12,
  depth = 0
): FileEntry[] {
  if (depth > maxDepth) return [];
  const results: FileEntry[] = [];

  let entries: fs.Dirent[];
  try { entries = fs.readdirSync(dirPath, { withFileTypes: true }); }
  catch { return results; }

  for (const entry of entries) {
    if (entry.isSymbolicLink()) continue;
    const abs = path.join(dirPath, entry.name);
    const rel = path.relative(path.resolve(repoRoot), abs);

    if (entry.isDirectory()) {
      if (ALWAYS_IGNORE_DIRS.has(entry.name)) continue;
      if (ig.ignores(rel + '/')) continue;
      results.push(...collectFiles(abs, ig, repoRoot, maxDepth, depth + 1));
    } else if (entry.isFile()) {
      if (ig.ignores(rel)) continue;
      try {
        const { size } = fs.statSync(abs);
        results.push({ absolutePath: abs, relativePath: rel, sizeBytes: size });
      } catch { /* skip */ }
    }
  }
  return results;
}

// ─── Core search ─────────────────────────────────────────────────────────────

export function searchRepository(
  rootPath: string,
  query: string,
  options: SearchOptions = {}
): SearchMatch[] {
  if (!query || query.trim().length === 0) return [];

  const { caseSensitive = false, maxResults = DEFAULT_MAX_RESULTS, filePattern } = options;

  const ig = buildIgnoreFilter(rootPath);
  const allFiles = collectFiles(rootPath, ig, rootPath);
  const results: SearchMatch[] = [];

  const searchTerm = caseSensitive ? query : query.toLowerCase();
  // If caller passes "*.ts" style pattern, we just match the extension
  const extFilter = filePattern?.startsWith('*.')
    ? filePattern.slice(1).toLowerCase()
    : null;

  for (const file of allFiles) {
    if (results.length >= maxResults) break;
    if (!isTextFile(file.relativePath, file.sizeBytes)) continue;
    if (extFilter && !file.relativePath.toLowerCase().endsWith(extFilter)) continue;

    let content: string;
    try { content = fs.readFileSync(file.absolutePath, 'utf8'); }
    catch { continue; }

    // Binary file sniff — look for null bytes in first 8 KB
    if (content.slice(0, 8192).includes('\0')) continue;

    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      if (results.length >= maxResults) break;

      const line = lines[i];
      const lineToSearch = caseSensitive ? line : line.toLowerCase();
      const col = lineToSearch.indexOf(searchTerm);
      if (col === -1) continue;

      results.push({
        file: file.relativePath.replace(/\\/g, '/'),
        line: i + 1,
        column: col + 1,
        content: line.trim(),
        before: lines.slice(Math.max(0, i - 2), i).map(l => l.trim()),
        after: lines.slice(i + 1, Math.min(lines.length, i + 3)).map(l => l.trim()),
      });
    }
  }

  return results;
}
