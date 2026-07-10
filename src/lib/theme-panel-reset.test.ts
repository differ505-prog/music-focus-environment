// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';

import {
  MODULE_OUTPUTS_STORAGE_KEY,
  MODULE_SUPPLEMENTAL_INPUTS_STORAGE_KEY,
  RESET_CONFIRM_PHRASE,
  buildResetResult,
  countResettableItems,
} from './theme-panel-reset';
import type { ThemeProgram } from '@/types/music';

const makeProgram = (id: string): ThemeProgram => ({
  id,
  label: id,
  title: 't',
  bpmDisplay: '120',
  summary: 's',
  audience: 'a',
  positioning: 'p',
  operatingPrinciples: [],
  layoutNotes: [],
  workflow: [],
  promptSeed: 'seed',
  promptModules: [{ id: 'Module 1', title: 'M1', purpose: 'p', template: 'tpl' }],
  acceptanceChecklist: [],
});

describe('buildResetResult', () => {
  it('回傳全空的 state,包含 7 個欄位 + clearedStorageKeys', () => {
    const result = buildResetResult([makeProgram('a')], null);

    expect(result.moduleOutputs).toEqual({});
    expect(result.supplementalInputs).toEqual({});
    expect(result.workingPromptDrafts).toEqual({});
    expect(result.feedbackMap).toEqual({});
    expect(result.importDraft).toBe('');
    expect(result.importError).toBeNull();
    expect(result.importedPreview).toBeNull();
    expect(result.clearedStorageKeys).toHaveLength(0);
  });

  it('當 storage 不為 null → removeItem 兩個 key 並回報', () => {
    const removed: string[] = [];
    const fakeStorage = {
      removeItem: (key: string) => {
        removed.push(key);
      },
    };

    const result = buildResetResult([makeProgram('a')], fakeStorage);

    expect(removed).toEqual([
      MODULE_OUTPUTS_STORAGE_KEY,
      MODULE_SUPPLEMENTAL_INPUTS_STORAGE_KEY,
    ]);
    expect(result.clearedStorageKeys).toEqual([
      MODULE_OUTPUTS_STORAGE_KEY,
      MODULE_SUPPLEMENTAL_INPUTS_STORAGE_KEY,
    ]);
  });

  it('當 storage 為 null → 不 throw,clearedStorageKeys 為空', () => {
    expect(() => buildResetResult([], null)).not.toThrow();
  });

  it('不論傳入幾個 programs,結果都不應包含 programs', () => {
    const result = buildResetResult([makeProgram('a'), makeProgram('b'), makeProgram('c')], null);
    expect(result).not.toHaveProperty('programs');
  });
});

describe('countResettableItems', () => {
  it('只計算有內容的欄位(trim 後非空)', () => {
    const counts = countResettableItems(
      { 'a::m1::0': '內容', 'a::m1::1': '', 'a::m1::2': '   ' },
      { 'a::m1': '補充' },
      { 'a::m2': '草稿', 'a::m3': '' },
    );

    expect(counts.outputs).toBe(1);
    expect(counts.supplementalInputs).toBe(1);
    expect(counts.drafts).toBe(1);
  });

  it('全空 → 全為 0', () => {
    const counts = countResettableItems({}, {}, {});
    expect(counts).toEqual({ outputs: 0, supplementalInputs: 0, drafts: 0 });
  });

  it('只接受 string 型別,非 string 不算', () => {
    const counts = countResettableItems(
      { a: 123, b: 'ok', c: null, d: undefined, e: '   ' } as Record<string, unknown>,
      {},
      {},
    );
    expect(counts.outputs).toBe(1);
  });
});

describe('RESET_CONFIRM_PHRASE', () => {
  it('確認詞為 RESET(全大寫英文)', () => {
    expect(RESET_CONFIRM_PHRASE).toBe('RESET');
  });

  it('大小寫敏感:小寫 reset 不應等於確認詞', () => {
    expect('reset' === RESET_CONFIRM_PHRASE).toBe(false);
  });
});