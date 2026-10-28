import fs from 'fs';
import path from 'path';
import { assertWithinRepo, toRelative } from '../utils/pathGuard.js';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface FileContent {
  relativePath: string;
  absolutePath: string;
  language: string;
  sizeBytes: number;
  totalLines: number;
  lines: LineEntry[];
  isTruncated: boolean;
}

export interface LineEntry {
  number: number; // 1-based
  content: string;
}

export interface ReadOptions {
  startLine?: number; // 1-based, inclusive
  endLine?: number;   // 1-based, inclusive
  maxLines?: number;  // cap on how many lines to return (default 500)
}

// ─── Constants ───────────────────────────────────────────────────────────────

const MAX_FILE_SIZE = 1_048_576; // 1 MB hard limit
const DEFAULT_MAX_LINES = 500;

const EXTENSION_TO_LANGUAGE: Record<string, string> = {
  '.ts': 'typescript', '.tsx': 'typescript',
  '.js': 'javascript', '.jsx': 'javascript', '.mjs': 'javascript',
  '.py': 'python',
  '.go': 'go',
  '.rs': 'rust',
  '.java': 'java',
  '.rb': 'ruby',
  '.php': 'php',
  '.cs': 'csharp',
  '.cpp': 'cpp', '.cc': 'cpp', '.cxx': 'cpp',
  '.c': 'c', '.h': 'c',
  '.swift': 'swift',
  '.kt': 'kotlin',
  '.vue': 'html',
  '.svelte': 'html',
  '.html': 'html',
  '.css': 'css', '.scss': 'css', '.sass': 'css', '.less': 'css',
  '.json': 'json',
  '.yaml': 'yaml', '.yml': 'yaml',
  '.md': 'markdown',
  '.sql': 'sql',
  '.sh': 'bash', '.bash': 'bash',
  '.toml': 'toml',
  '.xml': 'xml',
  '.graphql': 'graphql',
};

// Files we will never read (secrets, binaries, etc.)
const BLOCKED_NAMES = new Set([
  '.env', '.env.local', '.env.production', '.env.development',
  'id_rsa', 'id_ed25519', 'id_dsa', '*.pem', '*.key', '*.p12',
]);

const BLOCKED_EXTENSIONS = new Set([
  '.exe', '.dll', '.so', '.dylib', '.bin',
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.ico', '.svg',
  '.mp3', '.mp4', '.mov', '.avi', '.wav',
  '.zip', '.tar', '.gz', '.rar', '.7z',
  '.pdf', '.docx', '.xlsx', '.pptx',
  '.woff', '.woff2', '.ttf', '.eot',
  '.map', // source maps can be very large
]);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getLanguage(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  return EXTENSION_TO_LANGUAGE[ext] ?? 'plaintext';
}

function isBlocked(filePath: string): boolean {
  const base = path.basename(filePath);
  const ext = path.extname(filePath).toLowerCase();
  if (BLOCKED_EXTENSIONS.has(ext)) return true;
  if (BLOCKED_NAMES.has(base)) return true;
  // Block any file literally named ".env" regardless of extension
  if (base === '.env') return true;
  return false;
}

// ─── Main export ─────────────────────────────────────────────────────────────

export function readFile(
  repoRoot: string,
  filePath: string,
  options: ReadOptions = {}
): FileContent {
  // Security: confirm path is within the repo
  const absolutePath = assertWithinRepo(repoRoot, filePath);
  const relativePath = toRelative(repoRoot, absolutePath).replace(/\\/g, '/');

  if (isBlocked(absolutePath)) {
    throw new Error(`Reading this file type is not allowed: ${relativePath}`);
  }

  let stat: fs.Stats;
  try {
    stat = fs.statSync(absolutePath);
  } catch {
    throw new Error(`File not found: ${relativePath}`);
  }

  if (!stat.isFile()) {
    throw new Error(`Path is not a file: ${relativePath}`);
  }

  if (stat.size > MAX_FILE_SIZE) {
    throw new Error(
      `File is too large to display (${(stat.size / 1024).toFixed(0)} KB). Maximum is 1 MB.`
    );
  }

  let raw: string;
  try {
    raw = fs.readFileSync(absolutePath, 'utf8');
  } catch {
    throw new Error(`Could not read file: ${relativePath}`);
  }

  // Binary file check
  if (raw.slice(0, 8192).includes('\0')) {
    throw new Error(`File appears to be binary: ${relativePath}`);
  }

  const allLines = raw.split('\n');
  const totalLines = allLines.length;

  const maxLines = options.maxLines ?? DEFAULT_MAX_LINES;
  const start = Math.max(1, options.startLine ?? 1);
  const rawEnd = options.endLine ?? start + maxLines - 1;
  const end = Math.min(totalLines, rawEnd);
  const isTruncated = end < totalLines && !options.endLine;

  const lines: LineEntry[] = allLines
    .slice(start - 1, end)
    .map((content, idx) => ({ number: start + idx, content }));

  return {
    relativePath,
    absolutePath,
    language: getLanguage(absolutePath),
    sizeBytes: stat.size,
    totalLines,
    lines,
    isTruncated,
  };
}
