import { describe, expect, it } from 'vitest';

import type { ThemeProgram, ThemePromptModule } from '@/types/music';

import {
  buildLowInputAssembly,
  buildWorkingPrompt,
  combineModuleOutputs,
  extractTemplateReferencedModuleIds,
  findFirstIncompleteStep,
  getModuleOutputSlotLabel,
} from './theme-program-panel';

// ── Fixtures ───────────────────────────────────────────────────────────────

function makeModule(overrides: Partial<ThemePromptModule> = {}): ThemePromptModule {
  return {
    id: 'module-a',
    title: 'Module A',
    purpose: 'A purpose',
    template: 'Template for {{Module A}}',
    ...overrides,
  };
}

function makeProgram(modules: ThemePromptModule[], overrides: Partial<ThemeProgram> = {}): ThemeProgram {
  return {
    id: 'program-x',
    label: 'Test Program',
    title: 'Test Title',
    bpmDisplay: '120',
    summary: '',
    audience: '',
    positioning: '',
    operatingPrinciples: [],
    layoutNotes: [],
    workflow: [],
    promptSeed: '',
    promptModules: modules,
    acceptanceChecklist: [],
    ...overrides,
  };
}

function slotKey(programId: string, moduleId: string, slotIndex: number) {
  return `${programId}::${moduleId}::slot-${slotIndex}`;
}

// ── extractTemplateReferencedModuleIds ────────────────────────────────────

describe('extractTemplateReferencedModuleIds', () => {
  it('extracts a single referenced module id', () => {
    const template = '請參考【貼上 Module 1 結果】後繼續';
    expect(extractTemplateReferencedModuleIds(template)).toEqual(['Module 1']);
  });

  it('extracts multiple referenced module ids preserving order', () => {
    const template = '先看【貼上 Module 1 結果】,再對照【貼上 Module 2 結果】,最後用【貼上 Module 3 結果】';
    expect(extractTemplateReferencedModuleIds(template)).toEqual([
      'Module 1',
      'Module 2',
      'Module 3',
    ]);
  });

  it('returns an empty array when there are no placeholders', () => {
    expect(extractTemplateReferencedModuleIds('純文字模板，沒有任何佔位符')).toEqual([]);
  });

  it('does not match partial or malformed placeholders', () => {
    const template = '【貼上 ModuleA 結果】、【貼上 Module】、【貼上第 1 步結果】';
    // 必須是 "Module <數字>" 才會被識別
    expect(extractTemplateReferencedModuleIds(template)).toEqual([]);
  });

  it('allows the same module id to appear more than once (caller dedupes via getReferencedUpstreamModules)', () => {
    const template = '【貼上 Module 1 結果】...【貼上 Module 1 結果】';
    expect(extractTemplateReferencedModuleIds(template)).toEqual(['Module 1', 'Module 1']);
  });
});

// ── combineModuleOutputs ───────────────────────────────────────────────────

describe('combineModuleOutputs', () => {
  it('returns an empty string when no slot is filled', () => {
    const module = makeModule({ id: 'm1' });
    expect(combineModuleOutputs('prog-1', module, {})).toBe('');
  });

  it('returns the raw value when there is only a single slot', () => {
    const module = makeModule({ id: 'm1', outputSlots: 1 });
    const outputs = { [slotKey('prog-1', 'm1', 0)]: 'hello' };
    expect(combineModuleOutputs('prog-1', module, outputs)).toBe('hello');
  });

  it('labels each slot when there are multiple slots', () => {
    const module = makeModule({
      id: 'm1',
      outputSlots: 2,
      outputSlotLabels: ['第一段', '第二段'],
    });
    const outputs = {
      [slotKey('prog-1', 'm1', 0)]: 'AAA',
      [slotKey('prog-1', 'm1', 1)]: 'BBB',
    };
    const result = combineModuleOutputs('prog-1', module, outputs);
    expect(result).toContain('===== 第一段 =====');
    expect(result).toContain('AAA');
    expect(result).toContain('===== 第二段 =====');
    expect(result).toContain('BBB');
  });

  it('skips empty slots entirely (does not include their header)', () => {
    const module = makeModule({
      id: 'm1',
      outputSlots: 3,
      outputSlotLabels: ['一', '二', '三'],
    });
    const outputs = {
      [slotKey('prog-1', 'm1', 1)]: 'only-middle',
    };
    const result = combineModuleOutputs('prog-1', module, outputs);
    expect(result).not.toContain('===== 一 =====');
    expect(result).not.toContain('===== 三 =====');
    expect(result).toContain('===== 二 =====');
    expect(result).toContain('only-middle');
  });

  it('defaults slotCount to 1 when outputSlots is undefined', () => {
    const module = makeModule({ id: 'm1' });
    const outputs = { [slotKey('prog-1', 'm1', 0)]: 'only' };
    expect(combineModuleOutputs('prog-1', module, outputs)).toBe('only');
  });

  it('falls back to slot 0 if outputs key uses slot 0 even when outputSlots > 1', () => {
    const module = makeModule({ id: 'm1', outputSlots: 2 });
    const outputs = { [slotKey('prog-1', 'm1', 0)]: 'first-only' };
    expect(combineModuleOutputs('prog-1', module, outputs)).toContain('first-only');
  });
});

// ── getModuleOutputSlotLabel ──────────────────────────────────────────────

describe('getModuleOutputSlotLabel', () => {
  it('uses outputSlotLabels when provided', () => {
    const module = makeModule({ outputSlotLabels: ['Alpha', 'Beta'] });
    expect(getModuleOutputSlotLabel(module, 0)).toBe('Alpha');
    expect(getModuleOutputSlotLabel(module, 1)).toBe('Beta');
  });

  it('falls back to "候選 Prompt NN" when there are multiple slots but no labels', () => {
    const module = makeModule({ outputSlots: 3 });
    expect(getModuleOutputSlotLabel(module, 0)).toBe('候選 Prompt 01');
    expect(getModuleOutputSlotLabel(module, 2)).toBe('候選 Prompt 03');
  });

  it('returns the singular default when only one slot exists', () => {
    const module = makeModule({ outputSlots: 1 });
    expect(getModuleOutputSlotLabel(module, 0)).toBe('此步驟輸出');
  });

  it('respects custom fallback prefix', () => {
    const module = makeModule({ outputSlots: 2 });
    expect(getModuleOutputSlotLabel(module, 1, 'Variant')).toBe('Variant 02');
  });
});

// ── buildWorkingPrompt ─────────────────────────────────────────────────────

describe('buildWorkingPrompt', () => {
  it('replaces upstream module placeholder with stored output', () => {
    const moduleA = makeModule({ id: 'Module 1', title: 'Strategy' });
    const moduleB = makeModule({
      id: 'Module 2',
      title: 'Lyrics',
      template: '請基於【貼上 Module 1 結果】撰寫歌詞',
      upstreamModuleIds: ['Module 1'],
    });
    const program = makeProgram([moduleA, moduleB]);
    const outputs = { [slotKey('program-x', 'Module 1', 0)]: '已選定的故事主軸' };

    const result = buildWorkingPrompt(program, 1, moduleB, outputs, {});
    expect(result).toContain('已選定的故事主軸');
    expect(result).not.toContain('【貼上 Module 1 結果】');
  });

  it('inserts "【待補 …】" placeholder when upstream module has no output', () => {
    const moduleA = makeModule({ id: 'Module 1', title: 'Strategy' });
    const moduleB = makeModule({
      id: 'Module 2',
      title: 'Lyrics',
      template: '請基於【貼上 Module 1 結果】撰寫歌詞',
      upstreamModuleIds: ['Module 1'],
    });
    const program = makeProgram([moduleA, moduleB]);

    const result = buildWorkingPrompt(program, 1, moduleB, {}, {});
    expect(result).toContain('【待補 Strategy 結果】');
  });

  it('appends "參考資料" section when template has no explicit placeholders but upstream has payload', () => {
    const moduleA = makeModule({ id: 'Module 1', title: 'Strategy' });
    const moduleB = makeModule({
      id: 'Module 2',
      title: 'Lyrics',
      template: '請直接撰寫歌詞', // 沒有 【貼上 …】
      upstreamModuleIds: ['Module 1'],
    });
    const program = makeProgram([moduleA, moduleB]);
    const outputs = { [slotKey('program-x', 'Module 1', 0)]: '策略內容' };

    const result = buildWorkingPrompt(program, 1, moduleB, outputs, {});
    expect(result).toContain('請直接撰寫歌詞');
    expect(result).toContain('參考資料：');
    expect(result).toContain('策略內容');
  });

  it('does NOT append "參考資料" when template already has explicit placeholder', () => {
    const moduleA = makeModule({ id: 'Module 1', title: 'Strategy' });
    const moduleB = makeModule({
      id: 'Module 2',
      title: 'Lyrics',
      template: '請基於【貼上 Module 1 結果】撰寫歌詞',
      upstreamModuleIds: ['Module 1'],
    });
    const program = makeProgram([moduleA, moduleB]);
    const outputs = { [slotKey('program-x', 'Module 1', 0)]: '策略內容' };

    const result = buildWorkingPrompt(program, 1, moduleB, outputs, {});
    expect(result).not.toContain('參考資料：');
  });

  it('for low_input_auto_context mode, always appends auto-assembled context', () => {
    const moduleA = makeModule({ id: 'Module 1', title: 'Strategy' });
    const moduleB = makeModule({
      id: 'Module 2',
      title: 'Lyrics',
      template: '請寫歌詞',
      inputMode: 'low_input_auto_context',
      upstreamModuleIds: ['Module 1'],
    });
    const program = makeProgram([moduleA, moduleB]);
    const outputs = { [slotKey('program-x', 'Module 1', 0)]: '策略內容' };
    const supplementalInputs = { 'program-x::Module 2': 'audioUrl: example.com/a.mp3' };

    const result = buildWorkingPrompt(program, 1, moduleB, outputs, supplementalInputs);
    expect(result).toContain('請寫歌詞');
    expect(result).toContain('自動整理參考資料：');
    expect(result).toContain('策略內容');
    expect(result).toContain('audioUrl: example.com/a.mp3');
  });
});

// ── buildLowInputAssembly ─────────────────────────────────────────────────

describe('buildLowInputAssembly', () => {
  it('includes upstream payload when present', () => {
    const moduleA = makeModule({ id: 'Module 1', title: 'Strategy' });
    const moduleB = makeModule({
      id: 'Module 2',
      title: 'Lyrics',
      inputMode: 'low_input_auto_context',
    });
    const program = makeProgram([moduleA, moduleB]);
    const outputs = { [slotKey('program-x', 'Module 1', 0)]: '上游輸出' };

    const result = buildLowInputAssembly(program, 1, moduleB, outputs, '');
    expect(result).toContain('上游輸出');
    expect(result).toContain('以下是已自動整理的上游結果');
  });

  it('shows "目前沒有已儲存的上游結果" when upstream is empty', () => {
    const moduleA = makeModule({ id: 'Module 1', title: 'Strategy' });
    const moduleB = makeModule({
      id: 'Module 2',
      title: 'Lyrics',
      inputMode: 'low_input_auto_context',
    });
    const program = makeProgram([moduleA, moduleB]);

    const result = buildLowInputAssembly(program, 1, moduleB, {}, '');
    expect(result).toContain('目前沒有已儲存的上游結果');
  });

  it('includes numbered autoAssembleInstructions when present', () => {
    const moduleA = makeModule({ id: 'Module 1', title: 'Strategy' });
    const moduleB = makeModule({
      id: 'Module 2',
      title: 'Lyrics',
      inputMode: 'low_input_auto_context',
      autoAssembleInstructions: ['檢查 BPM', '確認段落數'],
    });
    const program = makeProgram([moduleA, moduleB]);

    const result = buildLowInputAssembly(program, 1, moduleB, {}, '');
    expect(result).toContain('以下是必須一起執行的檢查與命名 SOP');
    expect(result).toContain('1. 檢查 BPM');
    expect(result).toContain('2. 確認段落數');
  });

  it('shows supplemental input when provided', () => {
    const moduleB = makeModule({
      id: 'Module 2',
      title: 'Lyrics',
      inputMode: 'low_input_auto_context',
    });
    const program = makeProgram([moduleB]);

    const result = buildLowInputAssembly(program, 0, moduleB, {}, 'coverImageUrl: https://x');
    expect(result).toContain('coverImageUrl: https://x');
  });

  it('shows "無" when supplemental input is empty/whitespace', () => {
    const moduleB = makeModule({
      id: 'Module 2',
      title: 'Lyrics',
      inputMode: 'low_input_auto_context',
    });
    const program = makeProgram([moduleB]);

    const result = buildLowInputAssembly(program, 0, moduleB, {}, '   ');
    expect(result).toContain('無');
  });
});

// ── findFirstIncompleteStep ───────────────────────────────────────────────

describe('findFirstIncompleteStep', () => {
  function filled(programId: string, moduleId: string) {
    return { [slotKey(programId, moduleId, 0)]: 'filled' };
  }

  it('returns 0 when the first module has no output', () => {
    const program = makeProgram([
      makeModule({ id: 'm1' }),
      makeModule({ id: 'm2' }),
    ]);
    expect(findFirstIncompleteStep(program, {})).toBe(0);
  });

  it('returns 1 when first is filled but second is not', () => {
    const program = makeProgram([
      makeModule({ id: 'm1' }),
      makeModule({ id: 'm2' }),
    ]);
    const outputs = filled('program-x', 'm1');
    expect(findFirstIncompleteStep(program, outputs)).toBe(1);
  });

  it('returns the middle index when there is a gap in the middle', () => {
    const program = makeProgram([
      makeModule({ id: 'm1' }),
      makeModule({ id: 'm2' }),
      makeModule({ id: 'm3' }),
    ]);
    // 只填 m1 與 m3,m2 留空
    const outputs = {
      ...filled('program-x', 'm1'),
      ...filled('program-x', 'm3'),
    };
    expect(findFirstIncompleteStep(program, outputs)).toBe(1);
  });

  it('returns last index when all modules are filled', () => {
    const program = makeProgram([
      makeModule({ id: 'm1' }),
      makeModule({ id: 'm2' }),
    ]);
    const outputs = {
      ...filled('program-x', 'm1'),
      ...filled('program-x', 'm2'),
    };
    // 「全部完成」時回傳最後一個 index (目前實作為 promptModules.length - 1)
    expect(findFirstIncompleteStep(program, outputs)).toBe(1);
  });

  it('treats whitespace-only output as incomplete', () => {
    const program = makeProgram([makeModule({ id: 'm1' })]);
    const outputs = { [slotKey('program-x', 'm1', 0)]: '   ' };
    expect(findFirstIncompleteStep(program, outputs)).toBe(0);
  });
});