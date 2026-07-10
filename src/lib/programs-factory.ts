import { z } from 'zod';

// ── Schema（與 src/types/music.ts 對齊）───────────────────────────────────
//
// 註:這份 schema 只負責「匯出/匯入檔案」用的「資料合約」。
// 並不是用 zod 重寫整個型別系統——這樣能保持既有 src/types/music.ts
// 的角色（單一真相來源）,不重複定義型別。

const quickLinkSchema = z.object({
  label: z.string(),
  url: z.string().url(),
});

const promptModuleSchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  purpose: z.string(),
  template: z.string(),
  upstreamModuleIds: z.array(z.string()).optional(),
  autoAdvanceToNext: z.boolean().optional(),
  quickLinks: z.array(quickLinkSchema).optional(),
  outputSlots: z.number().int().positive().optional(),
  outputSlotLabels: z.array(z.string()).optional(),
  inputMode: z.enum(['default', 'low_input_auto_context']).optional(),
  supplementalLabel: z.string().optional(),
  supplementalPlaceholder: z.string().optional(),
  autoAssembleNote: z.string().optional(),
  autoAssembleInstructions: z.array(z.string()).optional(),
});

const workflowStepSchema = z.object({
  id: z.string(),
  title: z.string(),
  detail: z.string(),
});

const checklistItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  detail: z.string(),
});

export const programFileSchema = z.object({
  $schema: z.literal('theme-program-file'),
  version: z.literal(1),
  exportedAt: z.string(),
  programs: z.array(
    z.object({
      id: z.string().min(1),
      label: z.string(),
      title: z.string(),
      bpmDisplay: z.string(),
      summary: z.string(),
      audience: z.string(),
      positioning: z.string(),
      operatingPrinciples: z.array(z.string()),
      layoutNotes: z.array(z.string()),
      workflow: z.array(workflowStepSchema),
      promptSeed: z.string(),
      promptModules: z.array(promptModuleSchema),
      acceptanceChecklist: z.array(checklistItemSchema),
    }),
  ),
});

// ── 從 zod schema 推回的 TS 型別（單一真相來源）──────────────────────────────
export type ProgramFile = z.infer<typeof programFileSchema>;

// ── Factory:序列化 ────────────────────────────────────────────────────────

export function exportProgramsToJSON(
  programs: ReadonlyArray<ProgramFile['programs'][number]>,
): string {
  const payload: ProgramFile = {
    $schema: 'theme-program-file',
    version: 1,
    exportedAt: new Date().toISOString(),
    programs: programs.map((program) => ({ ...program })),
  };

  return JSON.stringify(payload, null, 2);
}

// ── Factory:反序列化（帶 schema 驗證與降級）────────────────────────────────

export type ImportResult =
  | { ok: true; programs: ProgramFile['programs'] }
  | { ok: false; error: string };

export function importProgramsFromJSON(jsonString: string): ImportResult {
  let raw: unknown;

  try {
    raw = JSON.parse(jsonString);
  } catch {
    return { ok: false, error: 'JSON 語法錯誤,無法解析' };
  }

  const result = programFileSchema.safeParse(raw);

  if (!result.success) {
    const firstIssue = result.error.issues[0];
    return {
      ok: false,
      error: firstIssue
        ? `${firstIssue.path.join('.') || '(root)'}: ${firstIssue.message}`
        : '結構不符合預期',
    };
  }

  return { ok: true, programs: result.data.programs };
}