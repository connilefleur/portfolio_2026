import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CanvasEngine } from "./canvas/CanvasEngine";
import {
  DEFAULT_TILE,
  type TileConfig,
  type TileId,
  getProjectSlugFromTileId,
  getProjectViewerSlugFromTileId,
  getTileRegistry,
  isProjectTileId,
  parseTileId
} from "./canvas/tileRegistry";
import { loadProjectsIndex, siteInfo, slideContent } from "./data/siteData";
import type { ProjectItem } from "./types/content";
import { LandingTile } from "./tiles/LandingTile";
import { MoreWorkTile } from "./tiles/MoreWorkTile";
import { ProjectDarkTile } from "./tiles/ProjectDarkTile";
import { ProjectOverviewTile } from "./tiles/ProjectOverviewTile";
import { WorkTogetherTile } from "./tiles/WorkTogetherTile";
import { ImprintTile } from "./tiles/ImprintTile";
import { ProjectViewerTile } from "./tiles/ProjectViewerTile";

function readTileFromUrl(registry: TileConfig[]): TileId {
  const params = new URLSearchParams(window.location.search);
  return parseTileId(params.get("tile"), registry) ?? DEFAULT_TILE;
}

function writeTileToUrl(tileId: TileId, mode: "push" | "replace" = "push") {
  const nextUrl = new URL(window.location.href);
  nextUrl.searchParams.set("tile", tileId);
  if (mode === "replace") {
    window.history.replaceState({ tileId }, "", nextUrl);
    return;
  }
  window.history.pushState({ tileId }, "", nextUrl);
}

function getInitialIntroPhase(): "active" | "exiting" | "done" {
  const params = new URLSearchParams(window.location.search);
  const initialTile = params.get("tile");
  if (initialTile && initialTile !== "landing") {
    return "done";
  }

  const navEntry = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
  if (navEntry && (navEntry.type === "back_forward" || navEntry.type === "reload")) {
    return "done";
  }

  return "active";
}

export default function App() {
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [projectsLoaded, setProjectsLoaded] = useState(false);
  const tileRegistry = useMemo(() => getTileRegistry(projects), [projects]);
  const [activeTileId, setActiveTileId] = useState<TileId>(DEFAULT_TILE);
  const [introPhase, setIntroPhase] = useState<"active" | "exiting" | "done">(getInitialIntroPhase);
  const introTimerRef = useRef<number | null>(null);
  const [themeMode, setThemeMode] = useState<"dark" | "light">(() => {
    const saved = window.localStorage.getItem("theme-mode");
    return saved === "light" ? "light" : "dark";
  });
  const [projectViewerIndex, setProjectViewerIndex] = useState<Record<string, number>>({});

  useEffect(() => {
    document.title = siteInfo.meta.title;
    const descriptionTag = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (descriptionTag) {
      descriptionTag.content = siteInfo.meta.description;
    } else {
      const meta = document.createElement("meta");
      meta.setAttribute("name", "description");
      meta.setAttribute("content", siteInfo.meta.description);
      document.head.appendChild(meta);
    }
  }, []);

  useEffect(() => {
    loadProjectsIndex()
      .then((items) => setProjects(items))
      .catch(() => setProjects([]))
      .finally(() => setProjectsLoaded(true));
  }, []);

  const hasInitialUrlSync = useRef(false);
  const [initialTileResolved, setInitialTileResolved] = useState(false);
  const initialUrlTileRef = useRef<string | null>(new URLSearchParams(window.location.search).get("tile"));
  const pendingInitialProjectTileIdRef = useRef<TileId | null>(null);
  const previousTileId = useRef<TileId | null>(null);
  const skipNextUrlWrite = useRef(false);

  useEffect(() => {
    if (tileRegistry.length === 0 || hasInitialUrlSync.current) return;

    const requestedTileRaw = initialUrlTileRef.current;
    const requestedIsProject = Boolean(requestedTileRaw?.startsWith("project-"));

    if (requestedIsProject && !projectsLoaded) {
      return;
    }

    const requestedTile = parseTileId(requestedTileRaw, tileRegistry);

    if (requestedTile && isProjectTileId(requestedTile)) {
      previousTileId.current = "landing";
      setActiveTileId("landing");
      pendingInitialProjectTileIdRef.current = requestedTile;
    } else {
      const initialTile = requestedTile ?? DEFAULT_TILE;
      previousTileId.current = initialTile;
      setActiveTileId(initialTile);
    }

    hasInitialUrlSync.current = true;
    setInitialTileResolved(true);
  }, [projectsLoaded, tileRegistry]);

  useEffect(() => {
    if (!hasInitialUrlSync.current) return;
    if (introPhase !== "done") return;

    const pendingProjectTile = pendingInitialProjectTileIdRef.current;
    if (!pendingProjectTile) return;

    pendingInitialProjectTileIdRef.current = null;
    skipNextUrlWrite.current = true;
    window.requestAnimationFrame(() => {
      setActiveTileId(pendingProjectTile);
    });
  }, [introPhase, projectsLoaded, tileRegistry]);

  useEffect(() => {
    const onPopState = () => {
      const nextTile = readTileFromUrl(tileRegistry);
      skipNextUrlWrite.current = true;
      pendingInitialProjectTileIdRef.current = null;
      previousTileId.current = nextTile;
      setActiveTileId(nextTile);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [tileRegistry]);

  useEffect(() => {
    if (!hasInitialUrlSync.current) return;
    if (skipNextUrlWrite.current) {
      skipNextUrlWrite.current = false;
      previousTileId.current = activeTileId;
      return;
    }

    const prev = previousTileId.current;
    if (prev === activeTileId) return;

    const wasProject = prev ? isProjectTileId(prev) : false;
    const isProject = isProjectTileId(activeTileId);

    if (!wasProject && isProject && prev && prev !== "landing") {
      writeTileToUrl("landing", "push");
    }

    const mode: "push" | "replace" = wasProject && isProject ? "replace" : "push";
    writeTileToUrl(activeTileId, mode);
    previousTileId.current = activeTileId;
  }, [activeTileId]);

  useEffect(() => {
    window.localStorage.setItem("theme-mode", themeMode);
  }, [themeMode]);

  useEffect(() => {
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        setIntroPhase("done");
      }
    };

    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, []);

  useEffect(() => {
    if (introPhase !== "active") return;
    const rafId = window.requestAnimationFrame(() => {
      setIntroPhase("exiting");
      introTimerRef.current = window.setTimeout(() => {
        setIntroPhase("done");
        introTimerRef.current = null;
      }, 420);
    });
    return () => window.cancelAnimationFrame(rafId);
  }, [introPhase]);

  useEffect(() => {
    return () => {
      if (introTimerRef.current) {
        window.clearTimeout(introTimerRef.current);
      }
    };
  }, []);

  const goToTile = useCallback((tileId: TileId) => {
    setActiveTileId(tileId);
  }, []);

  const openProjectViewer = useCallback((slug: string, index: number) => {
    setProjectViewerIndex((current) => ({ ...current, [slug]: index }));
    setActiveTileId(`project-viewer-${slug}` as TileId);
  }, []);

  const setViewerIndexForProject = useCallback((slug: string, index: number) => {
    setProjectViewerIndex((current) => ({ ...current, [slug]: index }));
  }, []);

  const tileRenderer = useCallback(
    (tile: TileConfig) => {
      const projectViewerSlug = getProjectViewerSlugFromTileId(tile.id);
      if (projectViewerSlug) {
        const project = projects.find((p) => p.slug === projectViewerSlug);
        return (
          <ProjectViewerTile
            project={project}
            currentIndex={projectViewerIndex[projectViewerSlug] ?? 0}
            onBack={() => goToTile(`project-${projectViewerSlug}` as TileId)}
            onSelectIndex={(index) => setViewerIndexForProject(projectViewerSlug, index)}
            goToTile={goToTile}
          />
        );
      }

      const projectSlug = getProjectSlugFromTileId(tile.id);
      if (projectSlug) {
        const project = projects.find((p) => p.slug === projectSlug);
        return <ProjectDarkTile project={project} projects={projects} goToTile={goToTile} onOpenViewer={openProjectViewer} />;
      }

      switch (tile.id) {
        case "landing":
          return (
            <LandingTile
              projects={projects}
              siteInfo={siteInfo}
              goToTile={goToTile}
              introPhase={introPhase}
            />
          );
        case "recognition":
          return <MoreWorkTile content={slideContent.recognition} goToTile={goToTile} />;
        case "about-me":
          return <ProjectOverviewTile content={slideContent.overview} projects={projects} goToTile={goToTile} />;
        case "work-together":
          return <WorkTogetherTile content={slideContent.contact} siteInfo={siteInfo} goToTile={goToTile} />;
        case "imprint":
          return <ImprintTile siteInfo={siteInfo} goToTile={goToTile} />;
        default:
          return null;
      }
    },
    [goToTile, introPhase, openProjectViewer, projectViewerIndex, projects, setViewerIndexForProject]
  );

  const appReady = projectsLoaded && initialTileResolved;

  if (!appReady) {
    return (
      <main className="app-shell" data-theme={themeMode} data-intro={introPhase}>
        <div className="app-loading" aria-live="polite" aria-label="Loading portfolio" />
      </main>
    );
  }

  return (
    <main className="app-shell" data-theme={themeMode} data-intro={introPhase}>
      <div className="app-content">
        <CanvasEngine
          activeTileId={activeTileId}
          tileRegistry={tileRegistry}
          renderTile={tileRenderer}
          introPhase={introPhase}
        />
      </div>
    </main>
  );
}
