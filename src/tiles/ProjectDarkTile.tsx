import { useEffect, useMemo, useState, type CSSProperties } from "react";
import type { TileId } from "../canvas/tileRegistry";
import type { ProjectItem } from "../types/content";
import { NavAnchorButton } from "../components/NavAnchorButton";
import { DetailPanel } from "../components/DetailPanel";
import { DetailSlide } from "../components/DetailSlide";
import { ProjectMediaCard } from "../components/ProjectMediaCard";
import { HomeIcon } from "../components/HomeIcon";

type ProjectDarkTileProps = {
  project: ProjectItem | undefined;
  projects: ProjectItem[];
  goToTile: (id: TileId) => void;
  onOpenViewer: (slug: string, index: number) => void;
};

function fallbackProject(): ProjectItem {
  return {
    id: "fallback-0",
    slug: "",
    title: "Project",
    category: "Graphic Design",
    description: "Project details will be added soon.",
    year: "2025",
    client: "Client",
    tags: [],
    detail: {
      panels: [
        { heading: "Approach", body: "Project details will be added soon." },
        { heading: "Outcomes", body: "Project details will be added soon." }
      ],
      media: {
        heroPrimary: "",
        heroSecondary: "",
        viewerMedia: []
      }
    },
    media: [],
    path: ""
  };
}

function isGeneratedPosterFileName(fileName: string) {
  return /\.poster\.(jpg|jpeg|png|webp)$/i.test(fileName);
}

function getMediaFileName(src: string) {
  return src.split("/").pop() ?? src;
}

function getRenderableMedia(project: ProjectItem) {
  return project.media.filter((item) => !isGeneratedPosterFileName(getMediaFileName(item.src)));
}

function resolveMediaByFileName(project: ProjectItem, fileName: string) {
  if (!fileName || isGeneratedPosterFileName(fileName)) return undefined;
  return getRenderableMedia(project).find((item) => getMediaFileName(item.src) === fileName);
}

function resolveHeroDisplayMedia(media: ProjectItem["media"][number] | undefined) {
  return media;
}

function getViewerMedia(project: ProjectItem) {
  const media = getRenderableMedia(project);
  const names = (project.detail.media.viewerMedia ?? []).filter((name) => !isGeneratedPosterFileName(name));
  if (!names || names.length === 0) return media;
  const resolved = names
    .map((name) => media.find((item) => getMediaFileName(item.src) === name))
    .filter((item): item is NonNullable<typeof item> => Boolean(item));
  return resolved.length > 0 ? resolved : media;
}

function resolveDistinctSecondaryHero(
  preferredSource: ProjectItem["media"][number] | undefined,
  viewerMedia: ProjectItem["media"],
  primarySource: ProjectItem["media"][number] | undefined,
  primaryDisplay: ProjectItem["media"][number] | undefined,
) {
  const seen = new Set<string>();
  const candidates = [preferredSource, ...viewerMedia].filter(
    (item): item is NonNullable<typeof item> => Boolean(item),
  );

  for (const candidate of candidates) {
    const key = candidate.id || candidate.src;
    if (seen.has(key)) continue;
    seen.add(key);
    const display = resolveHeroDisplayMedia(candidate);
    if (!display) continue;
    if (!primaryDisplay || display.id !== primaryDisplay.id) {
      return { source: candidate, display };
    }
  }

  for (const candidate of candidates) {
    const candidateKey = candidate.id || candidate.src;
    const primaryKey = primarySource?.id || primarySource?.src;
    if (candidateKey === primaryKey) continue;
    return { source: candidate, display: candidate };
  }

  return { source: preferredSource, display: resolveHeroDisplayMedia(preferredSource) };
}

const PROJECT_HERO_WIDE_ASPECT_RATIO = 1.3;

export function ProjectDarkTile({ project, projects, goToTile, onOpenViewer }: ProjectDarkTileProps) {
  const displayProject = project ?? (projects.length > 0 ? projects[0] : fallbackProject());
  const description = displayProject.description || "Project details will be added soon.";
  const projectIndex = projects.findIndex((p) => p.slug === displayProject.slug);
  const activeProjectIndex = projectIndex >= 0 ? projectIndex : 0;

  const viewerMedia = getViewerMedia(displayProject);
  const primaryMediaSource = resolveMediaByFileName(displayProject, displayProject.detail.media.heroPrimary) ?? viewerMedia[0];
  const preferredSecondaryMediaSource =
    resolveMediaByFileName(displayProject, displayProject.detail.media.heroSecondary) ?? viewerMedia[1];
  const primaryMedia = resolveHeroDisplayMedia(primaryMediaSource);
  const { source: secondaryMediaSource, display: secondaryMedia } = resolveDistinctSecondaryHero(
    preferredSecondaryMediaSource,
    viewerMedia,
    primaryMediaSource,
    primaryMedia,
  );
  const [primaryHeroAspectRatio, setPrimaryHeroAspectRatio] = useState(1);

  useEffect(() => {
    setPrimaryHeroAspectRatio(1);
  }, [displayProject.slug, primaryMedia?.id]);

  const usesSingleWideHero = primaryHeroAspectRatio >= PROJECT_HERO_WIDE_ASPECT_RATIO;
  const primaryHeroStyle = useMemo(
    () => ({ "--project-media-card-wide-aspect": String(primaryHeroAspectRatio || PROJECT_HERO_WIDE_ASPECT_RATIO) }) as CSSProperties,
    [primaryHeroAspectRatio],
  );

  const openForMedia = (targetMediaId?: string) => {
    const index = targetMediaId ? viewerMedia.findIndex((item) => item.id === targetMediaId) : 0;
    onOpenViewer(displayProject.slug, index >= 0 ? index : 0);
  };

  return (
    <DetailSlide
      className={`project-detail--project${usesSingleWideHero ? " project-detail--project-wide-hero" : ""}`}
      headerStart={
        <div className="tile-header__group">
          <NavAnchorButton onClick={() => goToTile("landing")} ariaLabel="Home">
            <HomeIcon className="nav-icon" />
          </NavAnchorButton>
          {projects.map((projectItem, index) => {
            const navLabel = projectItem.slug === "experiments" ? "e" : String(index + 1);
            return (
              <NavAnchorButton
                key={projectItem.id}
                className="nav-button--compact"
                onClick={() => goToTile(`project-${projectItem.slug}` as TileId)}
                ariaLabel={`Open project ${navLabel}: ${projectItem.title}`}
                active={index === activeProjectIndex}
              >
                {navLabel}
              </NavAnchorButton>
            );
          })}
        </div>
      }
      titleBlock={
        <>
          <h2>{displayProject.title}</h2>
          <p>{displayProject.client || "Client"}</p>
        </>
      }
      description={description}
      metaItems={[
        { label: "Year", value: displayProject.year ?? "----" },
        { label: "Category", value: displayProject.category },
        { label: "Tags", value: displayProject.tags.slice(0, 2).join(", ") || "Portfolio" },
      ]}
    >
      <ProjectMediaCard
        className={`project-media-card--hero${usesSingleWideHero ? " project-media-card--hero-wide" : ""}`}
        media={primaryMedia}
        assetBasePath={displayProject.path}
        onClick={() => openForMedia(primaryMediaSource?.id)}
        ariaLabel={`Open ${displayProject.title} media`}
        loading="eager"
        style={usesSingleWideHero ? primaryHeroStyle : undefined}
        onAspectRatioChange={setPrimaryHeroAspectRatio}
      />
      {!usesSingleWideHero ? (
        <ProjectMediaCard
          className="project-media-card--hero-secondary"
          media={secondaryMedia}
          assetBasePath={displayProject.path}
          onClick={() => openForMedia(secondaryMediaSource?.id)}
          ariaLabel={`Open ${displayProject.title} media`}
          loading="eager"
        />
      ) : null}
      <DetailPanel heading={displayProject.detail.panels[0].heading}>{displayProject.detail.panels[0].body || description}</DetailPanel>
      <DetailPanel heading={displayProject.detail.panels[1].heading}>{displayProject.detail.panels[1].body || description}</DetailPanel>
    </DetailSlide>
  );
}
