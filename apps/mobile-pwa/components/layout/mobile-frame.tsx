import { ReactNode } from "react";

interface MobileFrameProps {
  children: ReactNode;
}

export function MobileFrame({ children }: MobileFrameProps) {
  return (
    <div className="relative h-[100svh] min-h-[100svh] w-full overflow-hidden bg-app-gradient">
      <div className="mx-auto flex h-full w-full max-w-[480px] flex-col px-4 pb-4 pt-5">
        <div className="relative flex h-full min-h-0 flex-col rounded-[42px] border border-white/12 bg-[#060a10]/70 p-4 shadow-[0_30px_80px_rgba(0,0,0,0.55)] backdrop-blur-md">
          {children}
        </div>
      </div>
    </div>
  );
}
