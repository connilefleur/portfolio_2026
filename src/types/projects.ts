export type MediaType = 'image' | 'video' | '3d-model' | 'image-stack';

export type ProjectCategory = 
  | '3d-render' 
  | 'vfx' 
  | 'photography' 
  | 'video-editing' 
  | 'experimental' 
  | 'coding';

export interface MediaItem {
  id: string;
  type: MediaType;
  src: string | string[];
  description?: string;
  metadata?: {
    duration?: number;
    modelFormat?: 'gltf' | 'glb' | 'obj';
  };
  _resolvedSrc?: string | string[];
}

export interface Project {
  id: string;
  title: string;
  category: ProjectCategory;
  description?: string;
  year?: number;
  tags?: string[];
  media: MediaItem[];
  _folder?: string;
  _basePath?: string;
}
