// @vitest-environment jsdom
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach } from 'vitest';

import { ThemeProgramPanel } from './theme-program-panel';
import { exportProgramsToJSON } from '@/lib/programs-factory';
import type { ThemeProgram } from '@/types/music';

// Stub navigator.clipboard so we can assert writes without prompting the user
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
  id: 'prog-test',
  label: 'L-Test',
  title: 'Test Title',
  bpmDisplay: '120',
  summary: 'summary',
  audience: 'aud',
  positioning: 'pos',
  operatingPrinciples: ['op'],
  layoutNotes: ['ln'],
  workflow: [{ id: 'w1', title: 'W1', detail: 'd', deliverable: 'out' }],
  promptSeed: 'seed',
  promptModules: [
    {
      id: 'Module 1',
      title: 'Strategy',
      purpose: 'p',
      template: 'template',
    },
  ],
  acceptanceChecklist: [],
};

describe('ThemeProgramPanel — 匯出 / 匯入工具列', () => {
  it('點擊「匯出當前主題 JSON」會呼叫 clipboard.writeText 並顯示 feedback', async () => {
    render(<ThemeProgramPanel programs={[minimalProgram]} />);

    const exportButton = screen.getByTestId('tpp-export');
    fireEvent.click(exportButton);

    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledTimes(1);
    });

    const writtenJson = writeTextMock.mock.calls[0][0] as string;
    const parsed = JSON.parse(writtenJson);
    expect(parsed.$schema).toBe('theme-program-file');
    expect(parsed.programs).toHaveLength(1);
    expect(parsed.programs[0].id).toBe('prog-test');

    expect(await screen.findByTestId('tpp-export-feedback')).toHaveTextContent(
      /已複製.*剪貼簿/,
    );
  });

  it('匯出的 JSON 可以被 exportProgramsToJSON round-trip 解析', async () => {
    render(<ThemeProgramPanel programs={[minimalProgram]} />);

    fireEvent.click(screen.getByTestId('tpp-export'));

    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalled();
    });

    const writtenJson = writeTextMock.mock.calls[0][0] as string;
    // 用工廠再次解析,確保不會因為 schema 變動而壞掉
    expect(() => exportProgramsToJSON([minimalProgram])).not.toThrow();
    const parsed = JSON.parse(writtenJson);
    expect(parsed.programs[0].promptModules[0].id).toBe('Module 1');
  });

  it('點擊「驗證」空字串 → 顯示「請先貼上 JSON」錯誤', async () => {
    render(<ThemeProgramPanel programs={[minimalProgram]} />);

    // 預設 details 是關閉的,需先點開
    fireEvent.click(screen.getByText(/匯入主題 JSON/));

    fireEvent.click(screen.getByTestId('tpp-import-validate'));

    expect(await screen.findByTestId('tpp-import-error')).toHaveTextContent(/請先貼上 JSON/);
  });

  it('點擊「驗證」壞 JSON → 顯示錯誤橫幅,不顯示預覽', async () => {
    render(<ThemeProgramPanel programs={[minimalProgram]} />);

    fireEvent.click(screen.getByText(/匯入主題 JSON/));

    const textarea = screen.getByTestId('tpp-import-draft');
    fireEvent.change(textarea, { target: { value: 'not valid json' } });
    fireEvent.click(screen.getByTestId('tpp-import-validate'));

    const errorBox = await screen.findByTestId('tpp-import-error');
    expect(errorBox).toHaveTextContent(/JSON/);

    expect(screen.queryByTestId('tpp-import-preview')).not.toBeInTheDocument();
  });

  it('點擊「驗證」合法 JSON → 顯示預覽卡片,包含主題清單', async () => {
    render(<ThemeProgramPanel programs={[minimalProgram]} />);

    fireEvent.click(screen.getByText(/匯入主題 JSON/));

    const validJson = exportProgramsToJSON([minimalProgram]);
    fireEvent.change(screen.getByTestId('tpp-import-draft'), {
      target: { value: validJson },
    });
    fireEvent.click(screen.getByTestId('tpp-import-validate'));

    const preview = await screen.findByTestId('tpp-import-preview');
    expect(preview).toHaveTextContent(/預覽:.*1.*主題/);
    expect(preview).toHaveTextContent('L-Test');

    expect(screen.queryByTestId('tpp-import-error')).not.toBeInTheDocument();
  });

  it('點擊「清空」→ 重置 textarea、預覽、錯誤', async () => {
    render(<ThemeProgramPanel programs={[minimalProgram]} />);

    fireEvent.click(screen.getByText(/匯入主題 JSON/));

    // 先填一些壞 JSON 並觸發錯誤
    fireEvent.change(screen.getByTestId('tpp-import-draft'), {
      target: { value: '{bad' },
    });
    fireEvent.click(screen.getByTestId('tpp-import-validate'));
    await screen.findByTestId('tpp-import-error');

    // 清空
    fireEvent.click(screen.getByTestId('tpp-import-clear'));

    expect((screen.getByTestId('tpp-import-draft') as HTMLTextAreaElement).value).toBe('');
    expect(screen.queryByTestId('tpp-import-error')).not.toBeInTheDocument();
    expect(screen.queryByTestId('tpp-import-preview')).not.toBeInTheDocument();
  });
});