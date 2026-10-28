import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFile } from '../src/services/fileReader.js';
import path from 'path';
import os from 'os';
import fs from 'fs';

describe('fileReader', () => {
  let repoDir: string;

  beforeAll(() => {
    repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'repopilot-reader-'));
    fs.mkdirSync(path.join(repoDir, 'src'));
    fs.writeFileSync(
      path.join(repoDir, 'src', 'index.ts'),
      'line 1\nline 2\nline 3\nline 4\nline 5\n'
    );
    fs.writeFileSync(path.join(repoDir, '.env'), 'SECRET=hunter2');
    fs.writeFileSync(path.join(repoDir, 'image.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  });

  afterAll(() => {
    fs.rmSync(repoDir, { recursive: true, force: true });
  });

  it('reads a normal file with correct line count', () => {
    const result = readFile(repoDir, 'src/index.ts');
    expect(result.totalLines).toBe(6); // 5 lines + trailing newline = 6 entries
    expect(result.lines[0].content).toBe('line 1');
    expect(result.lines[0].number).toBe(1);
  });

  it('reads a specific line range', () => {
    const result = readFile(repoDir, 'src/index.ts', { startLine: 2, endLine: 3 });
    expect(result.lines).toHaveLength(2);
    expect(result.lines[0].number).toBe(2);
    expect(result.lines[0].content).toBe('line 2');
    expect(result.lines[1].content).toBe('line 3');
  });

  it('detects the language as typescript', () => {
    const result = readFile(repoDir, 'src/index.ts');
    expect(result.language).toBe('typescript');
  });

  it('blocks reading .env files', () => {
    expect(() => readFile(repoDir, '.env')).toThrow(/not allowed/);
  });

  it('blocks reading binary/image files', () => {
    expect(() => readFile(repoDir, 'image.png')).toThrow(/not allowed/);
  });

  it('blocks path traversal', () => {
    expect(() => readFile(repoDir, '../../etc/passwd')).toThrow(/Security/);
  });

  it('throws on non-existent file', () => {
    expect(() => readFile(repoDir, 'ghost.ts')).toThrow(/not found/i);
  });
});
