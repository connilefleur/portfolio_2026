export type SiteInfo = {
  meta: {
    title: string;
    description: string;
  };
  brand: {
    name: string;
    tagline: string;
    subtitle: string;
  };
  contact: {
    email: string;
    instagram: string;
    blurb: string;
  };
  imprint: {
    name: string;
    address: string;
    email: string;
    liability: string;
    copyright: string;
    lastUpdated: string;
  };
};

export type ProjectMedia = {
  id: string;
  type: "image" | "video" | "3d-model" | "image-stack";
  src: string;
  description?: string;
};

export type ProjectItem = {
  id: string;
  slug: string;
  title: string;
  category: string;
  description: string;
  year: number | null;
  client: string;
  tags: string[];
  approach: string;
  outcomes: string;
  media: ProjectMedia[];
  path: string;
};
