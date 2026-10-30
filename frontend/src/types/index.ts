// ─── Shared types (mirror what the backend returns) ─────────────────────────

export interface FileRef {
  relativePath: string;
  absolutePath: string;
}

export interface LanguageInfo {
  name: string;
  fileCount: number;
  percentage: number;
}

export interface DirectoryInfo {
  name: string;
  relativePath: string;
  description: string;
  fileCount: number;
}

export interface ApiRoute {
  method: string;
  path: string;
  file: string;
  line: number;
}

export interface RepoOverview {
  name: string;
  rootPath: string;
  languages: LanguageInfo[];
  frameworks: string[];
  entryPoints: FileRef[];
  configFiles: FileRef[];
  directories: DirectoryInfo[];
  totalFiles: number;
  hasTests: boolean;
  testLocations: string[];
  apiRoutes: ApiRoute[];
  packageManager: string | null;
  runCommands: string[];
  readmePreview: string | null;
}

export interface SearchMatch {
  file: string;
  line: number;
  column: number;
  content: string;
  before: string[];
  after: string[];
}

export interface SearchResult {
  query: string;
  results: SearchMatch[];
  total: number;
}

export interface LineEntry {
  number: number;
  content: string;
}

export interface FileContent {
  relativePath: string;
  absolutePath: string;
  language: string;
  sizeBytes: number;
  totalLines: number;
  lines: LineEntry[];
  isTruncated: boolean;
}

export interface Citation {
  file: string;
  line: number;
  snippet: string;
}

export interface AiAnswer {
  answer: string;
  citations: Citation[];
}

export interface AiEnhancement {
  frameworks: string[];
  entryPoints: Array<{ relativePath: string; description: string }>;
  routes: Array<{ method: string; path: string; file: string; line: number }>;
  runCommands: string[];
}
