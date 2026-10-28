import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { analyseRepository } from '../src/services/repoAnalyser.js';
import path from 'path';
import os from 'os';
import fs from 'fs';

function makeRepo(structure: Record<string, string>): string {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'repopilot-repo-'));
  for (const [relPath, content] of Object.entries(structure)) {
    const abs = path.join(tmpDir, relPath);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content);
  }
  return tmpDir;
}

describe('analyseRepository', () => {
  let repoDir: string;

  beforeAll(() => {
    repoDir = makeRepo({
      'package.json': JSON.stringify({
        name: 'my-app',
        scripts: { dev: 'vite', test: 'vitest' },
        dependencies: { react: '^18.0.0', express: '^4.0.0' },
        devDependencies: { vite: '^5.0.0', vitest: '^1.0.0' },
      }),
      'src/index.ts': 'import express from "express";\nconst app = express();\napp.get("/api/users", handler);',
      'src/routes/users.ts': 'import { Router } from "express";\nconst router = Router();\nrouter.post("/login", loginHandler);\nrouter.get("/profile", profileHandler);',
      'src/utils/helper.ts': 'export const add = (a: number, b: number) => a + b;',
      'tests/helper.test.ts': 'import { add } from "../src/utils/helper";\nconsole.log(add(1,2));',
      'README.md': '# My App\nA sample application.',
      '.gitignore': 'node_modules\ndist\n',
      'node_modules/express/index.js': '// should be ignored',
    });
  });

  afterAll(() => {
    fs.rmSync(repoDir, { recursive: true, force: true });
  });

  it('returns correct project name', () => {
    const overview = analyseRepository(repoDir);
    expect(overview.name).toBe(path.basename(repoDir));
  });

  it('detects TypeScript as a language', () => {
    const overview = analyseRepository(repoDir);
    const ts = overview.languages.find(l => l.name === 'TypeScript');
    expect(ts).toBeDefined();
    expect(ts!.fileCount).toBeGreaterThan(0);
  });

  it('detects React and Express as frameworks', () => {
    const overview = analyseRepository(repoDir);
    expect(overview.frameworks).toContain('React');
    expect(overview.frameworks).toContain('Express');
    expect(overview.frameworks).toContain('Vite');
    expect(overview.frameworks).toContain('Vitest');
  });

  it('finds src/index.ts as an entry point', () => {
    const overview = analyseRepository(repoDir);
    const paths = overview.entryPoints.map(e => e.relativePath.replace(/\\/g, '/'));
    expect(paths).toContain('src/index.ts');
  });

  it('finds package.json as a config file', () => {
    const overview = analyseRepository(repoDir);
    const paths = overview.configFiles.map(e => path.basename(e.relativePath));
    expect(paths).toContain('package.json');
  });

  it('ignores node_modules', () => {
    const overview = analyseRepository(repoDir);
    const allFiles = overview.directories.map(d => d.name);
    expect(allFiles).not.toContain('node_modules');
  });

  it('detects tests', () => {
    const overview = analyseRepository(repoDir);
    expect(overview.hasTests).toBe(true);
  });

  it('detects API routes in source files', () => {
    const overview = analyseRepository(repoDir);
    expect(overview.apiRoutes.length).toBeGreaterThan(0);
    const methods = overview.apiRoutes.map(r => r.method);
    expect(methods).toContain('GET');
    expect(methods).toContain('POST');
  });

  it('reads README preview', () => {
    const overview = analyseRepository(repoDir);
    expect(overview.readmePreview).toContain('My App');
  });

  it('throws on non-existent path', () => {
    expect(() => analyseRepository('/this/path/does/not/exist')).toThrow();
  });
});
