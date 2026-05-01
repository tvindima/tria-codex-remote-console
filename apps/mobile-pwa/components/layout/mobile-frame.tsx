import { ReactNode } from "react";

interface MobileFrameProps {
  children: ReactNode;
}

export function MobileFrame({ children }: MobileFrameProps) {
  return (
    <div className="relative h-[100svh] min-h-[100svh] max-h-[100svh] w-full overflow-hidden bg-app-gradient md:h-[100dvh] md:min-h-[100dvh] md:max-h-[100dvh]">
      <div className="mx-auto flex h-full w-full max-w-[1180px] flex-col overflow-hidden px-2 pb-2 pt-2 sm:px-4 sm:pb-4 sm:pt-5 md:px-6">
        <div className="relative flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-[26px] border border-white/12 bg-[#060a10]/70 p-3 shadow-[0_30px_80px_rgba(0,0,0,0.55)] backdrop-blur-md sm:rounded-[42px] sm:p-4 md:rounded-[34px] md:p-5">
          {children}
        </div>
      </div>
    </div>
  );
}
