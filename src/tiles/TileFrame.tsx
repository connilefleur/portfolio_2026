import type { ReactNode, Ref } from "react";

type TileFrameProps = {
  children: ReactNode;
  className?: string;
  introPhase?: "active" | "exiting" | "done";
  frameRef?: Ref<HTMLDivElement>;
};

export function TileFrame({ children, className, introPhase, frameRef }: TileFrameProps) {
  const classes = ["tile-frame", className].filter(Boolean).join(" ");
  return (
    <div className={classes} data-intro-phase={introPhase} ref={frameRef}>
      <div className="tile-inner">{children}</div>
    </div>
  );
}
