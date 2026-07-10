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
  const [activeStepIndex, setActiveStepIndex] = useState<number>(0);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, SectionState>>({});
  const [collapsedTemplates, setCollapsedTemplates] = useState<Set<string>>(new Set()); // which module templates are collapsed
  const [collapsedOutputs, setCollapsedOutputs] = useState<Set<string>>(new Set()); // which module output areas are collapsed
  const [collapsedWorking, setCollapsedWorking] = useState<Set<string>>(new Set()); // which working-prompt areas are collapsed
  const [moduleOutputs, setModuleOutputs] = useState<Record<string, string>>({});
  const [feedbackMap, setFeedbackMap] = useState<FeedbackMap>({});
  const [supplementalInputs, setSupplementalInputs] = useState<SupplementalInputMap>({});
  const [workingPromptDrafts, setWorkingPromptDrafts] = useState<WorkingPromptDraftMap>({});
  const previousGeneratedWorkingPromptsRef = useRef<WorkingPromptDraftMap>({});
  // Bug 3 fix: track which working-prompt drafts the user has manually edited,
  // so the auto-sync effect stops overwriting their work.
  const userTouchedDraftsRef = useRef<Set<string>>(new Set());

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
      setActiveStepIndex(0);
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

  // Bug 1 + 6 fix: track when the user has manually selected a step,
  // so the auto-advance after save doesn't override their navigation.
  const userTouchedStepRef = useRef(false);

  // When active program changes, reset step to 0 and let auto-advance take over
  useEffect(() => {
    setActiveStepIndex(0);
    userTouchedStepRef.current = false;
  }, [activeProgramId]);

  // Auto-advance after save: only run when the user hasn't manually picked a step
  // AND a save just happened (tracked via a sentinel in moduleOutputs ref).
  // We avoid the broken pattern of running on every moduleOutputs change,
  // which previously yanked the user away from the step they were editing.
  const lastSeenOutputsRef = useRef<Record<string, string>>({});
  useEffect(() => {
    if (!activeProgramId) return;
    const program = programs.find((p) => p.id === activeProgramId);
    if (!program) return;

    // Detect if moduleOutputs changed via a save action (new key or value growth).
    // We only auto-advance if user hasn't manually selected a step.
    if (userTouchedStepRef.current) {
      lastSeenOutputsRef.current = moduleOutputs;
      return;
    }

    let didChange = false;
    const prev = lastSeenOutputsRef.current;
    if (Object.keys(moduleOutputs).length !== Object.keys(prev).length) {
      didChange = true;
    } else {
      for (const [key, value] of Object.entries(moduleOutputs)) {
        if (prev[key] !== value) {
          didChange = true;
          break;
        }
      }
    }

    if (didChange) {
      setActiveStepIndex(findFirstIncompleteStep(program));
    }
    lastSeenOutputsRef.current = moduleOutputs;
  }, [moduleOutputs, activeProgramId, programs]);

  useEffect(() => {
    const nextGeneratedPrompts: WorkingPromptDraftMap = {};
    const userTouchedDrafts = userTouchedDraftsRef.current;

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

          // Bug 3 fix: if the user has manually edited this draft, freeze it.
          // Without this guard, re-syncing would silently overwrite the user's edits.
          // The user can still re-trigger sync by clearing the draft (handled in handler).
          if (userTouchedDrafts.has(moduleKey)) {
            continue;
          }

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

    // Bug 3 fix: mark the draft as user-touched so the auto-sync effect stops
    // overwriting it. The user can re-trigger sync by clearing the draft manually.
    if (value !== '') {
      userTouchedDraftsRef.current.add(key);
    } else {
      userTouchedDraftsRef.current.delete(key);
    }

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

    // Bug 2 fix: only preserve existing slot values; don't write '' for empty slots.
    // The previous loop did `nextOutputs[slotKey] = moduleOutputs[slotKey] ?? ''`
    // which was a no-op for existing keys AND could overwrite unrelated slots.
    // Here we simply trust moduleOutputs as-is.
    for (let slotIndex = 0; slotIndex < getModuleOutputSlotCount(targetPromptModule); slotIndex += 1) {
      const slotKey = buildModuleSlotKey(programId, moduleId, slotIndex);
      if (!(slotKey in nextOutputs)) {
        nextOutputs[slotKey] = '';
      }
    }

    const currentModuleOutput = combineModuleOutputs(programId, targetPromptModule, nextOutputs);

    if (!currentModuleOutput.trim()) {
      setFeedback(moduleKey, '內容為空');
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
        ? '已預填至下一步'
        : getModuleOutputSlotCount(targetPromptModule) > 1
          ? '已儲存'
          : '已儲存',
    );

    if (targetPromptModule.autoAdvanceToNext && nextModule) {
      setFeedback(
        buildModuleKey(programId, nextModule.id),
        nextModule.inputMode === 'low_input_auto_context'
          ? '已自動組裝'
          : '已預填',
      );
    }
  };

  const handleCopyText = async (feedbackKey: string, value: string, successMessage: string) => {
    if (!value.trim()) {
      setFeedback(feedbackKey, '無內容');
      return;
    }

    const copied = await copyTextToClipboard(value);

    if (copied) {
      setFeedback(feedbackKey, successMessage);
    } else {
      setFeedback(feedbackKey, '複製失敗');
    }
  };

  const handleInsertUpstream = async (program: ThemeProgram, moduleIndex: number) => {
    const targetModule = program.promptModules[moduleIndex];
    const missingUpstreamModules = getMissingUpstreamModules(program, moduleIndex, targetModule, moduleOutputs);

    if (missingUpstreamModules.length > 0) {
      setFeedback(
        buildModuleKey(program.id, targetModule.id),
        `待補 ${missingUpstreamModules.map((module) => module.title).join(' / ')}`,
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
    // Bug 3 fix: explicitly re-sync since the button forced a fresh generated value
    userTouchedDraftsRef.current.delete(buildModuleKey(program.id, targetModule.id));
    const copied = await copyTextToClipboard(nextPrompt);

    if (copied) {
      setFeedback(
        buildModuleKey(program.id, targetModule.id),
        hasUpstreamPayload ? '已複製' : '已複製，模板待填充',
      );
    } else {
      // Bug 5 fix: clearly distinguish "draft filled but clipboard failed"
      // from "everything succeeded". User needs to know to copy manually.
      setFeedback(
        buildModuleKey(program.id, targetModule.id),
        hasUpstreamPayload ? '已預填，剪貼簿失敗請手動複製' : '已預填，剪貼簿失敗請手動複製',
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
    // Bug 3 fix: explicitly re-sync since the button forced a fresh generated value
    userTouchedDraftsRef.current.delete(buildModuleKey(program.id, targetModule.id));
    const copied = await copyTextToClipboard(assembledPrompt);

    if (copied) {
      setFeedback(buildModuleKey(program.id, targetModule.id), '已複製');
    } else {
      // Bug 5 fix: clearly distinguish clipboard failure from success
      setFeedback(buildModuleKey(program.id, targetModule.id), '已預填，剪貼簿失敗請手動複製');
    }
  };

  /** Find the first module index that has no saved output — the natural next step */
  function findFirstIncompleteStep(program: ThemeProgram): number {
    for (let i = 0; i < program.promptModules.length; i++) {
      const module = program.promptModules[i];
      const combined = combineModuleOutputs(program.id, module, moduleOutputs);
      if (!combined.trim()) {
        return i;
      }
    }
    return program.promptModules.length - 1;
  }

  function toggleTemplate(programId: string, moduleId: string) {
    const key = `${programId}::${moduleId}`;
    setCollapsedTemplates((current) => {
      const next = new Set(current);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  function isTemplateCollapsed(programId: string, moduleId: string) {
    return collapsedTemplates.has(`${programId}::${moduleId}`);
  }

  function toggleOutput(programId: string, moduleId: string) {
    const key = `${programId}::${moduleId}`;
    setCollapsedOutputs((current) => {
      const next = new Set(current);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  function isOutputCollapsed(programId: string, moduleId: string) {
    return collapsedOutputs.has(`${programId}::${moduleId}`);
  }

  function toggleWorking(programId: string, moduleId: string) {
    const key = `${programId}::${moduleId}`;
    setCollapsedWorking((current) => {
      const next = new Set(current);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  function isWorkingCollapsed(programId: string, moduleId: string) {
    return collapsedWorking.has(`${programId}::${moduleId}`);
  }

  function isAllStepsComplete(program: ThemeProgram) {
    return program.promptModules.every((module) => {
      const combined = combineModuleOutputs(program.id, module, moduleOutputs);
      return Boolean(combined.trim());
    });
  }

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
        <p className="mt-3 text-sm leading-7 text-white/66">
          四步 Prompt 模組，前步內容自動帶入後續。
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
                  <p className="mt-2 text-xs leading-6 text-cyan-50/72">按序完成，儲存的內容將自動帶入下一步</p>
                </div>
                <div className="rounded-full border border-cyan-300/18 bg-cyan-300/10 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-cyan-50/74">
                  常用
                </div>
              </div>
              {/* Step progress indicator */}
              <div className="mt-4 flex flex-wrap items-center gap-2">
                {program.promptModules.map((module, moduleIndex) => {
                  const combined = combineModuleOutputs(program.id, module, moduleOutputs);
                  const isDone = Boolean(combined.trim());
                  const isActive = moduleIndex === activeStepIndex;

                  return (
                    <button
                      key={module.id}
                      type="button"
                      onClick={() => {
                        userTouchedStepRef.current = true;
                        setActiveStepIndex(moduleIndex);
                      }}
                      className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition ${
                        isActive
                          ? 'border-cyan-300/50 bg-cyan-300/18 text-cyan-50'
                          : isDone
                            ? 'border-emerald-300/28 bg-emerald-300/10 text-emerald-50/80 hover:border-emerald-300/40'
                            : 'border-white/10 bg-white/6 text-white/50 hover:border-white/18 hover:text-white/70'
                      }`}
                    >
                      <span className="font-mono tabular-nums">{String(moduleIndex + 1).padStart(2, '0')}</span>
                      <span className="max-w-[8rem] truncate">{module.title}</span>
                      {isDone && <span className="opacity-50" aria-hidden>✓</span>}
                    </button>
                  );
                })}
              </div>

              {/* All-done celebration */}
              {isAllStepsComplete(program) && (
                <div className="mt-4 rounded-[16px] border border-emerald-300/28 bg-emerald-300/10 p-4">
                  <p className="text-xs font-medium uppercase tracking-widest text-emerald-100/85">全部完成</p>
                  <p className="mt-2 text-sm leading-6 text-emerald-50/78">
                    已完成全部四個步驟，可回到任意步驟重新編輯，已儲存的內容將自動帶入
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => handleCopyText(`${program.id}::all-outputs`, program.promptModules.map((m) => combineModuleOutputs(program.id, m, moduleOutputs)).join('\n\n---\n\n'), '已複製')}
                      className="rounded-full border border-emerald-300/28 bg-emerald-300/10 px-4 py-2 text-xs text-emerald-50/82 transition hover:bg-emerald-300/16"
                    >
                      一次複製全部結果
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveStepIndex(0);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className="rounded-full border border-white/10 bg-white/8 px-4 py-2 text-xs text-white/72 transition hover:bg-white/12"
                    >
                      回到第一步
                    </button>
                  </div>
                </div>
              )}

              {/* Step content: only the active step is fully rendered */}
              <div className="mt-4 grid gap-3">
                {program.promptModules.map((module, moduleIndex) => {
                  const isActive = moduleIndex === activeStepIndex;
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
                  const workingPrompt = buildWorkingPrompt(program, moduleIndex, module, moduleOutputs, supplementalInputs);
                  const workingPromptValue = workingPromptDrafts[moduleKey] ?? workingPrompt;
                  const templateCollapsed = isTemplateCollapsed(program.id, module.id);

                  // Non-active steps: collapsed single-line summary
                  if (!isActive) {
                    return (
                      <button
                        key={module.id}
                        type="button"
                        onClick={() => {
                        userTouchedStepRef.current = true;
                        setActiveStepIndex(moduleIndex);
                      }}
                        className="flex min-w-0 items-center gap-3 rounded-[18px] border border-cyan-300/10 bg-black/18 px-4 py-3 text-left transition hover:border-cyan-300/22 hover:bg-black/28"
                      >
                        <span className="shrink-0 rounded-full border border-cyan-300/18 bg-cyan-300/10 px-2 py-0.5 text-[11px] font-mono tabular-nums text-cyan-50/70">
                          {String(moduleIndex + 1).padStart(2, '0')}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-sm text-white/58">{module.title}</span>
                        {hasSavedCurrentModuleOutput ? (
                          <span className="shrink-0 text-[11px] text-emerald-400/80">已完成</span>
                        ) : hasMissingUpstreamModules ? (
                          <span className="shrink-0 text-[11px] text-amber-400/80">待補</span>
                        ) : (
                          <span className="shrink-0 text-[11px] text-white/36">待開始</span>
                        )}
                      </button>
                    );
                  }

                  // Active step: full content
                  return (
                    <div
                      key={module.id}
                      id={buildModuleSectionId(program.id, module.id)}
                      className="min-w-0 overflow-hidden rounded-[18px] border border-cyan-300/18 bg-black/18 p-4"
                    >
                      <div className="mb-3 flex flex-wrap items-center gap-3">
                        <span className="rounded-full border border-cyan-300/22 bg-cyan-300/12 px-2 py-1 text-[11px] font-mono tabular-nums uppercase tracking-widest text-cyan-50/78">
                          {module.id}
                        </span>
                        <h4 className="text-sm font-medium text-white">{module.title}</h4>
                      </div>
                      <p className="mb-3 text-xs leading-6 text-cyan-50/65">{module.purpose}</p>

                      {/* Template: collapsible */}
                      <div className="mb-4 rounded-[14px] border border-white/8 bg-[#07101a]/88">
                        <button
                          type="button"
                          onClick={() => toggleTemplate(program.id, module.id)}
                          className="flex w-full items-center justify-between px-4 py-2.5 text-left"
                        >
                          <span className="text-[11px] uppercase tracking-widest text-white/42">Prompt 模板</span>
                          <span className="text-[11px] text-white/36">{templateCollapsed ? '展開 ▸' : '收合 ▾'}</span>
                        </button>
                        {!templateCollapsed && (
                          <pre className="overflow-hidden whitespace-pre-wrap break-words border-t border-white/6 px-4 py-3 text-xs leading-6 text-cyan-50/80">
                            <code>{module.template}</code>
                          </pre>
                        )}
                      </div>

                      {moduleIndex === 0 ? (
                        <div className="mb-4 rounded-[14px] border border-amber-300/14 bg-[#181208]/84 p-4">
                          <p className="text-[11px] uppercase tracking-widest text-amber-100/60">操作說明</p>
                          <p className="mt-2 text-xs leading-6 text-amber-50/78">
                            將 AI 回傳內容貼至下方輸出區，再儲存以供後續步驟取用
                          </p>
                        </div>
                      ) : null}

                      {moduleIndex > 0 ? (
                        <div className="mb-4 rounded-[14px] border border-fuchsia-400/12 bg-[#120d21]/70 p-4">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-[11px] uppercase tracking-widest text-fuchsia-100/55">工作指令</p>
                              {hasMissingUpstreamModules && (
                                <p className="mt-2 text-xs leading-6 text-amber-50/74">
                                  待補：{missingUpstreamModules.map((item) => item.title).join(' / ')}
                                </p>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => toggleWorking(program.id, module.id)}
                                title={isWorkingCollapsed(program.id, module.id) ? '展開工作指令區' : '收合工作指令區'}
                                className="rounded-full border border-white/10 bg-white/8 px-3 py-1.5 text-[11px] text-white/60 transition hover:bg-white/12"
                              >
                                {isWorkingCollapsed(program.id, module.id) ? '展開' : '收合'}
                              </button>
                              <button
                                type="button"
                                title={hasMissingUpstreamModules ? `需先完成 ${missingUpstreamModules[0].title}` : '複製工作指令至剪貼簿'}
                                onClick={() =>
                                  hasMissingUpstreamModules
                                    ? (() => {
                                        setFeedback(moduleKey, `待補 ${missingUpstreamModules[0].title}`);
                                        focusModuleFirstOutput(program.id, missingUpstreamModules[0].id);
                                      })()
                                    : handleCopyText(`${moduleKey}::working-prompt`, workingPromptValue, '已複製')
                                }
                                className="rounded-full border border-fuchsia-400/20 bg-fuchsia-400/10 px-3 py-1.5 text-[11px] text-fuchsia-50/82 transition hover:bg-fuchsia-400/14"
                              >
                                {hasMissingUpstreamModules ? `前往 ${missingUpstreamModules[0].title}` : '複製指令'}
                              </button>
                            </div>
                          </div>
                          {!isWorkingCollapsed(program.id, module.id) && (
                            <textarea
                              value={workingPromptValue}
                              onChange={(event) => handleWorkingPromptDraftChange(program.id, module.id, event.target.value)}
                              className="mt-3 min-h-36 w-full rounded-[14px] border border-white/8 bg-[#090512]/90 p-4 text-xs leading-6 text-fuchsia-50/82 outline-none transition placeholder:text-fuchsia-50/28 focus:border-fuchsia-300/28"
                              placeholder="這裡會顯示可直接送進 AI 的完整工作指令。"
                            />
                          )}
                        </div>
                      ) : null}

                      {isLowInputModule ? (
                        <div className="mb-4 rounded-[14px] border border-amber-300/12 bg-[#151108]/80 p-4">
                          <p className="text-[11px] uppercase tracking-widest text-amber-100/60">補充資料</p>
                          <p className="mt-2 text-xs leading-6 text-amber-50/76">
                            {module.autoAssembleNote ?? '前步已整理，只需補充外部連結與特殊覆寫欄位'}
                          </p>
                          <div className="mt-4">
                            <p className="text-xs uppercase tracking-widest text-white/48">{module.supplementalLabel ?? '補充欄位'}</p>
                            <textarea
                              value={supplementalInput}
                              onChange={(event) => handleSupplementalInputChange(program.id, module.id, event.target.value)}
                              placeholder={module.supplementalPlaceholder ?? 'audioUrl / coverImageUrl / backgroundVideoUrl / durationSeconds'}
                              className="mt-3 min-h-24 w-full rounded-[14px] border border-white/10 bg-[#04070c] px-4 py-3 text-sm leading-7 text-white outline-none transition placeholder:text-white/28 focus:border-amber-300/28"
                            />
                          </div>
                        </div>
                      ) : null}

                      <div className="mb-4 flex flex-wrap gap-2">
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
                          onClick={() => handleCopyText(`${moduleKey}::template`, module.template, '模板已複製')}
                          title="複製 Prompt 模板至剪貼簿"
                          className="rounded-full border border-white/10 bg-white/8 px-3 py-2 text-xs text-white/72 transition hover:bg-white/12"
                        >
                          複製模板
                        </button>
                        <button
                          type="button"
                          title={canInsertUpstream ? '帶入前一步已儲存內容並複製' : '尚無上游內容'}
                          onClick={() =>
                            isLowInputModule ? handleAssembleLowInput(program, moduleIndex) : handleInsertUpstream(program, moduleIndex)
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
                              ? '帶入並複製'
                              : '帶入並複製'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCopyText(`${moduleKey}::output`, combinedOutput, '已複製')}
                          title="複製此步驟已儲存結果至剪貼簿"
                          className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-2 text-xs text-emerald-50/82 transition hover:bg-emerald-300/14"
                        >
                          複製結果
                        </button>
                      </div>

                      {upstreamPayload ? (
                        <div className="mb-4 rounded-[14px] border border-fuchsia-400/12 bg-[#120d21]/70 p-3">
                          <p className="text-[11px] uppercase tracking-widest text-fuchsia-100/55">上游內容</p>
                          <p className="mt-2 text-xs leading-6 text-fuchsia-50/74">
                            {isLowInputModule
                              ? '前步已整理，可直接取用'
                              : '前步已整合，無需重複操作'}
                          </p>
                        </div>
                      ) : null}

                      {/* Output slots */}
                      <div>
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                          <p className="text-[11px] uppercase tracking-widest text-white/48">
                            {isLowInputModule
                              ? '帶入後編輯'
                              : slotCount > 1
                                ? `候選 ${slotCount}`
                                : '輸出'}
                          </p>
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              title={isOutputCollapsed(program.id, module.id) ? '展開輸出區' : '收合輸出區'}
                              onClick={() => toggleOutput(program.id, module.id)}
                              className="rounded-full border border-white/10 bg-white/8 px-3 py-1.5 text-[11px] text-white/60 transition hover:bg-white/12"
                            >
                              {isOutputCollapsed(program.id, module.id) ? '展開' : '收合'}
                            </button>
                            {feedback && (
                              <span title={feedback} className="max-w-32 truncate text-[11px] text-cyan-50/60">{feedback}</span>
                            )}
                          </div>
                        </div>
                        <div className="grid gap-3">
                          {Array.from({ length: slotCount }, (_, slotIndex) => {
                            const slotKey = buildModuleSlotKey(program.id, module.id, slotIndex);
                            const slotLabel = getModuleOutputSlotLabel(module, slotIndex);

                            return (
                              <div key={slotKey} className="min-w-0 overflow-hidden rounded-[14px] border border-white/8 bg-[#04070c]/70 p-3">
                                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                                  <p className="text-xs uppercase tracking-widest text-white/48">{slotLabel}</p>
                          <button
                            type="button"
                            title="複製此輸出框至剪貼簿"
                            onClick={() =>
                              handleCopyText(`${slotKey}::output`, moduleOutputs[slotKey] ?? '', `${slotLabel} 已複製`)
                            }
                            className="rounded-full border border-white/10 bg-white/8 px-3 py-1.5 text-[11px] text-white/72 transition hover:bg-white/12"
                          >
                            複製
                          </button>
                                </div>
                                <textarea
                                  id={buildModuleTextareaId(program.id, module.id, slotIndex)}
                                  value={moduleOutputs[slotKey] ?? ''}
                                  onChange={(event) => handleModuleOutputChange(program.id, module.id, slotIndex, event.target.value)}
                                  placeholder={`AI 回傳結果 ${slotIndex + 1}`}
                                  className="min-h-36 w-full rounded-[14px] border border-white/10 bg-[#04070c] px-4 py-3 text-sm leading-7 text-white outline-none transition placeholder:text-white/28 focus:border-cyan-300/28"
                                />
                              </div>
                            );
                          })}
                        </div>
                        {isOutputCollapsed(program.id, module.id) ? (
                          <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-cyan-50/48">
                            <span>{slotCount > 1 ? `${slotCount} 個候選` : '1 個輸出'}</span>
                            {hasSavedCurrentModuleOutput && (
                              <span className="rounded-full border border-emerald-300/22 bg-emerald-300/8 px-2 py-0.5 text-emerald-400/80">
                                已儲存
                              </span>
                            )}
                            {moduleOutputs[buildModuleSlotKey(program.id, module.id, 0)]?.trim() && (
                              <span className="text-white/32">草稿</span>
                            )}
                          </div>
                        ) : (
                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              title={hasSavedCurrentModuleOutput ? '已儲存，點擊可重新儲存' : '儲存此步驟已貼入的 AI 回傳內容'}
                              onClick={() => handleSaveModuleOutput(program.id, module.id)}
                              className={`rounded-full border px-3 py-2 text-xs font-medium transition ${
                                hasSavedCurrentModuleOutput
                                  ? 'border-cyan-300/20 bg-cyan-300/10 text-cyan-50 hover:bg-cyan-300/16'
                                  : 'border-white/10 bg-white/8 text-white/82 hover:bg-white/12'
                              }`}
                            >
                              儲存
                            </button>
                          </div>
                        )}
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
