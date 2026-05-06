export type AxisKey = 'video' | 'cgi' | 'code';

export interface MediaItem {
  url: string;
  type: 'image' | 'video';
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
  media: MediaItem[];
}
