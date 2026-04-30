import { ReactNode } from "react";

interface MobileFrameProps {
  children: ReactNode;
}

export function MobileFrame({ children }: MobileFrameProps) {
  return (
    <div className="relative min-h-screen w-full overflow-x-hidden bg-app-gradient">
      <div className="mx-auto flex min-h-screen w-full max-w-[480px] flex-col px-4 pb-36 pt-5">
        <div className="relative flex min-h-[calc(100vh-3.5rem)] flex-col rounded-[42px] border border-white/12 bg-[#060a10]/70 p-4 shadow-[0_30px_80px_rgba(0,0,0,0.55)] backdrop-blur-md">
          {children}
        </div>
      </div>
    </div>
  );
}
