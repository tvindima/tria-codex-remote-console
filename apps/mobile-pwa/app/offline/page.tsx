import Link from "next/link";

export default function OfflinePage() {
  return (
    <main className="bg-app-gradient flex min-h-screen items-center justify-center px-4 text-center">
      <div className="vista-card w-full max-w-sm rounded-[24px] p-6">
        <h1 className="text-2xl font-semibold text-slate-100">You are offline</h1>
        <p className="mt-2 text-sm text-slate-300">Reconnect to continue controlling local Codex threads.</p>
        <Link
          href="/dashboard"
          className="mt-4 inline-flex min-h-[44px] items-center justify-center rounded-xl border border-blue-400/40 bg-blue-500/18 px-4 text-sm font-semibold text-blue-100"
        >
          Try again
        </Link>
      </div>
    </main>
  );
}
