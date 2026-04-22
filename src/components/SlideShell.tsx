import type { ReactNode, Ref } from "react";
import { TileFrame } from "../tiles/TileFrame";

type SlideShellProps = {
  children: ReactNode;
  headerStart?: ReactNode;
  headerEnd?: ReactNode;
  className?: string;
  introPhase?: "active" | "exiting" | "done";
  frameRef?: Ref<HTMLDivElement>;
};

export function SlideShell({
  children,
  headerStart,
  headerEnd,
  className,
  introPhase,
  frameRef,
}: SlideShellProps) {
  return (
    <TileFrame className={className} introPhase={introPhase} frameRef={frameRef}>
      {(headerStart || headerEnd) && (
        <header className="tile-header tiny">
          {headerStart ?? <span aria-hidden="true" />}
          {headerEnd ?? null}
        </header>
      )}
      {children}
    </TileFrame>
  );
}
