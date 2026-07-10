// @vitest-environment jsdom
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach } from 'vitest';

import { ThemeProgramPanel } from './theme-program-panel';
import {
  MODULE_OUTPUTS_STORAGE_KEY,
  MODULE_SUPPLEMENTAL_INPUTS_STORAGE_KEY,
} from '@/lib/theme-panel-reset';
import type { ThemeProgram } from '@/types/music';

const writeTextMock = vi.fn().mockResolvedValue(undefined);

beforeEach(() => {
  writeTextMock.mockClear();
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: writeTextMock },
    configurable: true,
    writable: true,
  });
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
});

const minimalProgram: ThemeProgram = {
  id: 'prog-reset',
  label: 'L-Reset',
  title: 'Reset Title',
  bpmDisplay: '120',
  summary: 's',
  audience: 'a',
  positioning: 'p',
  operatingPrinciples: [],
  layoutNotes: [],
  workflow: [],
  promptSeed: 'seed',
  promptModules: [
    { id: 'Module 1', title: 'M1', purpose: 'p', template: 'tpl1' },
    { id: 'Module 2', title: 'M2', purpose: 'p', template: 'tpl2' },
  ],
  acceptanceChecklist: [],
};

function seedLocalStorageWithOutputs() {
  const stored = {
    'prog-reset::Module 1::slot-0': {
      value: 'M1 既有結果',
      templateSnapshot: 'tpl1',
    },
    'prog-reset::Module 2::slot-0': {
      value: 'M2 既有結果',
      templateSnapshot: 'tpl2',
    },
  };
  window.localStorage.setItem(MODULE_OUTPUTS_STORAGE_KEY, JSON.stringify(stored));
}

describe('ThemeProgramPanel — 重置按鈕流程', () => {
  it('點擊「重置主題管理」→ 開啟確認 modal', () => {
    render(<ThemeProgramPanel programs={[minimalProgram]} />);

    fireEvent.click(screen.getByTestId('tpp-reset'));

    expect(screen.getByTestId('tpp-reset-modal')).toBeInTheDocument();
    expect(screen.getByTestId('tpp-reset-confirm-input')).toBeInTheDocument();
  });

  it('Modal 預設確認按鈕是 disabled', () => {
    render(<ThemeProgramPanel programs={[minimalProgram]} />);

    fireEvent.click(screen.getByTestId('tpp-reset'));

    const confirmButton = screen.getByTestId('tpp-reset-confirm') as HTMLButtonElement;
    expect(confirmButton.disabled).toBe(true);
  });

  it('輸入錯誤詞 → 確認按鈕仍 disabled', () => {
    render(<ThemeProgramPanel programs={[minimalProgram]} />);

    fireEvent.click(screen.getByTestId('tpp-reset'));
    const input = screen.getByTestId('tpp-reset-confirm-input');
    fireEvent.change(input, { target: { value: 'reset' } }); // 小寫,敏感

    const confirmButton = screen.getByTestId('tpp-reset-confirm') as HTMLButtonElement;
    expect(confirmButton.disabled).toBe(true);
  });

  it('輸入「RESET」→ 確認按鈕變 enabled', () => {
    render(<ThemeProgramPanel programs={[minimalProgram]} />);

    fireEvent.click(screen.getByTestId('tpp-reset'));
    fireEvent.change(screen.getByTestId('tpp-reset-confirm-input'), {
      target: { value: 'RESET' },
    });

    const confirmButton = screen.getByTestId('tpp-reset-confirm') as HTMLButtonElement;
    expect(confirmButton.disabled).toBe(false);
  });

  it('點擊「取消」→ 關閉 modal + 不清除 state', async () => {
    seedLocalStorageWithOutputs();
    render(<ThemeProgramPanel programs={[minimalProgram]} />);

    fireEvent.click(screen.getByTestId('tpp-reset'));
    fireEvent.click(screen.getByTestId('tpp-reset-cancel'));

    expect(screen.queryByTestId('tpp-reset-modal')).not.toBeInTheDocument();

    // localStorage 應該保留
    expect(window.localStorage.getItem(MODULE_OUTPUTS_STORAGE_KEY)).not.toBeNull();
  });

  it('完整重置流程:輸入 RESET → 確認 → localStorage 清空 + Toast 出現', async () => {
    seedLocalStorageWithOutputs();
    render(<ThemeProgramPanel programs={[minimalProgram]} />);

    // 1. 開 modal
    fireEvent.click(screen.getByTestId('tpp-reset'));
    expect(screen.getByTestId('tpp-reset-modal')).toBeInTheDocument();

    // 2. 輸入 RESET
    fireEvent.change(screen.getByTestId('tpp-reset-confirm-input'), {
      target: { value: 'RESET' },
    });

    // 3. 確認
    fireEvent.click(screen.getByTestId('tpp-reset-confirm'));

    // 4. modal 關閉
    await waitFor(() => {
      expect(screen.queryByTestId('tpp-reset-modal')).not.toBeInTheDocument();
    });

    // 5. localStorage 兩個 key 都被清掉
    expect(window.localStorage.getItem(MODULE_OUTPUTS_STORAGE_KEY)).toBeNull();
    expect(window.localStorage.getItem(MODULE_SUPPLEMENTAL_INPUTS_STORAGE_KEY)).toBeNull();

    // 6. Toast 顯示
    expect(await screen.findByTestId('tpp-reset-feedback')).toHaveTextContent(/已重置/);
  });

  it('重置後再次點按鈕 → 仍能正常運作(無殘留 state)', async () => {
    seedLocalStorageWithOutputs();
    render(<ThemeProgramPanel programs={[minimalProgram]} />);

    // 第一次重置
    fireEvent.click(screen.getByTestId('tpp-reset'));
    fireEvent.change(screen.getByTestId('tpp-reset-confirm-input'), {
      target: { value: 'RESET' },
    });
    fireEvent.click(screen.getByTestId('tpp-reset-confirm'));

    await waitFor(() => {
      expect(screen.queryByTestId('tpp-reset-modal')).not.toBeInTheDocument();
    });

    // 第二次重置 → modal 應能再次開啟
    fireEvent.click(screen.getByTestId('tpp-reset'));
    expect(screen.getByTestId('tpp-reset-modal')).toBeInTheDocument();

    // 確認按鈕應該又 disabled(因為 input 是新開的 modal,空字串)
    const confirmButton = screen.getByTestId('tpp-reset-confirm') as HTMLButtonElement;
    expect(confirmButton.disabled).toBe(true);
  });
});