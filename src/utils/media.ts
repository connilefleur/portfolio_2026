import type { ProjectMedia, ProjectMediaSource } from "../types/content";

export function buildAssetUrl(assetBasePath: string | undefined, src: string) {
  return assetBasePath ? `${assetBasePath}/${src}` : src;
}

export function getResponsiveImageSources(assetBasePath: string | undefined, media?: ProjectMedia): ProjectMediaSource[] {
  if (!media || media.type !== "image") return [];

  const bySrc = new Map<string, ProjectMediaSource>();
  const candidates = [...(media.responsiveSources ?? [])];
  if (media.src) {
    candidates.push({
      src: media.src,
      width: media.width,
      height: media.height,
    });
  }

  for (const candidate of candidates) {
    if (!candidate?.src) continue;
    if (!bySrc.has(candidate.src)) {
      bySrc.set(candidate.src, candidate);
    }
  }

  return [...bySrc.values()]
    .sort((a, b) => (a.width ?? Number.MAX_SAFE_INTEGER) - (b.width ?? Number.MAX_SAFE_INTEGER))
    .map((candidate) => ({
      ...candidate,
      src: buildAssetUrl(assetBasePath, candidate.src),
    }));
}

export function buildImageSrcSet(assetBasePath: string | undefined, media?: ProjectMedia) {
  return getResponsiveImageSources(assetBasePath, media)
    .filter((source) => Boolean(source.width))
    .map((source) => `${source.src} ${source.width}w`)
    .join(", ");
}
