import type { CSSProperties } from "react";
import type { ProjectMedia } from "../types/content";
import { buildAssetUrl, buildImageSrcSet } from "../utils/media";

type ProjectMediaCardProps = {
  media?: ProjectMedia;
  assetBasePath?: string;
  className?: string;
  onClick?: () => void;
  ariaLabel?: string;
  loading?: "lazy" | "eager";
  style?: CSSProperties;
  onAspectRatioChange?: (ratio: number) => void;
  imageSizes?: string;
};

function MediaBody({
  media,
  assetBasePath,
  loading = "lazy",
  onAspectRatioChange,
  imageSizes = "100vw",
}: {
  media?: ProjectMedia;
  assetBasePath?: string;
  loading?: "lazy" | "eager";
  onAspectRatioChange?: (ratio: number) => void;
  imageSizes?: string;
}) {
  if (!media) {
    return <div className="mock-media project-media-card__empty" />;
  }

  const src = buildAssetUrl(assetBasePath, media.src);
  const srcSet = buildImageSrcSet(assetBasePath, media);
  const posterSrc = media.posterSrc ? buildAssetUrl(assetBasePath, media.posterSrc) : undefined;

  if (media.type === "image") {
    return (
      <div className="project-media-card__surface">
        <img
          className="project-media-card__asset"
          src={src}
          srcSet={srcSet || undefined}
          sizes={srcSet ? imageSizes : undefined}
          alt={media.description || ""}
          loading={loading}
          decoding="async"
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
          poster={posterSrc}
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
  imageSizes,
}: ProjectMediaCardProps) {
  const classes = ["project-media-card", className].filter(Boolean).join(" ");

  if (onClick) {
    return (
      <button type="button" className={classes} onClick={onClick} aria-label={ariaLabel} style={style}>
        <MediaBody media={media} assetBasePath={assetBasePath} loading={loading} onAspectRatioChange={onAspectRatioChange} imageSizes={imageSizes} />
        <span className="project-media-card__hover-label" aria-hidden="true">
          SEE MORE
        </span>
      </button>
    );
  }

  return (
    <div className={classes} style={style}>
      <MediaBody media={media} assetBasePath={assetBasePath} loading={loading} onAspectRatioChange={onAspectRatioChange} imageSizes={imageSizes} />
    </div>
  );
}
