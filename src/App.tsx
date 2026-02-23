import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CanvasEngine } from "./canvas/CanvasEngine";
import {
  DEFAULT_TILE,
  type TileConfig,
  type TileId,
  getAdjacentTileId,
  getProjectSlugFromTileId,
  getProjectTiles,
  getTileRegistry,
  isProjectTileId,
  parseTileId
} from "./canvas/tileRegistry";
import { loadProjectsIndex, siteInfo } from "./data/siteData";
import type { ProjectItem } from "./types/content";
import { LandingTile } from "./tiles/LandingTile";
import { MoreWorkTile } from "./tiles/MoreWorkTile";
import { ProjectDarkTile } from "./tiles/ProjectDarkTile";
import { ProjectOverviewTile } from "./tiles/ProjectOverviewTile";
import { WorkTogetherTile } from "./tiles/WorkTogetherTile";
import { NavRopeOverlay } from "./components/NavRopeOverlay";

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
  return "active";
}

export default function App() {
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const tileRegistry = useMemo(() => getTileRegistry(projects), [projects]);
  const [activeTileId, setActiveTileId] = useState<TileId>(DEFAULT_TILE);
  const [introPhase, setIntroPhase] = useState<"active" | "exiting" | "done">(getInitialIntroPhase);
  const introTimerRef = useRef<number | null>(null);
  const [themeMode, setThemeMode] = useState<"dark" | "light">(() => {
    const saved = window.localStorage.getItem("theme-mode");
    return saved === "light" ? "light" : "dark";
  });

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
      .catch(() => setProjects([]));
  }, []);

  const hasInitialUrlSync = useRef(false);
  const previousTileId = useRef<TileId | null>(null);
  const skipNextUrlWrite = useRef(false);
  useEffect(() => {
    if (tileRegistry.length > 0 && !hasInitialUrlSync.current) {
      const initialTile = readTileFromUrl(tileRegistry);
      previousTileId.current = initialTile;
      setActiveTileId(initialTile);
      hasInitialUrlSync.current = true;
    }
  }, [tileRegistry]);

  useEffect(() => {
    const onPopState = () => {
      const nextTile = readTileFromUrl(tileRegistry);
      skipNextUrlWrite.current = true;
      previousTileId.current = nextTile;
      setActiveTileId(nextTile);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [tileRegistry]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (introPhase !== "done") return;
      const projectTiles = getProjectTiles(tileRegistry);
      const inProjectMode = isProjectTileId(activeTileId) && projectTiles.length > 0;

      if (inProjectMode && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
        event.preventDefault();
        const idx = projectTiles.findIndex((t) => t.id === activeTileId);
        if (idx < 0) return;
        const next =
          event.key === "ArrowDown"
            ? projectTiles[Math.min(idx + 1, projectTiles.length - 1)]
            : projectTiles[Math.max(idx - 1, 0)];
        setActiveTileId(next.id);
        return;
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        setActiveTileId((current) => getAdjacentTileId(current, 1, 0, tileRegistry));
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        setActiveTileId((current) => getAdjacentTileId(current, -1, 0, tileRegistry));
      }
      if (!inProjectMode && event.key === "ArrowDown") {
        event.preventDefault();
        setActiveTileId((current) => getAdjacentTileId(current, 0, 1, tileRegistry));
      }
      if (!inProjectMode && event.key === "ArrowUp") {
        event.preventDefault();
        setActiveTileId((current) => getAdjacentTileId(current, 0, -1, tileRegistry));
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [tileRegistry, activeTileId, introPhase]);

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
      // Ensure one-step back from any project returns to landing.
      writeTileToUrl("landing", "push");
    }

    const mode: "push" | "replace" = wasProject && isProject ? "replace" : "push";
    writeTileToUrl(activeTileId, mode);
    previousTileId.current = activeTileId;
  }, [activeTileId]);

  useEffect(() => {
    window.localStorage.setItem("theme-mode", themeMode);
  }, [themeMode]);

  const startIntroExit = useCallback(() => {
    if (introPhase !== "active") return;
    setIntroPhase("exiting");
    introTimerRef.current = window.setTimeout(() => {
      setIntroPhase("done");
      introTimerRef.current = null;
    }, 420);
  }, [introPhase]);

  useEffect(() => {
    return () => {
      if (introTimerRef.current) {
        window.clearTimeout(introTimerRef.current);
      }
    };
  }, []);

  const goToTile = useCallback((tileId: TileId) => setActiveTileId(tileId), []);

  const tileRenderer = useCallback(
    (tile: TileConfig) => {
      const projectSlug = getProjectSlugFromTileId(tile.id);
      if (projectSlug) {
        const project = projects.find((p) => p.slug === projectSlug);
        return <ProjectDarkTile project={project} projects={projects} goToTile={goToTile} />;
      }
      switch (tile.id) {
        case "landing":
          return (
            <LandingTile
              projects={projects}
              siteInfo={siteInfo}
              goToTile={goToTile}
              introPhase={introPhase}
              onIntroEnter={startIntroExit}
            />
          );
        case "recognition":
          return <MoreWorkTile goToTile={goToTile} />;
        case "about-me":
          return <ProjectOverviewTile projects={projects} goToTile={goToTile} />;
        case "work-together":
          return <WorkTogetherTile siteInfo={siteInfo} goToTile={goToTile} />;
        default:
          return null;
      }
    },
    [goToTile, introPhase, projects, startIntroExit]
  );

  return (
    <main className="app-shell" data-theme={themeMode} data-intro={introPhase}>
      <div className="app-content">
        <CanvasEngine
          activeTileId={activeTileId}
          tileRegistry={tileRegistry}
          renderTile={tileRenderer}
          introPhase={introPhase}
        />
        <NavRopeOverlay />
      </div>
    </main>
  );
}
