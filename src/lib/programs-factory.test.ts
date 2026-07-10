import { describe, expect, it } from 'vitest';

import type { ProgramFile } from './programs-factory';
import {
  exportProgramsToJSON,
  importProgramsFromJSON,
  programFileSchema,
} from './programs-factory';

const sampleProgram: ProgramFile['programs'][number] = {
  id: 'prog-1',
  label: 'L1',
  title: 'T1',
  bpmDisplay: '120',
  summary: 's',
  audience: 'a',
  positioning: 'p',
  operatingPrinciples: ['op1'],
  layoutNotes: ['ln1'],
  workflow: [{ id: 'w1', title: 'W1', detail: 'd' }],
  promptSeed: 'seed',
  promptModules: [
    {
      id: 'Module 1',
      title: 'Strategy',
      purpose: 'p',
      template: '請參考【貼上 Module 1 結果】',
      outputSlots: 2,
    },
  ],
  acceptanceChecklist: [{ id: 'c1', title: 'C1', detail: 'd' }],
};

// ── exportProgramsToJSON ──────────────────────────────────────────────────

describe('exportProgramsToJSON', () => {
  it('round-trips through JSON.stringify with formatting', () => {
    const result = exportProgramsToJSON([sampleProgram]);
    expect(result).toContain('\n'); // pretty-printed
    expect(JSON.parse(result).programs[0].id).toBe('prog-1');
  });

  it('embeds $schema marker and version', () => {
    const result = exportProgramsToJSON([sampleProgram]);
    const parsed = JSON.parse(result);
    expect(parsed.$schema).toBe('theme-program-file');
    expect(parsed.version).toBe(1);
  });

  it('embeds exportedAt as ISO string', () => {
    const result = exportProgramsToJSON([sampleProgram]);
    const parsed = JSON.parse(result);
    expect(typeof parsed.exportedAt).toBe('string');
    expect(Number.isNaN(Date.parse(parsed.exportedAt))).toBe(false);
  });
});

// ── importProgramsFromJSON ────────────────────────────────────────────────

describe('importProgramsFromJSON', () => {
  it('accepts a valid payload produced by exportProgramsToJSON', () => {
    const exported = exportProgramsToJSON([sampleProgram]);
    const result = importProgramsFromJSON(exported);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.programs).toHaveLength(1);
      expect(result.programs[0].id).toBe('prog-1');
    }
  });

  it('rejects invalid JSON syntax', () => {
    const result = importProgramsFromJSON('not json at all');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('JSON');
    }
  });

  it('rejects JSON that does not match the schema (missing $schema)', () => {
    const bad = JSON.stringify({ version: 1, programs: [] });
    const result = importProgramsFromJSON(bad);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeTruthy();
    }
  });

  it('rejects JSON with wrong version', () => {
    const wrongVersion = JSON.stringify({
      $schema: 'theme-program-file',
      version: 99,
      exportedAt: new Date().toISOString(),
      programs: [sampleProgram],
    });
    const result = importProgramsFromJSON(wrongVersion);
    expect(result.ok).toBe(false);
  });

  it('rejects module without required fields', () => {
    const bad = JSON.stringify({
      $schema: 'theme-program-file',
      version: 1,
      exportedAt: new Date().toISOString(),
      programs: [
        {
          id: 'prog-1',
          // label, title, ... 全部缺漏
          promptModules: [],
        },
      ],
    });
    const result = importProgramsFromJSON(bad);
    expect(result.ok).toBe(false);
  });
});

// ── programFileSchema ────────────────────────────────────────────────────

describe('programFileSchema', () => {
  it('infers a useful TS type from the zod schema', () => {
    // 確保型別系統對齊 — 若 schema 改了,ProgramFile 自動跟著改
    const sample: ProgramFile = {
      $schema: 'theme-program-file',
      version: 1,
      exportedAt: '2026-07-10T12:00:00Z',
      programs: [sampleProgram],
    };
    const result = programFileSchema.safeParse(sample);
    expect(result.success).toBe(true);
  });
});