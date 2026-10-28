import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { assertWithinRepo, toRelative } from '../src/utils/pathGuard.js';
import path from 'path';
import os from 'os';
import fs from 'fs';

describe('pathGuard', () => {
  let tmpDir: string;

  beforeAll(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'repopilot-test-'));
    fs.writeFileSync(path.join(tmpDir, 'hello.ts'), 'const x = 1;');
  });

  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('allows a file that is inside the repo', () => {
    const result = assertWithinRepo(tmpDir, 'hello.ts');
    expect(result).toBe(path.join(tmpDir, 'hello.ts'));
  });

  it('allows the root directory itself', () => {
    const result = assertWithinRepo(tmpDir, '');
    expect(result).toBe(path.resolve(tmpDir));
  });

  it('blocks a classic path traversal attack', () => {
    expect(() =>
      assertWithinRepo(tmpDir, '../../etc/passwd')
    ).toThrow(/Security/);
  });

  it('blocks an absolute path outside the repo', () => {
    expect(() =>
      assertWithinRepo(tmpDir, '/etc/passwd')
    ).toThrow(/Security/);
  });

  it('returns relative path correctly', () => {
    const abs = path.join(tmpDir, 'src', 'index.ts');
    const rel = toRelative(tmpDir, abs);
    expect(rel.replace(/\\/g, '/')).toBe('src/index.ts');
  });
});
