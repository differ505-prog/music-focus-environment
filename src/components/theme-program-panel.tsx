'use client';

import { useEffect, useState } from 'react';

import type { ThemeProgram } from "@/types/music";

type ThemeProgramPanelProps = {
  mode?: 'public' | 'admin';
  programs: readonly ThemeProgram[];
};

type SectionKey = 'strategy' | 'notes' | 'workflow' | 'seed' | 'checklist';

type SectionState = Record<SectionKey, boolean>;

type FeedbackMap = Record<string, string>;

type StoredModuleOutput = {
  value: string;
  templateSnapshot: string;
};

type StoredModuleOutputMap = Record<string, StoredModuleOutput>;

const MODULE_OUTPUTS_STORAGE_KEY = 'theme-manual-module-outputs-v2';

const defaultSectionState = (): SectionState => ({
  strategy: true,
  notes: true,
  workflow: true,
  seed: true,
  checklist: true,
});

function buildModuleKey(programId: string, moduleId: string) {
  return `${programId}::${moduleId}`;
}

function buildModuleSlotKey(programId: string, moduleId: string, slotIndex: number) {
  return `${buildModuleKey(programId, moduleId)}::slot-${slotIndex}`;
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

function buildUpstreamPayload(program: ThemeProgram, moduleIndex: number, moduleOutputs: Record<string, string>) {
  const upstreamModules = program.promptModules
    .slice(0, moduleIndex)
    .map((module) => ({
      title: module.title,
      output: combineModuleOutputs(program.id, module, moduleOutputs),
    }))
    .filter((item) => item.output.length > 0);

  return upstreamModules
    .map((item) => `${item.title}\n${item.output}`)
    .join('\n\n--------------------\n\n');
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

export function ThemeProgramPanel({ mode = 'public', programs }: ThemeProgramPanelProps) {
  const isAdmin = mode === 'admin';
  const [collapsedSections, setCollapsedSections] = useState<Record<string, SectionState>>({});
  const [moduleOutputs, setModuleOutputs] = useState<Record<string, string>>({});
  const [feedbackMap, setFeedbackMap] = useState<FeedbackMap>({});

  useEffect(() => {
    setCollapsedSections((current) => {
      const nextState = { ...current };

      for (const program of programs) {
        nextState[program.id] = current[program.id] ?? defaultSectionState();
      }

      return nextState;
    });
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

  const handleModuleOutputChange = (programId: string, moduleId: string, slotIndex: number, value: string) => {
    const key = buildModuleSlotKey(programId, moduleId, slotIndex);

    setModuleOutputs((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const handleSaveModuleOutput = (programId: string, moduleId: string) => {
    if (typeof window === 'undefined') {
      return;
    }

    const targetPromptModule = programs
      .find((program) => program.id === programId)
      ?.promptModules.find((item) => item.id === moduleId);

    if (!targetPromptModule) {
      return;
    }

    const moduleKey = buildModuleKey(programId, moduleId);
    const nextOutputs = { ...moduleOutputs };

    for (let slotIndex = 0; slotIndex < getModuleOutputSlotCount(targetPromptModule); slotIndex += 1) {
      const slotKey = buildModuleSlotKey(programId, moduleId, slotIndex);
      nextOutputs[slotKey] = moduleOutputs[slotKey] ?? '';
    }

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
      getModuleOutputSlotCount(targetPromptModule) > 1
        ? '已儲存此步驟全部候選結果'
        : '已儲存，可供後續步驟取用',
    );
  };

  const handleCopyText = async (feedbackKey: string, value: string, successMessage: string) => {
    if (!value.trim()) {
      setFeedback(feedbackKey, '目前沒有可複製內容');
      return;
    }

    try {
      await navigator.clipboard.writeText(value);
      setFeedback(feedbackKey, successMessage);
    } catch {
      setFeedback(feedbackKey, '複製失敗，請改用手動複製');
    }
  };

  const handleInsertUpstream = (program: ThemeProgram, moduleIndex: number) => {
    const targetModule = program.promptModules[moduleIndex];
    const upstreamPayload = buildUpstreamPayload(program, moduleIndex, moduleOutputs);
    const currentValue = moduleOutputs[buildModuleSlotKey(program.id, targetModule.id, 0)] ?? '';

    if (!upstreamPayload) {
      setFeedback(buildModuleKey(program.id, targetModule.id), '目前沒有已儲存的上游結果');
      return;
    }

    const nextValue = currentValue.trim()
      ? `${currentValue.trim()}\n\n===== 上游結果 =====\n\n${upstreamPayload}`
      : upstreamPayload;

    handleModuleOutputChange(program.id, targetModule.id, 0, nextValue);
    setFeedback(buildModuleKey(program.id, targetModule.id), '已插入上游結果');
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
        <p className="text-xs uppercase tracking-[0.32em] text-fuchsia-100/60">
          {isAdmin ? 'Theme Operations Manual' : 'Theme Programs'}
        </p>
        <h2 className="mt-3 font-serif text-2xl text-white md:text-3xl">
          {isAdmin ? '主題作戰手冊' : '內容主題雙主線'}
        </h2>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-white/66">
          {isAdmin
            ? '高頻操作的 Prompt Modules 已前置，低頻藍圖與驗收資訊改為收斂顯示；每一步也能貼上、儲存並把結果傳給後續步驟。'
            : '前台先把網站的兩條內容主線建立出來，讓深度專注與 BPM180 慢跑各自擁有清楚定位與視覺節奏。'}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        {programs.map((program) => (
          <article
            key={program.id}
            className="rounded-[24px] border border-white/10 bg-black/18 p-4 text-sm text-white/72"
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

            {isAdmin ? (
              <div className="mt-5 rounded-[20px] border border-cyan-300/12 bg-[#07101a]/88 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.24em] text-cyan-100/60">Prompt Modules</p>
                    <p className="mt-2 text-xs leading-6 text-cyan-50/72">
                      高頻操作區。先生成、貼上並儲存結果，後續步驟可直接複製與接續使用。
                    </p>
                  </div>
                  <div className="rounded-full border border-cyan-300/18 bg-cyan-300/10 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-cyan-50/74">
                    High Frequency
                  </div>
                </div>
                <div className="mt-4 grid gap-3">
                  {program.promptModules.map((module, moduleIndex) => {
                    const moduleKey = buildModuleKey(program.id, module.id);
                    const upstreamPayload = buildUpstreamPayload(program, moduleIndex, moduleOutputs);
                    const feedback = feedbackMap[moduleKey];
                    const slotCount = getModuleOutputSlotCount(module);
                    const combinedOutput = combineModuleOutputs(program.id, module, moduleOutputs);

                    return (
                      <div
                        key={module.id}
                        className="rounded-[18px] border border-cyan-300/12 bg-black/18 p-4"
                      >
                        <div className="flex flex-wrap items-center gap-3">
                          <span className="rounded-full border border-cyan-300/18 bg-cyan-300/10 px-2 py-1 text-[11px] uppercase tracking-[0.2em] text-cyan-50/72">
                            {module.id}
                          </span>
                          <h4 className="text-sm font-medium text-white">{module.title}</h4>
                        </div>
                        <p className="mt-2 text-xs leading-6 text-cyan-50/70">{module.purpose}</p>
                        <pre className="mt-3 overflow-x-auto rounded-[16px] border border-white/8 bg-[#07101a]/90 p-4 text-xs leading-6 text-cyan-50/82">
                          <code>{module.template}</code>
                        </pre>

                        <div className="mt-4 flex flex-wrap gap-2">
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
                            onClick={() => handleInsertUpstream(program, moduleIndex)}
                            className="rounded-full border border-fuchsia-400/20 bg-fuchsia-400/10 px-3 py-2 text-xs text-fuchsia-50/82 transition hover:bg-fuchsia-400/14 disabled:cursor-not-allowed disabled:opacity-45"
                            disabled={!upstreamPayload}
                          >
                            插入上游結果
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
                              上游已儲存內容
                            </p>
                            <p className="mt-2 text-xs leading-6 text-fuchsia-50/74">
                              已偵測到前面步驟的儲存結果，可直接插入本步驟，避免重複貼資料。
                            </p>
                          </div>
                        ) : null}

                        <div className="mt-4">
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-[11px] uppercase tracking-[0.2em] text-white/48">
                              {slotCount > 1 ? `此步驟輸出（${slotCount} 組候選）` : '此步驟輸出'}
                            </p>
                            <span className="text-xs text-cyan-50/64">
                              {feedback ?? feedbackMap[`${moduleKey}::template`] ?? feedbackMap[`${moduleKey}::output`] ?? '可貼上 AI 生成結果'}
                            </span>
                          </div>
                          <div className="mt-3 grid gap-3">
                            {Array.from({ length: slotCount }, (_, slotIndex) => {
                              const slotKey = buildModuleSlotKey(program.id, module.id, slotIndex);
                              const slotLabel = getModuleOutputSlotLabel(module, slotIndex);

                              return (
                                <div
                                  key={slotKey}
                                  className="rounded-[16px] border border-white/8 bg-[#04070c]/70 p-3"
                                >
                                  <div className="flex items-center justify-between gap-3">
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
                              className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-2 text-xs font-medium text-cyan-50 transition hover:bg-cyan-300/16"
                            >
                              {slotCount > 1 ? '儲存此步驟全部候選結果' : '儲存此步驟結果'}
                            </button>
                            <span className="text-xs text-white/45">
                              {slotCount > 1 ? '儲存後，後續模組可直接取用這兩組候選內容。' : '儲存後，後續模組可直接取用這份內容。'}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="mt-4 rounded-[18px] border border-white/8 bg-white/6 p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-white/42">主題定位</p>
                <p className="mt-2 text-sm leading-6 text-white/68">
                  {program.positioning}
                </p>
              </div>
            )}

            {isAdmin ? (
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
            ) : null}

            {isAdmin ? (
              <div className="mt-5">
                {renderSectionToggle(program.id, 'workflow', 'Workflow')}
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
            ) : null}

            {isAdmin ? (
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
                  {renderSectionToggle(program.id, 'seed', 'Prompt Seed')}
                  {(collapsedSections[program.id] ?? defaultSectionState()).seed ? null : (
                    <div className="mt-3 rounded-[18px] border border-cyan-300/12 bg-[#07101a]/88 p-4">
                      <pre className="overflow-x-auto text-xs leading-6 text-cyan-50/82">
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
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}
