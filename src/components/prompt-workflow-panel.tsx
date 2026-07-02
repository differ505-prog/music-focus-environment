'use client';

type PromptWorkflowPanelProps = {
  steps: Array<{
    id: string;
    title: string;
    purpose: string;
    prompt: string;
  }>;
};

export function PromptWorkflowPanel({ steps }: PromptWorkflowPanelProps) {
  return (
    <section className="rounded-[28px] border border-fuchsia-400/14 bg-white/8 p-5 shadow-[0_32px_90px_rgba(8,9,28,0.46)] backdrop-blur-2xl md:p-6">
      <div className="mb-5">
        <p className="text-xs uppercase tracking-[0.32em] text-fuchsia-100/60">Prompt Workflow</p>
        <h2 className="mt-3 font-serif text-2xl text-white md:text-3xl">AI 生成操作流程</h2>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-white/66">
          後台集中放你日後高頻切換的提示詞流程，從情境母題、音樂 prompt、視覺 prompt 到 Track JSON
          整理，都能直接複製使用。
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {steps.map((step) => (
          <article
            key={step.id}
            className="rounded-[24px] border border-white/10 bg-black/18 p-4 text-sm text-white/72"
          >
            <div className="flex items-center gap-3">
              <span className="rounded-full border border-fuchsia-400/20 bg-fuchsia-400/10 px-3 py-1 text-xs uppercase tracking-[0.28em] text-fuchsia-100/85">
                {step.id}
              </span>
              <h3 className="font-medium text-white">{step.title}</h3>
            </div>
            <p className="mt-3 leading-6 text-white/62">{step.purpose}</p>
            <pre className="mt-4 overflow-x-auto rounded-[18px] border border-fuchsia-400/12 bg-[#0a0817]/90 p-4 text-xs leading-6 text-white/78">
              <code>{step.prompt}</code>
            </pre>
          </article>
        ))}
      </div>
    </section>
  );
}
