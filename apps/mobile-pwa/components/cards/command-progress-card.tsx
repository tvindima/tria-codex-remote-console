"use client";

import { motion } from "framer-motion";

interface CommandProgressCardProps {
  command: string;
  status: string;
  progress: number;
  lines: string[];
}

export function CommandProgressCard({ command, status, progress, lines }: CommandProgressCardProps) {
  return (
    <section className="rounded-[24px] border border-white/12 bg-white/8 p-4">
      <p className="font-mono text-sm text-slate-100">{command}</p>
      <p className="mt-1 text-xs text-slate-400">{status}</p>

      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
        <motion.div
          className="h-full rounded-full bg-blue-400"
          initial={{ width: 0 }}
          animate={{ width: `${Math.max(progress, 4)}%` }}
          transition={{ duration: 0.45, ease: "easeOut" }}
        />
      </div>
      <p className="mt-1 text-xs text-blue-200">Progress: {progress}%</p>

      <pre className="mt-3 rounded-2xl border border-white/10 bg-black/35 p-3 text-[12px] leading-6 text-slate-200">
        {lines.map((line) => (
          <code key={line} className="block font-mono">
            {line}
          </code>
        ))}
      </pre>
    </section>
  );
}
