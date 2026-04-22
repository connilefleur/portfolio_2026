import type { ReactNode } from "react";
import { SlideShell } from "./SlideShell";

type DetailMetaItem = {
  label: string;
  value: ReactNode;
};

type DetailSlideProps = {
  headerStart?: ReactNode;
  headerEnd?: ReactNode;
  titleBlock: ReactNode;
  description: ReactNode;
  metaItems: DetailMetaItem[];
  children: ReactNode;
  className?: string;
};

export function DetailSlide({
  headerStart,
  headerEnd,
  titleBlock,
  description,
  metaItems,
  children,
  className,
}: DetailSlideProps) {
  const detailClassName = ["project-detail", className].filter(Boolean).join(" ");

  return (
    <SlideShell headerStart={headerStart} headerEnd={headerEnd}>
      <div className={detailClassName}>
        <div className="detail-top">
          <div>{titleBlock}</div>
          <p className="detail-description">{description}</p>
        </div>
        <div className="detail-meta">
          {metaItems.map((item) => (
            <div key={item.label}>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </div>
          ))}
        </div>
        <div className="detail-grid">{children}</div>
      </div>
    </SlideShell>
  );
}
