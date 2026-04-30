interface DiffPreviewProps {
  lines: string[];
}

export function DiffPreview({ lines }: DiffPreviewProps) {
  return (
    <pre className="max-h-[320px] overflow-auto rounded-2xl border border-white/10 bg-black/40 p-3 text-[12px] leading-6 text-slate-200">
      {lines.map((line, index) => {
        const tone = line.startsWith("+")
          ? "text-emerald-300"
          : line.startsWith("-")
            ? "text-rose-300"
            : "text-slate-300";

        return (
          <code key={`${line}-${index}`} className={`block font-mono ${tone}`}>
            {line}
          </code>
        );
      })}
    </pre>
  );
}
