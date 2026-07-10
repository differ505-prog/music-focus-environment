import type { ThemeProgram } from '@/types/music';

export type ResetThemePanelResult = {
  moduleOutputs: Record<string, string>;
  supplementalInputs: Record<string, string>;
  workingPromptDrafts: Record<string, string>;
  feedbackMap: Record<string, string>;
  importDraft: string;
  importError: string | null;
  importedPreview: unknown[] | null;
  clearedStorageKeys: string[];
};

export type ResetThemePanelStorage = Pick<Storage, 'removeItem'>;

export const MODULE_OUTPUTS_STORAGE_KEY = 'theme-manual-module-outputs-v2';
export const MODULE_SUPPLEMENTAL_INPUTS_STORAGE_KEY = 'theme-manual-module-supplemental-inputs-v1';

export function buildResetResult(
  programs: readonly ThemeProgram[],
  storage: ResetThemePanelStorage | null,
): ResetThemePanelResult {
  const clearedStorageKeys: string[] = [];
  if (storage) {
    storage.removeItem(MODULE_OUTPUTS_STORAGE_KEY);
    storage.removeItem(MODULE_SUPPLEMENTAL_INPUTS_STORAGE_KEY);
    clearedStorageKeys.push(MODULE_OUTPUTS_STORAGE_KEY, MODULE_SUPPLEMENTAL_INPUTS_STORAGE_KEY);
  }

  return {
    moduleOutputs: {},
    supplementalInputs: {},
    workingPromptDrafts: {},
    feedbackMap: {},
    importDraft: '',
    importError: null,
    importedPreview: null,
    clearedStorageKeys,
  };
}

export function countResettableItems(
  moduleOutputs: Record<string, unknown>,
  supplementalInputs: Record<string, unknown>,
  workingPromptDrafts: Record<string, unknown>,
): { outputs: number; supplementalInputs: number; drafts: number } {
  return {
    outputs: Object.values(moduleOutputs).filter((value) => typeof value === 'string' && value.trim().length > 0).length,
    supplementalInputs: Object.values(supplementalInputs).filter(
      (value) => typeof value === 'string' && value.trim().length > 0,
    ).length,
    drafts: Object.values(workingPromptDrafts).filter((value) => typeof value === 'string' && value.trim().length > 0).length,
  };
}

export const RESET_CONFIRM_PHRASE = 'RESET';