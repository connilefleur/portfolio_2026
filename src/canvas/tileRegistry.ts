import type { ProjectItem } from "../types/content";

export type TileId =
  | "landing"
  | "recognition"
  | "about-me"
  | "work-together"
  | "imprint"
  | `project-${string}`
  | `project-viewer-${string}`;

export type TileConfig = {
  id: TileId;
  x: number;
  y: number;
  label: string;
};

export const NAV_TILE_IDS: TileId[] = ["landing", "work-together", "recognition", "imprint"];

const STATIC_TILES: TileConfig[] = [
  { id: "recognition", x: 1, y: 0, label: "Recognition" },
  { id: "landing", x: 1, y: 1, label: "Landing" },
  { id: "work-together", x: 2, y: 1, label: "Work together" },
  { id: "imprint", x: 2, y: 0, label: "Imprint" }
];

/* Projects stack vertically below landing. Each project gets a viewer tile directly to the right. */
export function getTileRegistry(projects: ProjectItem[]): TileConfig[] {
  const projectTiles: TileConfig[] = [];
  const viewerTiles: TileConfig[] = [];

  projects.forEach((project, index) => {
    const y = 2 + index;
    projectTiles.push({
      id: `project-${project.slug}` as TileId,
      x: 1,
      y,
      label: project.title
    });
    viewerTiles.push({
      id: `project-viewer-${project.slug}` as TileId,
      x: 2,
      y,
      label: `${project.title} Viewer`
    });
  });

  return [...STATIC_TILES, ...projectTiles, ...viewerTiles];
}

export function getNavTiles(registry: TileConfig[]): TileConfig[] {
  return registry.filter((tile) => NAV_TILE_IDS.includes(tile.id));
}

export const DEFAULT_TILE: TileId = "landing";

export function getTileById(id: TileId, registry: TileConfig[]): TileConfig {
  const tile = registry.find((t) => t.id === id);
  return tile ?? registry.find((t) => t.id === "landing") ?? registry[0];
}

export function parseTileId(value: string | null, registry: TileConfig[]): TileId | null {
  if (!value) return null;
  return registry.some((tile) => tile.id === value) ? (value as TileId) : null;
}

export function getAdjacentTileId(currentId: TileId, dx: number, dy: number, registry: TileConfig[]): TileId {
  const current = getTileById(currentId, registry);
  const match = registry.find((tile) => tile.x === current.x + dx && tile.y === current.y + dy);
  return match?.id ?? currentId;
}

export function isProjectTileId(id: TileId): id is `project-${string}` {
  return id.startsWith("project-") && !id.startsWith("project-viewer-");
}

export function isProjectViewerTileId(id: TileId): id is `project-viewer-${string}` {
  return id.startsWith("project-viewer-");
}

export function getProjectSlugFromTileId(id: TileId): string | null {
  return isProjectTileId(id) ? id.slice(8) : null;
}

export function getProjectViewerSlugFromTileId(id: TileId): string | null {
  return isProjectViewerTileId(id) ? id.slice("project-viewer-".length) : null;
}

export function getProjectTiles(registry: TileConfig[]): TileConfig[] {
  return registry.filter((tile) => isProjectTileId(tile.id));
}
