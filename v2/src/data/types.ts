export type AxisKey = 'lens' | 'cgi' | 'code';

export interface MediaItem {
  url: string;
  srcSet?: string;
  poster?: string;
  // 'interactive' = the Sun Matters video↔splat experience, hosted in the Viewer stage.
  type: 'image' | 'video' | 'compare' | 'interactive';
  compareUrl?: string;
  link?: { label: string; url: string };  // overrides project link when this item is active
  label?: string;
  secondary?: boolean;
}

export interface Project {
  id: string;
  order: number;
  idx: string;
  yearShort: string;
  nm: string;
  year: string;
  title: string;
  category: string;
  axis: AxisKey;
  count: number;
  client: string;
  info1h: string;
  info1: string;
  info2h: string;
  info2: string;
  link?: { label: string; url: string };
  media: MediaItem[];
}
