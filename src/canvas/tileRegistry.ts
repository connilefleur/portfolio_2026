import type { ProjectItem } from "../types/content";

export type TileId = "landing" | "recognition" | "about-me" | "work-together" | `project-${string}`;

export type TileConfig = {
  id: TileId;
  x: number;
  y: number;
  label: string;
};

export const NAV_TILE_IDS: TileId[] = ["landing", "about-me", "work-together"];

const STATIC_TILES: TileConfig[] = [
  { id: "recognition", x: 1, y: 0, label: "Recognition" },
  { id: "about-me", x: 0, y: 1, label: "About me" },
  { id: "landing", x: 1, y: 1, label: "Landing" },
  { id: "work-together", x: 2, y: 1, label: "Work together" }
];

/* Projects stack vertically below landing: first at (1,2), then (1,3), (1,4), ... */
export function getTileRegistry(projects: ProjectItem[]): TileConfig[] {
  const projectTiles: TileConfig[] = projects.map((p, i) => ({
    id: `project-${p.slug}` as TileId,
    x: 1,
    y: 2 + i,
    label: p.title
  }));
  return [...STATIC_TILES, ...projectTiles];
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
  return id.startsWith("project-");
}

export function getProjectSlugFromTileId(id: TileId): string | null {
  return isProjectTileId(id) ? id.slice(8) : null;
}

export function getProjectTiles(registry: TileConfig[]): TileConfig[] {
  return registry.filter((t) => isProjectTileId(t.id));
}
