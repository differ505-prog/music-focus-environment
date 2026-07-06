'use client';

import { useEffect, useRef, useState } from 'react';

import { copyTextToClipboard } from '@/lib/clipboard';
import type { ThemeProgram } from "@/types/music";

type ThemeProgramPanelProps = {
  programs: readonly ThemeProgram[];
};

type SectionKey = 'strategy' | 'notes' | 'workflow' | 'seed' | 'checklist';

type SectionState = Record<SectionKey, boolean>;

type FeedbackMap = Record<string, string>;
type SupplementalInputMap = Record<string, string>;
type WorkingPromptDraftMap = Record<string, string>;

type StoredModuleOutput = {
  value: string;
  templateSnapshot: string;
};

type StoredModuleOutputMap = Record<string, StoredModuleOutput>;

const MODULE_OUTPUTS_STORAGE_KEY = 'theme-manual-module-outputs-v2';
const MODULE_SUPPLEMENTAL_INPUTS_STORAGE_KEY = 'theme-manual-module-supplemental-inputs-v1';

const defaultSectionState = (): SectionState => ({
  strategy: false,
  notes: false,
  workflow: false,
  seed: false,
  checklist: false,
});

function buildModuleKey(programId: string, moduleId: string) {
  return `${programId}::${moduleId}`;
}

function buildModuleSlotKey(programId: string, moduleId: string, slotIndex: number) {
  return `${buildModuleKey(programId, moduleId)}::slot-${slotIndex}`;
}

function buildModuleSectionId(programId: string, moduleId: string) {
  return `theme-module-${programId}-${moduleId}`;
}

function buildModuleTextareaId(programId: string, moduleId: string, slotIndex: number) {
  return `theme-module-textarea-${programId}-${moduleId}-${slotIndex}`;
}

function getModuleOutputSlotCount(module: ThemeProgram['promptModules'][number]) {
  return Math.max(module.outputSlots ?? 1, 1);
}

function getModuleOutputSlotLabel(
  module: ThemeProgram['promptModules'][number],
  slotIndex: number,
  fallbackPrefix = '候選 Prompt',
) {
  return (
    module.outputSlotLabels?.[slotIndex] ??
    (getModuleOutputSlotCount(module) > 1
      ? `${fallbackPrefix} ${String(slotIndex + 1).padStart(2, '0')}`
      : '此步驟輸出')
  );
}

function combineModuleOutputs(
  programId: string,
  module: ThemeProgram['promptModules'][number],
  moduleOutputs: Record<string, string>,
) {
  const slotCount = getModuleOutputSlotCount(module);
  const outputs = Array.from({ length: slotCount }, (_, slotIndex) => {
    const value = moduleOutputs[buildModuleSlotKey(programId, module.id, slotIndex)]?.trim() ?? '';

    if (!value) {
      return null;
    }

    return slotCount > 1
      ? `===== ${getModuleOutputSlotLabel(module, slotIndex)} =====\n${value}`
      : value;
  }).filter((value): value is string => Boolean(value));

  return outputs.join('\n\n');
}

function extractTemplateReferencedModuleIds(template: string) {
  return Array.from(template.matchAll(/【貼上\s+(Module\s+\d+)\s+結果】/g)).map((match) => match[1]);
}

function getReferencedUpstreamModules(
  program: ThemeProgram,
  moduleIndex: number,
  targetModule: ThemeProgram['promptModules'][number],
) {
  const explicitlyConfiguredIds = targetModule.upstreamModuleIds ?? [];
  const templateReferencedIds = extractTemplateReferencedModuleIds(targetModule.template);
  const fallbackIds = program.promptModules.slice(0, moduleIndex).map((module) => module.id);
  const candidateIds =
    explicitlyConfiguredIds.length > 0
      ? explicitlyConfiguredIds
      : templateReferencedIds.length > 0
        ? templateReferencedIds
        : fallbackIds;
  const previousModuleIds = new Set(program.promptModules.slice(0, moduleIndex).map((module) => module.id));
  const seenIds = new Set<string>();

  return candidateIds
    .filter((moduleId) => previousModuleIds.has(moduleId))
    .filter((moduleId) => {
      if (seenIds.has(moduleId)) {
        return false;
      }

      seenIds.add(moduleId);
      return true;
    })
    .map((moduleId) => program.promptModules.find((module) => module.id === moduleId) ?? null)
    .filter((module): module is ThemeProgram['promptModules'][number] => Boolean(module));
}

function getMissingUpstreamModules(
  program: ThemeProgram,
  moduleIndex: number,
  targetModule: ThemeProgram['promptModules'][number],
  moduleOutputs: Record<string, string>,
) {
  return getReferencedUpstreamModules(program, moduleIndex, targetModule).filter(
    (module) => !combineModuleOutputs(program.id, module, moduleOutputs).trim(),
  );
}

function buildUpstreamPayload(
  program: ThemeProgram,
  moduleIndex: number,
  targetModule: ThemeProgram['promptModules'][number],
  moduleOutputs: Record<string, string>,
) {
  const upstreamModules = getReferencedUpstreamModules(program, moduleIndex, targetModule)
    .map((module) => ({
      title: module.title,
      output: combineModuleOutputs(program.id, module, moduleOutputs),
    }))
    .filter((item) => item.output.length > 0);

  return upstreamModules
    .map((item) => `${item.title}\n${item.output}`)
    .join('\n\n--------------------\n\n');
}

function buildWorkingPrompt(
  program: ThemeProgram,
  moduleIndex: number,
  targetModule: ThemeProgram['promptModules'][number],
  moduleOutputs: Record<string, string>,
  supplementalInputs: SupplementalInputMap,
) {
  const upstreamModules = getReferencedUpstreamModules(program, moduleIndex, targetModule);
  const upstreamPayload = buildUpstreamPayload(program, moduleIndex, targetModule, moduleOutputs);
  const resolvedTemplate = upstreamModules.reduce((template, module) => {
    const output = combineModuleOutputs(program.id, module, moduleOutputs).trim();
    const replacement = output || `【待補 ${module.title} 結果】`;
    return template.replaceAll(`【貼上 ${module.id} 結果】`, replacement);
  }, targetModule.template);

  if (targetModule.inputMode === 'low_input_auto_context') {
    const assembledContext = buildLowInputAssembly(
      program,
      moduleIndex,
      targetModule,
      moduleOutputs,
      supplementalInputs[buildModuleKey(program.id, targetModule.id)] ?? '',
    );

    return `${resolvedTemplate}\n\n自動整理參考資料：\n${assembledContext}`;
  }

  const hasExplicitPlaceholders = extractTemplateReferencedModuleIds(targetModule.template).length > 0;

  if (!hasExplicitPlaceholders && upstreamPayload) {
    return `${resolvedTemplate}\n\n參考資料：\n${upstreamPayload}`;
  }

  return resolvedTemplate;
}

function buildTemplateSnapshotMap(programs: readonly ThemeProgram[]) {
  return Object.fromEntries(
    programs.flatMap((program) =>
      program.promptModules.flatMap((module) =>
        Array.from({ length: getModuleOutputSlotCount(module) }, (_, slotIndex) => [
          buildModuleSlotKey(program.id, module.id, slotIndex),
          module.template,
        ]),
      ),
    ),
  );
}

function buildLowInputAssembly(
  program: ThemeProgram,
  moduleIndex: number,
  targetModule: ThemeProgram['promptModules'][number],
  moduleOutputs: Record<string, string>,
  supplementalInput: string,
) {
  const upstreamPayload = buildUpstreamPayload(program, moduleIndex, targetModule, moduleOutputs);
  const extraInstructions = targetModule.autoAssembleInstructions?.length
    ? [
        '',
        '以下是必須一起執行的檢查與命名 SOP：',
        ...targetModule.autoAssembleInstructions.map((instruction, index) => `${index + 1}. ${instruction}`),
      ]
    : [];

  return [
    '以下是已自動整理的上游結果，請直接使用，不要要求我重新貼一次：',
    upstreamPayload || '目前沒有已儲存的上游結果。',
    ...extraInstructions,
    '',
    '以下是少量補充資料（可能為空，僅在有提供時覆寫對應欄位）：',
    supplementalInput.trim() || '無',
  ].join('\n');
}

export function ThemeProgramPanel({ programs }: ThemeProgramPanelProps) {
  const [activeProgramId, setActiveProgramId] = useState<string | null>(null);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, SectionState>>({});
  const [moduleOutputs, setModuleOutputs] = useState<Record<string, string>>({});
  const [feedbackMap, setFeedbackMap] = useState<FeedbackMap>({});
  const [supplementalInputs, setSupplementalInputs] = useState<SupplementalInputMap>({});
  const [workingPromptDrafts, setWorkingPromptDrafts] = useState<WorkingPromptDraftMap>({});
  const previousGeneratedWorkingPromptsRef = useRef<WorkingPromptDraftMap>({});

  useEffect(() => {
    setCollapsedSections((current) => {
      const nextState = { ...current };

      for (const program of programs) {
        nextState[program.id] = current[program.id] ?? defaultSectionState();
      }

      return nextState;
    });

    if (programs.length > 0) {
      setActiveProgramId((current) => current ?? programs[0].id);
    }
  }, [programs]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      const saved = window.localStorage.getItem(MODULE_OUTPUTS_STORAGE_KEY);
      const templateSnapshots = buildTemplateSnapshotMap(programs);

      if (!saved) {
        return;
      }

      const parsed = JSON.parse(saved) as StoredModuleOutputMap;
      const nextOutputs = Object.fromEntries(
        Object.entries(parsed)
          .filter((entry): entry is [string, StoredModuleOutput] => {
            const [key, item] = entry;

            return (
              typeof item?.value === 'string' &&
              typeof item?.templateSnapshot === 'string' &&
              item.templateSnapshot === templateSnapshots[key]
            );
          })
          .map(([key, item]) => [key, item.value]),
      );

      setModuleOutputs(nextOutputs);
      window.localStorage.setItem(
        MODULE_OUTPUTS_STORAGE_KEY,
        JSON.stringify(
          Object.fromEntries(
            Object.entries(nextOutputs).map(([key, value]) => [
              key,
              {
                value,
                templateSnapshot: templateSnapshots[key],
              },
            ]),
          ),
        ),
      );
    } catch {
      window.localStorage.removeItem(MODULE_OUTPUTS_STORAGE_KEY);
    }
  }, [programs]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      const saved = window.localStorage.getItem(MODULE_SUPPLEMENTAL_INPUTS_STORAGE_KEY);

      if (!saved) {
        return;
      }

      const parsed = JSON.parse(saved) as SupplementalInputMap;
      setSupplementalInputs(parsed);
    } catch {
      window.localStorage.removeItem(MODULE_SUPPLEMENTAL_INPUTS_STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    const nextGeneratedPrompts: WorkingPromptDraftMap = {};

    setWorkingPromptDrafts((current) => {
      let didChange = false;
      const nextDrafts = { ...current };

      for (const program of programs) {
        for (let moduleIndex = 1; moduleIndex < program.promptModules.length; moduleIndex += 1) {
          const targetModule = program.promptModules[moduleIndex];
          const moduleKey = buildModuleKey(program.id, targetModule.id);
          const generatedPrompt = buildWorkingPrompt(
            program,
            moduleIndex,
            targetModule,
            moduleOutputs,
            supplementalInputs,
          );

          nextGeneratedPrompts[moduleKey] = generatedPrompt;

          const currentDraft = current[moduleKey] ?? '';
          const previousGeneratedPrompt = previousGeneratedWorkingPromptsRef.current[moduleKey] ?? '';
          const shouldSync =
            !currentDraft ||
            currentDraft === previousGeneratedPrompt ||
            (currentDraft.includes('【待補') && !generatedPrompt.includes('【待補'));

          if (shouldSync && currentDraft !== generatedPrompt) {
            nextDrafts[moduleKey] = generatedPrompt;
            didChange = true;
          }
        }
      }

      return didChange ? nextDrafts : current;
    });

    previousGeneratedWorkingPromptsRef.current = nextGeneratedPrompts;
  }, [programs, moduleOutputs, supplementalInputs]);

  const setFeedback = (key: string, message: string) => {
    setFeedbackMap((current) => ({
      ...current,
      [key]: message,
    }));
  };

  const toggleSection = (programId: string, section: SectionKey) => {
    setCollapsedSections((current) => ({
      ...current,
      [programId]: {
        ...(current[programId] ?? defaultSectionState()),
        [section]: !(current[programId] ?? defaultSectionState())[section],
      },
    }));
  };

  const focusModuleFirstOutput = (programId: string, moduleId: string) => {
    if (typeof document === 'undefined') {
      return;
    }

    const textarea = document.getElementById(buildModuleTextareaId(programId, moduleId, 0)) as HTMLTextAreaElement | null;
    const section = document.getElementById(buildModuleSectionId(programId, moduleId));

    section?.scrollIntoView({ behavior: 'smooth', block: 'center' });

    if (textarea) {
      window.setTimeout(() => {
        textarea.focus();
        textarea.select();
      }, 160);
    }
  };

  const handleModuleOutputChange = (programId: string, moduleId: string, slotIndex: number, value: string) => {
    const key = buildModuleSlotKey(programId, moduleId, slotIndex);

    setModuleOutputs((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const handleSupplementalInputChange = (programId: string, moduleId: string, value: string) => {
    const key = buildModuleKey(programId, moduleId);

    setSupplementalInputs((current) => {
      const nextInputs = {
        ...current,
        [key]: value,
      };

      if (typeof window !== 'undefined') {
        window.localStorage.setItem(MODULE_SUPPLEMENTAL_INPUTS_STORAGE_KEY, JSON.stringify(nextInputs));
      }

      return nextInputs;
    });
  };

  const handleWorkingPromptDraftChange = (programId: string, moduleId: string, value: string) => {
    const key = buildModuleKey(programId, moduleId);

    setWorkingPromptDrafts((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const handleSaveModuleOutput = (programId: string, moduleId: string) => {
    if (typeof window === 'undefined') {
      return;
    }

    const targetProgram = programs.find((program) => program.id === programId);
    const moduleIndex = targetProgram?.promptModules.findIndex((item) => item.id === moduleId) ?? -1;
    const targetPromptModule = moduleIndex >= 0 ? targetProgram?.promptModules[moduleIndex] : undefined;

    if (!targetPromptModule || !targetProgram) {
      return;
    }

    const moduleKey = buildModuleKey(programId, moduleId);
    const nextOutputs = { ...moduleOutputs };

    for (let slotIndex = 0; slotIndex < getModuleOutputSlotCount(targetPromptModule); slotIndex += 1) {
      const slotKey = buildModuleSlotKey(programId, moduleId, slotIndex);
      nextOutputs[slotKey] = moduleOutputs[slotKey] ?? '';
    }

    const currentModuleOutput = combineModuleOutputs(programId, targetPromptModule, nextOutputs);

    if (!currentModuleOutput.trim()) {
      setFeedback(moduleKey, '目前沒有可儲存內容，請先把 AI 回傳結果貼到下方輸出框');
      focusModuleFirstOutput(programId, moduleId);
      return;
    }

    const nextModule = targetProgram.promptModules[moduleIndex + 1];

    const storedOutputs = Object.fromEntries(
      Object.entries(nextOutputs).map(([entryKey, value]) => [
        entryKey,
        {
          value,
          templateSnapshot: buildTemplateSnapshotMap(programs)[entryKey] ?? '',
        },
      ]),
    );

    window.localStorage.setItem(MODULE_OUTPUTS_STORAGE_KEY, JSON.stringify(storedOutputs));
    setModuleOutputs(nextOutputs);
    setFeedback(
      moduleKey,
      targetPromptModule.autoAdvanceToNext && nextModule
        ? '已儲存，並自動預填到下一步工作框'
        : getModuleOutputSlotCount(targetPromptModule) > 1
          ? '已儲存此步驟全部候選結果'
          : '已儲存，可供後續步驟取用',
    );

    if (targetPromptModule.autoAdvanceToNext && nextModule) {
      setFeedback(
        buildModuleKey(programId, nextModule.id),
        nextModule.inputMode === 'low_input_auto_context'
          ? '已接收上一步結果，並自動組裝低輸入內容'
          : '已接收上一步結果，工作框已自動預填',
      );
    }
  };

  const handleCopyText = async (feedbackKey: string, value: string, successMessage: string) => {
    if (!value.trim()) {
      setFeedback(feedbackKey, '目前沒有可複製內容');
      return;
    }

    const copied = await copyTextToClipboard(value);

    if (copied) {
      setFeedback(feedbackKey, successMessage);
    } else {
      setFeedback(feedbackKey, '複製失敗，請改用手動複製');
    }
  };

  const handleInsertUpstream = async (program: ThemeProgram, moduleIndex: number) => {
    const targetModule = program.promptModules[moduleIndex];
    const missingUpstreamModules = getMissingUpstreamModules(program, moduleIndex, targetModule, moduleOutputs);

    if (missingUpstreamModules.length > 0) {
      setFeedback(
        buildModuleKey(program.id, targetModule.id),
        `請先完成並儲存 ${missingUpstreamModules.map((module) => module.title).join(' / ')}`,
      );
      return;
    }

    const nextPrompt = buildWorkingPrompt(
      program,
      moduleIndex,
      targetModule,
      moduleOutputs,
      supplementalInputs,
    );
    const hasUpstreamPayload = Boolean(buildUpstreamPayload(program, moduleIndex, targetModule, moduleOutputs).trim());

    handleWorkingPromptDraftChange(program.id, targetModule.id, nextPrompt);
    const copied = await copyTextToClipboard(nextPrompt);

    if (copied) {
      setFeedback(
        buildModuleKey(program.id, targetModule.id),
        hasUpstreamPayload
          ? '已帶入工作框，並直接複製到剪貼簿'
          : '已帶入模板並複製；待上一步內容補齊後會自動更新',
      );
    } else {
      setFeedback(
        buildModuleKey(program.id, targetModule.id),
        hasUpstreamPayload ? '已帶入工作框，可直接取用或再編輯' : '已帶入模板；待上一步內容補齊後會自動更新',
      );
    }
  };

  const handleAssembleLowInput = async (program: ThemeProgram, moduleIndex: number) => {
    const targetModule = program.promptModules[moduleIndex];
    const assembledPrompt = buildWorkingPrompt(
      program,
      moduleIndex,
      targetModule,
      moduleOutputs,
      supplementalInputs,
    );

    handleWorkingPromptDraftChange(program.id, targetModule.id, assembledPrompt);
    const copied = await copyTextToClipboard(assembledPrompt);

    if (copied) {
      setFeedback(buildModuleKey(program.id, targetModule.id), '已自動帶入工作框，並直接複製到剪貼簿');
    } else {
      setFeedback(buildModuleKey(program.id, targetModule.id), '已自動帶入工作框');
    }
  };

  const renderSectionToggle = (programId: string, section: SectionKey, label: string) => {
    const isCollapsed = (collapsedSections[programId] ?? defaultSectionState())[section];

    return (
      <button
        type="button"
        onClick={() => toggleSection(programId, section)}
        className="flex w-full items-center justify-between rounded-[18px] border border-white/8 bg-white/6 px-4 py-3 text-left transition hover:bg-white/10"
      >
        <span className="text-xs uppercase tracking-[0.24em] text-white/48">{label}</span>
        <span className="text-xs text-white/58">{isCollapsed ? '展開' : '收合'}</span>
      </button>
    );
  };

  return (
    <section className="rounded-[28px] border border-fuchsia-400/14 bg-white/8 p-5 shadow-[0_32px_90px_rgba(8,9,28,0.46)] backdrop-blur-2xl md:p-6">
      <div className="mb-5">
        <p className="text-xs uppercase tracking-[0.32em] text-fuchsia-100/60">主題手冊</p>
        <h2 className="mt-3 font-serif text-2xl text-white md:text-3xl">主題管理</h2>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-white/66">
          常用步驟已集中在前面，其餘說明可展開查看。每一步都可貼上、儲存並接續使用。
        </p>
      </div>

      {/* Program tab navigation */}
      <div className="mb-6 flex flex-wrap gap-2">
        {programs.map((program) => (
          <button
            key={program.id}
            type="button"
            onClick={() => setActiveProgramId(program.id)}
            className={`rounded-full border px-4 py-2 text-xs font-medium transition ${
              activeProgramId === program.id
                ? 'border-fuchsia-400/50 bg-fuchsia-400/20 text-fuchsia-100'
                : 'border-white/10 bg-white/6 text-white/58 hover:border-white/20 hover:bg-white/10 hover:text-white/80'
            }`}
          >
            {program.label}
          </button>
        ))}
      </div>

      {/* Only render the active program */}
      {programs
        .filter((program) => program.id === activeProgramId)
        .map((program) => (
          <article
            key={program.id}
            className="min-w-0 overflow-hidden rounded-[24px] border border-white/10 bg-black/18 p-4 text-sm text-white/72"
          >
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-full border border-fuchsia-400/20 bg-fuchsia-400/10 px-3 py-1 text-xs uppercase tracking-[0.28em] text-fuchsia-100/85">
                {program.label}
              </span>
              <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs text-cyan-100/85">
                {program.bpmDisplay}
              </span>
            </div>

            <h3 className="mt-4 font-serif text-2xl text-white">{program.title}</h3>
            <p className="mt-3 leading-7 text-white/66">{program.summary}</p>
            <p className="mt-3 text-xs uppercase tracking-[0.24em] text-white/42">適用場景</p>
            <p className="mt-2 text-sm leading-6 text-white/74">{program.audience}</p>

            <div className="mt-5 rounded-[20px] border border-cyan-300/12 bg-[#07101a]/88 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-cyan-100/60">製作步驟</p>
                  <p className="mt-2 text-xs leading-6 text-cyan-50/72">
                    常用步驟集中在這裡。先生成、貼上並儲存，後續可直接接著做。
                  </p>
                </div>
                <div className="rounded-full border border-cyan-300/18 bg-cyan-300/10 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-cyan-50/74">
                  常用
                </div>
              </div>
              <div className="mt-4 grid gap-3">
                {program.promptModules.map((module, moduleIndex) => {
                  const moduleKey = buildModuleKey(program.id, module.id);
                  const upstreamPayload = buildUpstreamPayload(program, moduleIndex, module, moduleOutputs);
                  const feedback = feedbackMap[moduleKey];
                  const slotCount = getModuleOutputSlotCount(module);
                  const combinedOutput = combineModuleOutputs(program.id, module, moduleOutputs);
                  const hasSavedCurrentModuleOutput = Boolean(combinedOutput.trim());
                  const supplementalInput = supplementalInputs[moduleKey] ?? '';
                  const isLowInputModule = module.inputMode === 'low_input_auto_context';
                  const missingUpstreamModules = getMissingUpstreamModules(program, moduleIndex, module, moduleOutputs);
                  const hasMissingUpstreamModules = missingUpstreamModules.length > 0;
                  const canInsertUpstream = moduleIndex > 0;
                  const workingPrompt = buildWorkingPrompt(
                    program,
                    moduleIndex,
                    module,
                    moduleOutputs,
                    supplementalInputs,
                  );
                  const workingPromptValue = workingPromptDrafts[moduleKey] ?? workingPrompt;

                  return (
                    <div
                      key={module.id}
                      id={buildModuleSectionId(program.id, module.id)}
                      className="min-w-0 overflow-hidden rounded-[18px] border border-cyan-300/12 bg-black/18 p-4"
                    >
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="rounded-full border border-cyan-300/18 bg-cyan-300/10 px-2 py-1 text-[11px] uppercase tracking-[0.2em] text-cyan-50/72">
                          {module.id}
                        </span>
                        <h4 className="text-sm font-medium text-white">{module.title}</h4>
                      </div>
                      <p className="mt-2 text-xs leading-6 text-cyan-50/70">{module.purpose}</p>
                      <pre className="mt-3 overflow-hidden whitespace-pre-wrap break-words rounded-[16px] border border-white/8 bg-[#07101a]/90 p-4 text-xs leading-6 text-cyan-50/82">
                        <code>{module.template}</code>
                      </pre>

                      {moduleIndex === 0 ? (
                        <div className="mt-4 rounded-[16px] border border-amber-300/14 bg-[#181208]/84 p-4">
                          <p className="text-[11px] uppercase tracking-[0.2em] text-amber-100/60">
                            下一步來源說明
                          </p>
                          <p className="mt-2 text-xs leading-6 text-amber-50/78">
                            Module 02 讀取的是下方「此步驟輸出」已儲存內容，不是上面的模板。請把 AI 回傳的 brief 貼到下方，再按「儲存此步驟結果」。
                          </p>
                          <p className="mt-2 text-xs leading-6 text-amber-50/70">
                            {hasSavedCurrentModuleOutput ? '目前狀態：已儲存，可供下一步帶入。' : '目前狀態：尚未儲存，下一步會顯示待補提示。'}
                          </p>
                        </div>
                      ) : null}

                      {moduleIndex > 0 ? (
                        <div className="mt-4 rounded-[16px] border border-fuchsia-400/12 bg-[#120d21]/70 p-4">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-[11px] uppercase tracking-[0.2em] text-fuchsia-100/55">
                                自動組裝工作指令
                              </p>
                              <p className="mt-2 text-xs leading-6 text-fuchsia-50/74">
                                {hasMissingUpstreamModules
                                  ? `尚未取得 ${missingUpstreamModules.map((item) => item.title).join(' / ')} 的已儲存結果。`
                                  : '這一框會把前一步已儲存內容自動帶入模板，直接複製給 AI 使用。'}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                hasMissingUpstreamModules
                                  ? (() => {
                                      setFeedback(
                                        moduleKey,
                                        `請先完成並儲存 ${missingUpstreamModules[0].title}`,
                                      );
                                      focusModuleFirstOutput(program.id, missingUpstreamModules[0].id);
                                    })()
                                  : handleCopyText(
                                      `${moduleKey}::working-prompt`,
                                      workingPromptValue,
                                      '自動組裝工作指令已複製',
                                    )
                              }
                              className="rounded-full border border-fuchsia-400/20 bg-fuchsia-400/10 px-3 py-1.5 text-[11px] text-fuchsia-50/82 transition hover:bg-fuchsia-400/14"
                            >
                              {hasMissingUpstreamModules ? `前往 ${missingUpstreamModules[0].title}` : '複製此框'}
                            </button>
                          </div>
                          <textarea
                            value={workingPromptValue}
                            onChange={(event) =>
                              handleWorkingPromptDraftChange(program.id, module.id, event.target.value)
                            }
                            className="mt-3 min-h-48 w-full rounded-[16px] border border-white/8 bg-[#090512]/90 p-4 text-xs leading-6 text-fuchsia-50/82 outline-none transition placeholder:text-fuchsia-50/28 focus:border-fuchsia-300/28"
                            placeholder="這裡會顯示可直接送進 AI 的完整工作指令。"
                          />
                        </div>
                      ) : null}

                      {isLowInputModule ? (
                        <div className="mt-4 rounded-[16px] border border-amber-300/12 bg-[#151108]/80 p-4">
                          <p className="text-[11px] uppercase tracking-[0.2em] text-amber-100/60">
                            少量補充
                          </p>
                          <p className="mt-2 text-xs leading-6 text-amber-50/76">
                            {module.autoAssembleNote ??
                              '這一步會自動承接前面已儲存的結果，你只需要補少量外部資源或特別指定欄位。'}
                          </p>
                          <div className="mt-4">
                            <p className="text-xs uppercase tracking-[0.2em] text-white/48">
                              {module.supplementalLabel ?? '少量補充資料'}
                            </p>
                            <textarea
                              value={supplementalInput}
                              onChange={(event) =>
                                handleSupplementalInputChange(program.id, module.id, event.target.value)
                              }
                              placeholder={
                                module.supplementalPlaceholder ??
                                '只補 audioUrl、coverImageUrl、backgroundVideoUrl、durationSeconds 或你指定要覆寫的欄位。'
                              }
                              className="mt-3 min-h-28 w-full rounded-[16px] border border-white/10 bg-[#04070c] px-4 py-3 text-sm leading-7 text-white outline-none transition placeholder:text-white/28 focus:border-amber-300/28"
                            />
                          </div>
                        </div>
                      ) : null}

                      <div className="mt-4 flex flex-wrap gap-2">
                        {module.quickLinks?.map((link) => (
                          <a
                            key={`${module.id}-${link.url}`}
                            href={link.url}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-2 text-xs text-cyan-50/82 transition hover:bg-cyan-300/16"
                          >
                            {link.label}
                          </a>
                        ))}
                        <button
                          type="button"
                          onClick={() =>
                            handleCopyText(`${moduleKey}::template`, module.template, '模板已複製')
                          }
                          className="rounded-full border border-white/10 bg-white/8 px-3 py-2 text-xs text-white/72 transition hover:bg-white/12"
                        >
                          複製模板
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            isLowInputModule
                              ? handleAssembleLowInput(program, moduleIndex)
                              : handleInsertUpstream(program, moduleIndex)
                          }
                          className={`rounded-full border px-3 py-2 text-xs transition ${
                            canInsertUpstream
                              ? 'border-fuchsia-400/20 bg-fuchsia-400/10 text-fuchsia-50/82 hover:bg-fuchsia-400/14'
                              : 'border-white/10 bg-white/6 text-white/62 hover:bg-white/10'
                          }`}
                        >
                          {hasMissingUpstreamModules
                            ? '先完成上一步'
                            : isLowInputModule
                              ? '帶入並複製前面內容'
                              : '帶入並複製上一步內容'}
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            handleCopyText(
                              `${moduleKey}::output`,
                              combinedOutput,
                              '此步驟結果已複製',
                            )
                          }
                          className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-2 text-xs text-emerald-50/82 transition hover:bg-emerald-300/14"
                        >
                          複製此步驟全部結果
                        </button>
                      </div>

                      {upstreamPayload ? (
                        <div className="mt-3 rounded-[16px] border border-fuchsia-400/12 bg-[#120d21]/70 p-3">
                          <p className="text-[11px] uppercase tracking-[0.2em] text-fuchsia-100/55">
                            已帶入前一步內容
                          </p>
                          <p className="mt-2 text-xs leading-6 text-fuchsia-50/74">
                            {isLowInputModule
                              ? '前面步驟的結果已可直接帶進這一步，減少手動整理。'
                              : '前面步驟的結果已可直接帶進這一步，避免重複貼資料。'}
                          </p>
                        </div>
                      ) : null}

                      <div className="mt-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <p className="text-[11px] uppercase tracking-[0.2em] text-white/48">
                            {isLowInputModule
                              ? '帶入後編輯區'
                              : slotCount > 1
                                ? `此步驟輸出（${slotCount} 組候選）`
                                : '此步驟輸出'}
                          </p>
                          <span className="text-xs text-cyan-50/64">
                            {feedback ??
                              feedbackMap[`${moduleKey}::working-prompt`] ??
                              feedbackMap[`${moduleKey}::template`] ??
                              feedbackMap[`${moduleKey}::output`] ??
                              '可貼上 AI 生成結果'}
                          </span>
                        </div>
                        <div className="mt-3 grid gap-3">
                          {Array.from({ length: slotCount }, (_, slotIndex) => {
                            const slotKey = buildModuleSlotKey(program.id, module.id, slotIndex);
                            const slotLabel = getModuleOutputSlotLabel(module, slotIndex);

                            return (
                              <div
                                key={slotKey}
                                className="min-w-0 overflow-hidden rounded-[16px] border border-white/8 bg-[#04070c]/70 p-3"
                              >
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                  <p className="text-xs uppercase tracking-[0.2em] text-white/48">{slotLabel}</p>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleCopyText(
                                        `${slotKey}::output`,
                                        moduleOutputs[slotKey] ?? '',
                                        `${slotLabel} 已複製`,
                                      )
                                    }
                                    className="rounded-full border border-white/10 bg-white/8 px-3 py-1.5 text-[11px] text-white/72 transition hover:bg-white/12"
                                  >
                                    複製此框
                                  </button>
                                </div>
                                <textarea
                                  id={buildModuleTextareaId(program.id, module.id, slotIndex)}
                                  value={moduleOutputs[slotKey] ?? ''}
                                  onChange={(event) =>
                                    handleModuleOutputChange(program.id, module.id, slotIndex, event.target.value)
                                  }
                                  placeholder={`把 ${slotLabel} 貼在這裡，儲存後可供後面步驟直接插入或複製。`}
                                  className="mt-3 min-h-40 w-full rounded-[16px] border border-white/10 bg-[#04070c] px-4 py-3 text-sm leading-7 text-white outline-none transition placeholder:text-white/28 focus:border-cyan-300/28"
                                />
                              </div>
                            );
                          })}
                        </div>
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleSaveModuleOutput(program.id, module.id)}
                            className={`rounded-full border px-3 py-2 text-xs font-medium transition ${
                              hasSavedCurrentModuleOutput
                                ? 'border-cyan-300/20 bg-cyan-300/10 text-cyan-50 hover:bg-cyan-300/16'
                                : 'border-white/10 bg-white/8 text-white/82 hover:bg-white/12'
                            }`}
                          >
                            {slotCount > 1 ? '儲存此步驟全部候選結果' : '儲存此步驟結果'}
                          </button>
                          <span className="text-xs text-white/45">
                            {hasSavedCurrentModuleOutput
                              ? slotCount > 1
                                ? '已可重新儲存；後續模組會讀取這兩組候選內容。'
                                : '已可重新儲存；後續模組會讀取這份內容。'
                              : slotCount > 1
                                ? '請先把 AI 回傳的候選內容貼到下方輸出框，再儲存。'
                                : '請先把 AI 回傳內容貼到下方輸出框，再儲存。'}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-5">
              {renderSectionToggle(program.id, 'strategy', '戰略定位')}
              {(collapsedSections[program.id] ?? defaultSectionState()).strategy ? null : (
                <div className="mt-3 rounded-[20px] border border-white/8 bg-white/6 p-4">
                  <p className="text-sm leading-7 text-white/74">{program.positioning}</p>
                  <div className="mt-4 grid gap-3">
                    {program.operatingPrinciples.map((principle) => (
                      <div key={principle} className="rounded-[18px] border border-white/8 bg-black/20 p-3">
                        <p className="text-xs leading-6 text-white/68">{principle}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-5">
              {renderSectionToggle(program.id, 'workflow', '步驟流程')}
              {(collapsedSections[program.id] ?? defaultSectionState()).workflow ? null : (
                <div className="mt-3 grid gap-3">
                  {program.workflow.map((step) => (
                    <div
                      key={step.id}
                      className="rounded-[18px] border border-fuchsia-400/10 bg-[#0a0817]/88 p-3"
                    >
                      <div className="flex items-center gap-3">
                        <span className="rounded-full border border-white/10 bg-white/8 px-2 py-1 text-[11px] uppercase tracking-[0.2em] text-white/62">
                          {step.id}
                        </span>
                        <h4 className="text-sm font-medium text-white">{step.title}</h4>
                      </div>
                      <p className="mt-2 text-xs leading-6 text-white/62">{step.detail}</p>
                      <p className="mt-3 text-[11px] uppercase tracking-[0.2em] text-fuchsia-100/55">
                        交付物
                      </p>
                      <p className="mt-2 text-xs leading-6 text-fuchsia-50/76">{step.deliverable}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-5 grid gap-3">
              <div>
                {renderSectionToggle(program.id, 'notes', '介面與內容原則')}
                {(collapsedSections[program.id] ?? defaultSectionState()).notes ? null : (
                  <div className="mt-3 grid gap-3 md:grid-cols-3">
                    {program.layoutNotes.map((note) => (
                      <div key={note} className="rounded-[18px] border border-white/8 bg-white/6 p-3">
                        <p className="text-xs leading-6 text-white/65">{note}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                {renderSectionToggle(program.id, 'seed', '初始提示')}
                {(collapsedSections[program.id] ?? defaultSectionState()).seed ? null : (
                  <div className="mt-3 rounded-[18px] border border-cyan-300/12 bg-[#07101a]/88 p-4">
                    <pre className="overflow-hidden whitespace-pre-wrap break-words text-xs leading-6 text-cyan-50/82">
                      <code>{program.promptSeed}</code>
                    </pre>
                  </div>
                )}
              </div>

              <div>
                {renderSectionToggle(program.id, 'checklist', '驗收清單')}
                {(collapsedSections[program.id] ?? defaultSectionState()).checklist ? null : (
                  <div className="mt-3 rounded-[18px] border border-emerald-300/12 bg-[#07130f]/88 p-4">
                    <div className="grid gap-3">
                      {program.acceptanceChecklist.map((item) => (
                        <div key={item.id} className="rounded-[16px] border border-white/8 bg-black/18 p-3">
                          <div className="flex items-center gap-3">
                            <span className="rounded-full border border-white/10 bg-white/8 px-2 py-1 text-[11px] uppercase tracking-[0.2em] text-white/62">
                              {item.id}
                            </span>
                            <h4 className="text-sm font-medium text-white">{item.title}</h4>
                          </div>
                          <p className="mt-2 text-xs leading-6 text-emerald-50/72">{item.detail}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </article>
        ))}
    </section>
  );
}
