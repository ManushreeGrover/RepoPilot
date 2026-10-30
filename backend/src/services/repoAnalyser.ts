import fs from 'fs';
import path from 'path';
import ignore, { type Ignore } from 'ignore';

// ─── Types ──────────────────────────────────────────────────────────────────

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

// ─── Constants ──────────────────────────────────────────────────────────────

const EXTENSION_TO_LANGUAGE: Record<string, string> = {
  '.ts': 'TypeScript', '.tsx': 'TypeScript',
  '.js': 'JavaScript', '.jsx': 'JavaScript', '.mjs': 'JavaScript', '.cjs': 'JavaScript',
  '.py': 'Python',
  '.go': 'Go',
  '.rs': 'Rust',
  '.java': 'Java',
  '.rb': 'Ruby',
  '.php': 'PHP',
  '.cs': 'C#',
  '.cpp': 'C++', '.cc': 'C++', '.cxx': 'C++',
  '.c': 'C', '.h': 'C',
  '.swift': 'Swift',
  '.kt': 'Kotlin',
  '.vue': 'Vue',
  '.svelte': 'Svelte',
  '.sh': 'Shell', '.bash': 'Shell', '.zsh': 'Shell',
  '.sql': 'SQL',
  '.html': 'HTML',
  '.css': 'CSS', '.scss': 'CSS', '.sass': 'CSS', '.less': 'CSS',
};

// Always skip these directories no matter what
const ALWAYS_IGNORE_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', 'out', '__pycache__',
  '.next', '.nuxt', 'coverage', '.nyc_output', 'vendor', '.cache',
  '.parcel-cache', '.turbo', 'tmp', 'temp', '.expo', '.svelte-kit',
  // Python virtual environments
  '.venv', 'venv', 'env', '.env', 'virtualenv', 'site-packages',
  // Tool/config directories — not application code
  '.claude', '.cursor', '.idea', '.vscode',
]);

const CONFIG_FILE_NAMES = new Set([
  'package.json', 'tsconfig.json', 'vite.config.ts', 'vite.config.js',
  'webpack.config.js', 'webpack.config.ts', 'rollup.config.js',
  'babel.config.js', '.babelrc', 'jest.config.js', 'jest.config.ts',
  'vitest.config.ts', '.eslintrc.js', '.eslintrc.json', '.prettierrc',
  'Dockerfile', 'docker-compose.yml', 'docker-compose.yaml',
  '.env.example', '.env.sample', 'requirements.txt', 'pyproject.toml',
  'setup.py', 'go.mod', 'Cargo.toml', 'pom.xml', 'build.gradle',
  'Makefile', 'CMakeLists.txt', '.github',
]);

const ENTRY_POINT_PATTERNS = [
  'src/index.ts', 'src/index.js', 'src/main.ts', 'src/main.js',
  'src/app.ts', 'src/app.js', 'src/server.ts', 'src/server.js',
  'index.ts', 'index.js', 'main.ts', 'main.js', 'app.ts', 'app.js',
  'server.ts', 'server.js', 'main.py', 'app.py', 'manage.py',
  'main.go', 'cmd/main.go', 'src/main.rs',
];

const DIR_DESCRIPTIONS: Record<string, string> = {
  src: 'Main source code',
  lib: 'Library / shared utilities',
  app: 'Application code',
  api: 'API handlers or client',
  components: 'UI components',
  pages: 'Page components',
  views: 'View templates',
  models: 'Data models',
  controllers: 'Request handlers',
  services: 'Business logic',
  utils: 'Utility helpers',
  helpers: 'Helper functions',
  middleware: 'HTTP middleware',
  routes: 'Route definitions',
  config: 'Configuration',
  tests: 'Test files',
  __tests__: 'Test files',
  test: 'Test files',
  spec: 'Test specifications',
  docs: 'Documentation',
  public: 'Static / public assets',
  static: 'Static files',
  assets: 'Images, fonts, media',
  migrations: 'Database migrations',
  scripts: 'Build or utility scripts',
  hooks: 'React hooks or Git hooks',
  store: 'State management',
  context: 'React contexts',
  types: 'TypeScript type definitions',
  schemas: 'Data schemas',
  db: 'Database code',
  database: 'Database code',
  repositories: 'Data access layer',
  entities: 'Database entities',
  dto: 'Data transfer objects',
};

// ─── Gitignore helper ────────────────────────────────────────────────────────

function buildIgnoreFilter(rootPath: string): Ignore {
  const ig = ignore();
  const gitignorePath = path.join(rootPath, '.gitignore');
  if (fs.existsSync(gitignorePath)) {
    try {
      ig.add(fs.readFileSync(gitignorePath, 'utf8'));
    } catch {
      // unreadable .gitignore — proceed without it
    }
  }
  return ig;
}

// ─── Directory walker ────────────────────────────────────────────────────────

interface WalkedFile {
  absolutePath: string;
  relativePath: string;
  extension: string;
  sizeBytes: number;
}

function walkDirectory(
  dirPath: string,
  ig: Ignore,
  repoRoot: string,
  maxDepth = 12,
  currentDepth = 0
): WalkedFile[] {
  if (currentDepth > maxDepth) return [];
  const results: WalkedFile[] = [];

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dirPath, { withFileTypes: true });
  } catch {
    return results; // unreadable dir — skip silently
  }

  for (const entry of entries) {
    // Skip symlinks to avoid infinite loops
    if (entry.isSymbolicLink()) continue;

    const absPath = path.join(dirPath, entry.name);
    // Always relative to repo root so paths are consistent across recursion depths
    const relPath = path.relative(path.resolve(repoRoot), absPath);

    if (entry.isDirectory()) {
      if (ALWAYS_IGNORE_DIRS.has(entry.name)) continue;
      if (ig.ignores(relPath + '/')) continue;
      results.push(...walkDirectory(absPath, ig, repoRoot, maxDepth, currentDepth + 1));
    } else if (entry.isFile()) {
      if (ig.ignores(relPath)) continue;
      let sizeBytes = 0;
      try {
        sizeBytes = fs.statSync(absPath).size;
      } catch {
        continue;
      }
      results.push({
        absolutePath: absPath,
        relativePath: relPath,
        extension: path.extname(entry.name).toLowerCase(),
        sizeBytes,
      });
    }
  }

  return results;
}

// ─── Analysis helpers ────────────────────────────────────────────────────────

function detectLanguages(files: WalkedFile[]): LanguageInfo[] {
  const counts = new Map<string, number>();
  let total = 0;

  for (const f of files) {
    const lang = EXTENSION_TO_LANGUAGE[f.extension];
    if (!lang) continue;
    counts.set(lang, (counts.get(lang) ?? 0) + 1);
    total++;
  }

  if (total === 0) return [];

  return [...counts.entries()]
    .map(([name, fileCount]) => ({
      name,
      fileCount,
      percentage: Math.round((fileCount / total) * 100),
    }))
    .sort((a, b) => b.fileCount - a.fileCount);
}

function detectFrameworks(rootPath: string, files: WalkedFile[]): string[] {
  const found: string[] = [];

  // Build a quick lookup: basename → list of matching walked files
  const byName = new Map<string, WalkedFile[]>();
  for (const f of files) {
    const base = path.basename(f.relativePath);
    if (!byName.has(base)) byName.set(base, []);
    byName.get(base)!.push(f);
  }

  function readFirst(name: string): string | null {
    // Check root first, then walked subdirectories
    const rootFile = path.join(rootPath, name);
    if (fs.existsSync(rootFile)) {
      try { return fs.readFileSync(rootFile, 'utf8'); } catch { /* skip */ }
    }
    for (const f of byName.get(name) ?? []) {
      try { return fs.readFileSync(f.absolutePath, 'utf8'); } catch { /* skip */ }
    }
    return null;
  }

  // JavaScript / TypeScript
  const pkgContent = readFirst('package.json');
  if (pkgContent) {
    try {
      const pkg = JSON.parse(pkgContent) as Record<string, unknown>;
      const deps = {
        ...(pkg.dependencies as Record<string, string> ?? {}),
        ...(pkg.devDependencies as Record<string, string> ?? {}),
      };
      const checks: [string, string][] = [
        ['react', 'React'], ['vue', 'Vue'], ['@angular/core', 'Angular'],
        ['svelte', 'Svelte'], ['express', 'Express'], ['@nestjs/core', 'NestJS'],
        ['next', 'Next.js'], ['nuxt', 'Nuxt'], ['vite', 'Vite'],
        ['fastify', 'Fastify'], ['koa', 'Koa'], ['prisma', 'Prisma'],
        ['@prisma/client', 'Prisma'], ['mongoose', 'Mongoose'],
        ['sequelize', 'Sequelize'], ['typeorm', 'TypeORM'],
        ['drizzle-orm', 'Drizzle ORM'], ['graphql', 'GraphQL'],
        ['@apollo/server', 'Apollo'], ['socket.io', 'Socket.IO'],
        ['jest', 'Jest'], ['vitest', 'Vitest'], ['tailwindcss', 'Tailwind CSS'],
      ];
      for (const [dep, label] of checks) {
        if (deps[dep]) found.push(label);
      }
    } catch { /* malformed package.json */ }
  }

  // Python — check all requirements.txt files found anywhere in the repo
  const reqFiles = byName.get('requirements.txt') ?? [];
  if (fs.existsSync(path.join(rootPath, 'requirements.txt'))) {
    reqFiles.unshift({ absolutePath: path.join(rootPath, 'requirements.txt'), relativePath: 'requirements.txt', extension: '.txt', sizeBytes: 0 });
  }
  for (const rf of reqFiles) {
    try {
      const content = fs.readFileSync(rf.absolutePath, 'utf8').toLowerCase();
      if (content.includes('django')) found.push('Django');
      if (content.includes('flask')) found.push('Flask');
      if (content.includes('fastapi')) found.push('FastAPI');
      if (content.includes('sqlalchemy')) found.push('SQLAlchemy');
      if (content.includes('langchain')) found.push('LangChain');
      if (content.includes('openai')) found.push('OpenAI');
      if (content.includes('anthropic')) found.push('Anthropic SDK');
      if (content.includes('google-generativeai') || content.includes('google-genai')) found.push('Gemini');
      if (content.includes('pytest')) found.push('pytest');
    } catch { /* skip */ }
  }

  // Go
  const goContent = readFirst('go.mod');
  if (goContent) {
    found.push('Go Modules');
    if (goContent.includes('github.com/gin-gonic/gin')) found.push('Gin');
    if (goContent.includes('github.com/gofiber/fiber')) found.push('Fiber');
    if (goContent.includes('github.com/labstack/echo')) found.push('Echo');
  }

  // Rust
  if (readFirst('Cargo.toml')) found.push('Rust / Cargo');

  // Docker — check root and subdirs
  const hasDockerfile = fs.existsSync(path.join(rootPath, 'Dockerfile')) || (byName.get('Dockerfile')?.length ?? 0) > 0;
  const hasCompose = fs.existsSync(path.join(rootPath, 'docker-compose.yml'))
    || fs.existsSync(path.join(rootPath, 'docker-compose.yaml'))
    || (byName.get('docker-compose.yml')?.length ?? 0) > 0;
  if (hasDockerfile) found.push('Docker');
  if (hasCompose) found.push('Docker Compose');

  return [...new Set(found)];
}

function detectPackageManager(rootPath: string): string | null {
  if (fs.existsSync(path.join(rootPath, 'pnpm-lock.yaml'))) return 'pnpm';
  if (fs.existsSync(path.join(rootPath, 'yarn.lock'))) return 'yarn';
  if (fs.existsSync(path.join(rootPath, 'package-lock.json'))) return 'npm';
  if (fs.existsSync(path.join(rootPath, 'bun.lockb'))) return 'bun';
  if (fs.existsSync(path.join(rootPath, 'package.json'))) return 'npm';
  return null;
}

function detectRunCommands(rootPath: string): string[] {
  const cmds: string[] = [];
  const pm = detectPackageManager(rootPath) ?? 'npm';

  const pkgPath = path.join(rootPath, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8')) as Record<string, unknown>;
      const scripts = (pkg.scripts as Record<string, string>) ?? {};
      if (scripts.dev) cmds.push(`${pm} run dev`);
      else if (scripts.start) cmds.push(`${pm} start`);
      if (scripts.test) cmds.push(`${pm} test`);
      if (scripts.build) cmds.push(`${pm} run build`);
    } catch { /* skip */ }
  }

  if (fs.existsSync(path.join(rootPath, 'manage.py'))) cmds.push('python manage.py runserver');
  else if (fs.existsSync(path.join(rootPath, 'app.py'))) cmds.push('python app.py');
  else if (fs.existsSync(path.join(rootPath, 'main.py'))) cmds.push('python main.py');

  if (fs.existsSync(path.join(rootPath, 'go.mod'))) cmds.push('go run .');
  if (fs.existsSync(path.join(rootPath, 'Cargo.toml'))) cmds.push('cargo run');

  return cmds;
}

function findEntryPoints(rootPath: string, files: WalkedFile[]): FileRef[] {
  const fileSet = new Set(files.map(f => f.relativePath.replace(/\\/g, '/')));
  const found: FileRef[] = [];

  // Check exact patterns first (root-level and src/)
  for (const pattern of ENTRY_POINT_PATTERNS) {
    if (fileSet.has(pattern)) {
      found.push({ relativePath: pattern, absolutePath: path.join(rootPath, pattern) });
    }
  }

  // Also match entry-point filenames at one level deep (e.g. my_agent/main.py)
  const ENTRY_NAMES = new Set(['main.py', 'app.py', 'manage.py', 'main.go', 'main.ts', 'main.js', 'index.ts', 'index.js', 'server.ts', 'server.js']);
  if (found.length === 0) {
    for (const f of files) {
      const base = path.basename(f.relativePath);
      const depth = f.relativePath.split(/[/\\]/).length;
      if (depth <= 3 && ENTRY_NAMES.has(base)) {
        const rel = f.relativePath.replace(/\\/g, '/');
        if (!found.some(e => e.relativePath === rel)) {
          found.push({ relativePath: rel, absolutePath: f.absolutePath });
        }
      }
    }
  }

  return found;
}

function findConfigFiles(rootPath: string, files: WalkedFile[]): FileRef[] {
  return files
    .filter(f => CONFIG_FILE_NAMES.has(path.basename(f.relativePath)))
    .map(f => ({ relativePath: f.relativePath, absolutePath: f.absolutePath }))
    .slice(0, 20); // cap at 20 so the overview stays readable
}

function getTopDirectories(rootPath: string, ig: Ignore): DirectoryInfo[] {
  const dirs: DirectoryInfo[] = [];
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(rootPath, { withFileTypes: true });
  } catch {
    return dirs;
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (ALWAYS_IGNORE_DIRS.has(entry.name)) continue;
    const rel = entry.name;
    if (ig.ignores(rel + '/')) continue;

    // Count files in this top-level directory
    const subFiles = walkDirectory(path.join(rootPath, entry.name), ig, rootPath);
    dirs.push({
      name: entry.name,
      relativePath: rel,
      description: DIR_DESCRIPTIONS[entry.name] ?? 'Source files',
      fileCount: subFiles.length,
    });
  }

  return dirs.sort((a, b) => b.fileCount - a.fileCount);
}

function detectTestLocations(files: WalkedFile[]): string[] {
  const testDirs = new Set<string>();
  for (const f of files) {
    const parts = f.relativePath.replace(/\\/g, '/').split('/');
    for (const part of parts.slice(0, -1)) {
      if (['tests', '__tests__', 'test', 'spec', 'e2e'].includes(part)) {
        testDirs.add(part);
      }
    }
    const base = path.basename(f.relativePath);
    if (
      base.match(/\.(test|spec)\.(ts|tsx|js|jsx|py|go|rb)$/) ||
      base.match(/_test\.(go|py)$/)
    ) {
      const dir = path.dirname(f.relativePath).replace(/\\/g, '/');
      testDirs.add(dir === '.' ? '(root)' : dir);
    }
  }
  return [...testDirs];
}

function detectApiRoutes(files: WalkedFile[], rootPath: string): ApiRoute[] {
  const routes: ApiRoute[] = [];

  // Patterns for Express / Fastify / Koa style: router.get('/path', ...)
  const jsPattern = /(?:router|app|server)\.(get|post|put|patch|delete|all)\s*\(\s*['"`]([^'"` \n]+)['"`]/gi;
  // FastAPI / Flask style: @app.get("/path")
  const pyPattern = /@(?:app|router|blueprint)\.(get|post|put|patch|delete)\s*\(\s*['"`]([^'"` \n]+)['"`]/gi;

  for (const file of files) {
    const ext = file.extension;
    if (!['.ts', '.js', '.tsx', '.jsx', '.py'].includes(ext)) continue;
    if (file.sizeBytes > 200_000) continue; // skip huge files

    let content: string;
    try {
      content = fs.readFileSync(file.absolutePath, 'utf8');
    } catch {
      continue;
    }

    const pattern = ext === '.py' ? pyPattern : jsPattern;
    pattern.lastIndex = 0;

    const lines = content.split('\n');
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(content)) !== null) {
      // Find line number by counting newlines up to match.index
      const before = content.slice(0, match.index);
      const lineNumber = before.split('\n').length;

      routes.push({
        method: match[1].toUpperCase(),
        path: match[2],
        file: file.relativePath,
        line: lineNumber,
      });

      if (routes.length >= 50) return routes; // cap at 50
    }
  }

  // Deduplicate: keep first occurrence of each method+path combo
  const seen = new Set<string>();
  return routes.filter(r => {
    const key = `${r.method}:${r.path}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function readReadme(rootPath: string): string | null {
  const candidates = ['README.md', 'readme.md', 'Readme.md', 'README.txt'];
  for (const name of candidates) {
    const p = path.join(rootPath, name);
    if (fs.existsSync(p)) {
      try {
        const content = fs.readFileSync(p, 'utf8');
        // Return first 800 chars as preview
        return content.slice(0, 800);
      } catch { /* skip */ }
    }
  }
  return null;
}

// ─── Main export ─────────────────────────────────────────────────────────────

export function analyseRepository(rootPath: string): RepoOverview {
  const resolved = path.resolve(rootPath);

  if (!fs.existsSync(resolved)) {
    throw new Error(`Repository path does not exist: ${resolved}`);
  }
  if (!fs.statSync(resolved).isDirectory()) {
    throw new Error(`Path is not a directory: ${resolved}`);
  }

  const ig = buildIgnoreFilter(resolved);
  const files = walkDirectory(resolved, ig, resolved);

  return {
    name: path.basename(resolved),
    rootPath: resolved,
    languages: detectLanguages(files),
    frameworks: detectFrameworks(resolved, files),
    entryPoints: findEntryPoints(resolved, files),
    configFiles: findConfigFiles(resolved, files),
    directories: getTopDirectories(resolved, ig),
    totalFiles: files.length,
    hasTests: detectTestLocations(files).length > 0,
    testLocations: detectTestLocations(files),
    apiRoutes: detectApiRoutes(files, resolved),
    packageManager: detectPackageManager(resolved),
    runCommands: detectRunCommands(resolved),
    readmePreview: readReadme(resolved),
  };
}
