'use client';

type ThemeProgram = {
  id: string;
  label: string;
  title: string;
  bpmDisplay: string;
  summary: string;
  audience: string;
  layoutNotes: readonly string[];
  workflow: ReadonlyArray<{
    id: string;
    title: string;
    detail: string;
  }>;
  promptSeed: string;
};

type ThemeProgramPanelProps = {
  mode?: 'public' | 'admin';
  programs: readonly ThemeProgram[];
};

export function ThemeProgramPanel({ mode = 'public', programs }: ThemeProgramPanelProps) {
  const isAdmin = mode === 'admin';

  return (
    <section className="rounded-[28px] border border-fuchsia-400/14 bg-white/8 p-5 shadow-[0_32px_90px_rgba(8,9,28,0.46)] backdrop-blur-2xl md:p-6">
      <div className="mb-5">
        <p className="text-xs uppercase tracking-[0.32em] text-fuchsia-100/60">
          {isAdmin ? 'Theme Blueprint' : 'Theme Programs'}
        </p>
        <h2 className="mt-3 font-serif text-2xl text-white md:text-3xl">
          {isAdmin ? '主題工作流藍圖' : '內容主題雙主線'}
        </h2>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-white/66">
          {isAdmin
            ? '後台把每一條內容線拆成獨立 workflow，方便你之後同時經營專注型與運動型音樂資產。'
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

            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {program.layoutNotes.map((note) => (
                <div key={note} className="rounded-[18px] border border-white/8 bg-white/6 p-3">
                  <p className="text-xs leading-6 text-white/65">{note}</p>
                </div>
              ))}
            </div>

            <div className="mt-5">
              <p className="text-xs uppercase tracking-[0.24em] text-white/42">Workflow</p>
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
                  </div>
                ))}
              </div>
            </div>

            {isAdmin ? (
              <div className="mt-5 rounded-[18px] border border-cyan-300/12 bg-[#07101a]/88 p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-cyan-100/60">Prompt Seed</p>
                <pre className="mt-3 overflow-x-auto text-xs leading-6 text-cyan-50/82">
                  <code>{program.promptSeed}</code>
                </pre>
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}
