import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ScalpEngine AI — Institutional-grade scalp analysis" },
      { name: "description", content: "Upload a chart screenshot and get instant scalp analysis: levels, confluence, and actionable setups." },
      { property: "og:title", content: "ScalpEngine AI" },
      { property: "og:description", content: "Institutional-grade scalp analysis in seconds." },
    ],
  }),
  component: Index,
});

type Setup = {
  type: string;
  direction: string;
  logic: string;
  trigger: string;
  stopLoss: string;
  takeProfit: string;
  rr: string;
};

type Analysis = {
  asset: string;
  timeframe: string;
  currentPrice: string;
  marketState: string;
  resistance: string[];
  support: string[];
  liquidityTarget: string;
  momentum: string;
  meanReversion: string;
  fibPivot: string;
  setup1: Setup;
  setup2: Setup;
};

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // strip data URL prefix
      const base64 = result.includes(",") ? result.split(",")[1] : result;
      resolve(base64);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function marketStateTone(state: string): "bullish" | "bearish" | "neutral" {
  const s = state.toLowerCase();
  if (s.includes("bull")) return "bullish";
  if (s.includes("bear")) return "bearish";
  return "neutral";
}

function rrTone(rr: string): "bullish" | "bearish" | "neutral" {
  // parse "1:X"
  const m = rr.match(/1\s*:\s*([\d.]+)/);
  if (!m) return "neutral";
  const n = parseFloat(m[1]);
  if (n >= 2) return "bullish";
  if (n >= 1.5) return "neutral";
  return "bearish";
}

function Index() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const outputRef = useRef<HTMLDivElement>(null);

  const handleFile = useCallback((f: File | null) => {
    if (!f) return;
    if (!/^image\/(png|jpe?g|webp)$/i.test(f.type)) {
      toast.error("Unsupported file type", { description: "Use PNG, JPG, or WEBP." });
      return;
    }
    setFile(f);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(f));
  }, [previewUrl]);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  };

  const reset = () => {
    setFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setAnalysis(null);
    if (inputRef.current) inputRef.current.value = "";
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const analyze = async () => {
    if (!file) return;
    setLoading(true);
    try {
      const imageBase64 = await fileToBase64(file);
      const res = await fetch("/api/analyze-chart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64, mimeType: file.type }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as Analysis;
      setAnalysis(data);
      toast.success("Analysis complete ✓");
      // smooth scroll after render
      setTimeout(() => {
        outputRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 60);
    } catch (err) {
      console.error(err);
      toast.error("Analysis failed. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border/60">
        <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight sm:text-2xl">
                <span className="text-primary">⚡</span>
                <span>ScalpEngine AI</span>
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Institutional-grade scalp analysis in seconds.
              </p>
            </div>
            <span className="hidden rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[11px] font-medium uppercase tracking-wider text-primary sm:inline-block">
              Powered by Claude AI
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
        {/* Upload card */}
        <section className="mx-auto w-full max-w-[640px]">
          <div className="rounded-2xl border border-border bg-card p-6 shadow-2xl sm:p-8">
            <h2 className="text-lg font-semibold tracking-tight sm:text-xl">Upload Your Chart</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Drop a screenshot of your chart. We'll dissect structure, levels & setups.
            </p>

            <label
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={onDrop}
              className={cn(
                "mt-5 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed bg-surface-2 px-6 py-10 text-center transition-colors hover:border-primary",
                isDragging ? "border-primary bg-primary/5" : "border-border",
              )}
            >
              <input
                ref={inputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
              />
              <ChartIcon className="h-10 w-10 text-muted-foreground" />
              <p className="mt-3 text-sm font-medium">Drag &amp; drop your chart screenshot</p>
              <p className="mt-1 text-xs text-muted-foreground">
                PNG, JPG, WEBP supported · or click to browse
              </p>
            </label>

            {previewUrl && (
              <div className="mt-4 overflow-hidden rounded-lg border border-border bg-surface-2">
                <img src={previewUrl} alt="Chart preview" className="max-h-72 w-full object-contain" />
                <div className="flex items-center justify-between border-t border-border px-3 py-2 text-xs text-muted-foreground">
                  <span className="truncate">{file?.name}</span>
                  <button
                    type="button"
                    onClick={reset}
                    className="text-muted-foreground transition-colors hover:text-foreground"
                  >
                    Remove
                  </button>
                </div>
              </div>
            )}

            <button
              type="button"
              disabled={!file || loading}
              onClick={analyze}
              className={cn(
                "mt-5 w-full rounded-lg px-4 py-3 text-sm font-bold transition-all",
                "bg-primary text-primary-foreground hover:brightness-110",
                "disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground",
              )}
            >
              {loading ? (
                <span className="animate-scalp-pulse font-mono-tight uppercase tracking-wider">
                  Dissecting market structure…
                </span>
              ) : (
                "Analyze Chart"
              )}
            </button>
          </div>
        </section>

        {/* Output */}
        {analysis && (
          <section ref={outputRef} className="mt-12 space-y-5">
            <ScalpDynamics analysis={analysis} />
            <KeyLevels analysis={analysis} />
            <ConfluenceChecklist analysis={analysis} />
            <Setups analysis={analysis} />

            <div className="flex justify-center pt-2">
              <button
                type="button"
                onClick={reset}
                className="rounded-lg border border-border bg-transparent px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:border-foreground/60 hover:bg-surface"
              >
                Analyze Another Chart
              </button>
            </div>
          </section>
        )}
      </main>

      <footer className="border-t border-border/60 py-8">
        <p className="text-center text-xs text-muted-foreground">
          ScalpEngine AI · For educational purposes only · Not financial advice
        </p>
      </footer>
    </div>
  );
}

/* ---------------- Cards ---------------- */

function Card({
  children,
  accent,
  className,
}: {
  children: React.ReactNode;
  accent?: "bullish" | "bearish" | "warning";
  className?: string;
}) {
  const border =
    accent === "bullish"
      ? "border-l-4 border-l-bullish"
      : accent === "bearish"
        ? "border-l-4 border-l-bearish"
        : accent === "warning"
          ? "border-l-4 border-l-warning"
          : "";
  return (
    <div className={cn("rounded-xl border border-border bg-card p-5 sm:p-6", border, className)}>
      {children}
    </div>
  );
}

function CardTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-foreground/90">{children}</h3>;
}

function ScalpDynamics({ analysis }: { analysis: Analysis }) {
  const tone = marketStateTone(analysis.marketState);
  const toneClasses =
    tone === "bullish"
      ? "bg-bullish/10 text-bullish border-bullish/40"
      : tone === "bearish"
        ? "bg-bearish/10 text-bearish border-bearish/40"
        : "bg-warning/10 text-warning border-warning/40";
  return (
    <Card accent="bullish">
      <CardTitle>⚡ Scalp Dynamics</CardTitle>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Pill label="Asset / TF" value={`${analysis.asset} · ${analysis.timeframe}`} />
        <Pill
          label="Current Price"
          value={analysis.currentPrice}
          mono
          large
        />
        <div className="rounded-lg border border-border bg-surface-2 p-3">
          <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Market State
          </div>
          <div className={cn("mt-1 inline-flex items-center rounded-md border px-2 py-1 text-sm font-semibold", toneClasses)}>
            {analysis.marketState}
          </div>
        </div>
      </div>
    </Card>
  );
}

function Pill({
  label,
  value,
  mono,
  large,
}: {
  label: string;
  value: string;
  mono?: boolean;
  large?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface-2 p-3">
      <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
      <div
        className={cn(
          "mt-1",
          mono && "font-mono-tight",
          large ? "text-xl font-bold text-foreground sm:text-2xl" : "text-sm font-medium text-foreground",
        )}
      >
        {value}
      </div>
    </div>
  );
}

function KeyLevels({ analysis }: { analysis: Analysis }) {
  return (
    <Card>
      <CardTitle>🎯 Key Scalping Levels</CardTitle>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div className="rounded-lg border border-bearish/30 bg-bearish/5 p-4">
          <div className="mb-3 text-xs font-bold uppercase tracking-wider text-bearish">Resistance</div>
          <div className="flex flex-wrap gap-2">
            {analysis.resistance.map((lvl) => (
              <span
                key={lvl}
                className="rounded-md border border-bearish/40 bg-bearish/10 px-2.5 py-1 font-mono-tight text-sm font-semibold text-bearish"
              >
                {lvl}
              </span>
            ))}
          </div>
        </div>
        <div className="rounded-lg border border-bullish/30 bg-bullish/5 p-4">
          <div className="mb-3 text-xs font-bold uppercase tracking-wider text-bullish">Support</div>
          <div className="flex flex-wrap gap-2">
            {analysis.support.map((lvl) => (
              <span
                key={lvl}
                className="rounded-md border border-bullish/40 bg-bullish/10 px-2.5 py-1 font-mono-tight text-sm font-semibold text-bullish"
              >
                {lvl}
              </span>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-4 rounded-lg border border-warning/30 bg-warning/5 px-4 py-3 text-sm">
        <span className="font-semibold text-warning">💧 Liquidity Target:</span>{" "}
        <span className="font-mono-tight text-warning">{analysis.liquidityTarget}</span>
      </div>
    </Card>
  );
}

function ConfluenceRow({
  label,
  value,
  dot,
}: {
  label: string;
  value: string;
  dot: "bullish" | "bearish" | "warning";
}) {
  const dotClass =
    dot === "bullish" ? "bg-bullish" : dot === "bearish" ? "bg-bearish" : "bg-warning";
  return (
    <div className="flex items-start gap-3 border-b border-border/60 py-3 last:border-b-0">
      <span className={cn("mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full", dotClass)} />
      <div className="flex-1">
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="mt-0.5 text-sm text-foreground">{value}</div>
      </div>
    </div>
  );
}

function ConfluenceChecklist({ analysis }: { analysis: Analysis }) {
  // simple heuristics for dot color from text
  const tone = (txt: string): "bullish" | "bearish" | "warning" => {
    const s = txt.toLowerCase();
    if (s.includes("bull") || s.includes("oversold") || s.includes("snapback")) return "warning";
    if (s.includes("bear") || s.includes("short")) return "bearish";
    return "bullish";
  };
  return (
    <Card accent="warning">
      <CardTitle>📊 Confluence Checklist</CardTitle>
      <div>
        <ConfluenceRow label="Momentum (RSI)" value={analysis.momentum} dot={tone(analysis.momentum)} />
        <ConfluenceRow label="Mean Reversion" value={analysis.meanReversion} dot={tone(analysis.meanReversion)} />
        <ConfluenceRow label="Fib / Pivot Junction" value={analysis.fibPivot} dot="warning" />
      </div>
    </Card>
  );
}

function Setups({ analysis }: { analysis: Analysis }) {
  return (
    <Card>
      <CardTitle>🚀 High-Probability Scalp Setups</CardTitle>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <SetupCard title="Option 1: Trend Continuation" setup={analysis.setup1} />
        <SetupCard title="Option 2: Mean Reversion" setup={analysis.setup2} />
      </div>
    </Card>
  );
}

function SetupCard({ title, setup }: { title: string; setup: Setup }) {
  const isLong = setup.direction.toLowerCase() === "long";
  const rrt = rrTone(setup.rr);
  const rrClass =
    rrt === "bullish"
      ? "bg-bullish/15 text-bullish border-bullish/40"
      : rrt === "bearish"
        ? "bg-bearish/15 text-bearish border-bearish/40"
        : "bg-warning/15 text-warning border-warning/40";
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface-2 p-4">
      <div className="flex items-center justify-between gap-3">
        <h4 className="text-sm font-semibold tracking-tight">{title}</h4>
        <span
          className={cn(
            "rounded-md px-2 py-0.5 text-xs font-bold uppercase tracking-wider",
            isLong ? "bg-bullish/15 text-bullish" : "bg-bearish/15 text-bearish",
          )}
        >
          {isLong ? "Long" : "Short"}
        </span>
      </div>

      <Field label="Setup Logic" value={setup.logic} />
      <Field label="Trigger" value={setup.trigger} />

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-md border border-bearish/30 bg-bearish/5 p-2.5">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-bearish/80">🛑 Stop Loss</div>
          <div className="mt-0.5 font-mono-tight text-base font-bold text-bearish">{setup.stopLoss}</div>
        </div>
        <div className="rounded-md border border-bullish/30 bg-bullish/5 p-2.5">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-bullish/80">🎯 Take Profit</div>
          <div className="mt-0.5 font-mono-tight text-base font-bold text-bullish">{setup.takeProfit}</div>
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-border/60 pt-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">R:R Ratio</span>
        <span className={cn("rounded-md border px-2 py-0.5 font-mono-tight text-sm font-bold", rrClass)}>
          {setup.rr}
        </span>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-0.5 font-mono-tight text-sm text-foreground">{value}</div>
    </div>
  );
}

function ChartIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M7 15l3-4 3 2 4-6" />
      <circle cx="7" cy="15" r="0.8" fill="currentColor" />
      <circle cx="10" cy="11" r="0.8" fill="currentColor" />
      <circle cx="13" cy="13" r="0.8" fill="currentColor" />
      <circle cx="17" cy="7" r="0.8" fill="currentColor" />
    </svg>
  );
}
