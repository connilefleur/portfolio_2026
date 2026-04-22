import type { CSSProperties } from "react";
import type { ProjectMedia } from "../types/content";

type ProjectMediaCardProps = {
  media?: ProjectMedia;
  assetBasePath?: string;
  className?: string;
  onClick?: () => void;
  ariaLabel?: string;
  loading?: "lazy" | "eager";
  style?: CSSProperties;
  onAspectRatioChange?: (ratio: number) => void;
};

function buildAssetUrl(assetBasePath: string | undefined, media: ProjectMedia) {
  return assetBasePath ? `${assetBasePath}/${media.src}` : media.src;
}

function MediaBody({
  media,
  assetBasePath,
  loading = "lazy",
  onAspectRatioChange,
}: {
  media?: ProjectMedia;
  assetBasePath?: string;
  loading?: "lazy" | "eager";
  onAspectRatioChange?: (ratio: number) => void;
}) {
  if (!media) {
    return <div className="mock-media project-media-card__empty" />;
  }

  const src = buildAssetUrl(assetBasePath, media);

  if (media.type === "image") {
    return (
      <div className="project-media-card__surface">
        <img
          className="project-media-card__asset"
          src={src}
          alt={media.description || ""}
          loading={loading}
          onLoad={(event) => {
            const { naturalWidth, naturalHeight } = event.currentTarget;
            if (naturalWidth && naturalHeight) {
              onAspectRatioChange?.(naturalWidth / naturalHeight);
            }
          }}
        />
      </div>
    );
  }

  if (media.type === "video") {
    return (
      <div className="project-media-card__surface project-media-card__surface--video">
        <video
          className="project-media-card__asset"
          src={src}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          onLoadedMetadata={(event) => {
            const { videoWidth, videoHeight } = event.currentTarget;
            if (videoWidth && videoHeight) {
              onAspectRatioChange?.(videoWidth / videoHeight);
            }
          }}
        />
      </div>
    );
  }

  return (
    <div className="mock-media project-media-card__fallback">
      <span>MEDIA</span>
    </div>
  );
}

export function ProjectMediaCard({
  media,
  assetBasePath,
  className = "",
  onClick,
  ariaLabel,
  loading = "lazy",
  style,
  onAspectRatioChange,
}: ProjectMediaCardProps) {
  const classes = ["project-media-card", className].filter(Boolean).join(" ");

  if (onClick) {
    return (
      <button type="button" className={classes} onClick={onClick} aria-label={ariaLabel} style={style}>
        <MediaBody media={media} assetBasePath={assetBasePath} loading={loading} onAspectRatioChange={onAspectRatioChange} />
        <span className="project-media-card__hover-label" aria-hidden="true">
          SEE MORE
        </span>
      </button>
    );
  }

  return (
    <div className={classes} style={style}>
      <MediaBody media={media} assetBasePath={assetBasePath} loading={loading} onAspectRatioChange={onAspectRatioChange} />
    </div>
  );
}
