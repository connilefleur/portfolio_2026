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

export type ProjectDetailPanel = {
  heading: string;
  body: string;
};

export type ProjectDetailMedia = {
  heroPrimary: string;
  heroSecondary: string;
  viewerMedia: string[];
};

export type ProjectDetail = {
  panels: [ProjectDetailPanel, ProjectDetailPanel];
  media: ProjectDetailMedia;
};

export type ProjectItem = {
  id: string;
  slug: string;
  title: string;
  category: string;
  description: string;
  year: string;
  client: string;
  tags: string[];
  detail: ProjectDetail;
  media: ProjectMedia[];
  path: string;
};


export type OverviewCardContent = {
  id: string;
  title?: string;
  projectSlug?: string;
  services: string[];
};

export type RecognitionItem = {
  id: string;
  title: string;
  year: number;
  publication: string;
  description: string;
  actionLabel: string;
  targetSlide: string;
};

export type ContactSlideContent = {
  title: string;
  labels: {
    instagram: string;
    email: string;
    recognition: string;
  };
  actions: {
    recognition: string;
  };
};

export type SlideContent = {
  overview: {
    cards: OverviewCardContent[];
  };
  recognition: {
    title: string;
    columns: [string, string, string, string, string];
    items: RecognitionItem[];
  };
  contact: ContactSlideContent;
};
