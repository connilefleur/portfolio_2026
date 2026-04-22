import type { ReactNode } from "react";

type DetailPanelProps = {
  heading?: ReactNode;
  children?: ReactNode;
  media?: boolean;
  mediaItems?: { id: string; type: string; src: string }[];
};

export function DetailPanel({ heading, children, media = false, mediaItems = [] }: DetailPanelProps) {
  if (media) {
    const mediaTypes = mediaItems.map((item) => item.type).join("|");
    return <div className="mock-media" data-media-count={mediaItems.length} data-media-types={mediaTypes} />;
  }

  return (
    <div className="detail-panel">
      {heading ? <h4>{heading}</h4> : null}
      {children ? <p>{children}</p> : null}
    </div>
  );
}
