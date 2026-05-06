import type { Project } from './types';

export const PROJECTS: Project[] = [
  {
    id: 'e30',
    order: 1, idx: '001', yearShort: '25',
    nm: 'E30 Pressure Sim', year: '2025', title: 'E30 Pressure Sim',
    category: 'CGI', axis: 'cgi', count: 4,
    client: 'Personal',
    info1h: 'Simulation Setup',
    info1: 'Vellum pressure simulation applied to a BMW E30 body shell. Each body panel was treated as a closed pressure volume — the solver inflates the geometry from within, creating organic membrane tension between panels. Pressure attributes, stiffness and damping were wedged across iterations to control the degree of inflation and surface crumpling at panel seams.',
    info2h: 'Outcome',
    info2: 'A pressurized BMW E30 — classic car body transformed into an inflated, biomorphic object. The project proves Vellum solver understanding, pressure dynamics, constraint handling and Octane lookdev on complex deforming geometry.',
    media: [
      { url: '/projects/e30/images/cars-pressurized-rop-image1-0001.jpg', type: 'image' },
      { url: '/projects/e30/images/cars-pressurized-rop-image1-0002.jpg', type: 'image' },
      { url: '/projects/e30/images/cars-pressurized-rop-image1-0003.jpg', type: 'image' },
      { url: '/projects/e30/images/cars-pressurized-rop-image1-0004.jpg', type: 'image' },
      { url: '/projects/e30/images/cars-pressurized-rop-image1-0006.jpg', type: 'image' },
      // TODO: add simulation viewport screenshot, wedge variation grid, node network crop
    ],
  },
  {
    id: 'glasses',
    order: 2, idx: '002', yearShort: '25',
    nm: 'Glass Lookdev', year: '2025', title: 'Glass Lookdev',
    category: 'CGI', axis: 'cgi', count: 3,
    client: 'Personal',
    info1h: 'Lookdev',
    info1: 'Glass material study in Octane — transmission, IOR, caustics and dispersion tuned across multiple glass types. Precision silhouette and backlit lighting rigs built to reveal internal refraction geometry. Shot-by-shot camera and lighting adjustments per form.',
    info2h: 'Outcome',
    info2: 'Three-shot sequence demonstrating high-end glass rendering: full silhouette, animated camera pass, and tight hero composition. Proves Octane material control, render discipline and product-quality lookdev on optically complex geometry.',
    media: [
      { url: '/projects/glasses/images/oct-glass-silhuettes-image-0017-shot-002-denoisedbeauty.jpg',            type: 'image' },
      { url: '/projects/glasses/images/oct-glass-silhuettes-image-0030-shot-004-animation-denoisedbeauty.jpg', type: 'image' },
      { url: '/projects/glasses/images/oct-glass-silhuettes-image-0089-shot-1-denoisedbeauty.jpg',             type: 'image' },
      // TODO: add material node screenshot, lighting rig, AOV passes, animated render clip
    ],
  },
  {
    id: 'vfx',
    order: 3, idx: '003', yearShort: '24',
    nm: 'Skrrt Cobain — So High', year: '2024', title: 'Skrrt Cobain\n— So High',
    category: 'VFX', axis: 'video', count: 2,
    client: 'Scholz & Friends',
    info1h: 'Production',
    info1: 'VFX production for the Skrrt Cobain "So High" music video campaign, delivered in collaboration with Scholz & Friends and Sony Music. Compositing and 3D integration across multiple shots — matching live footage lighting, integrating CG elements and delivering final online masters.',
    info2h: 'Outcome',
    info2: 'Commercially released music video with full VFX breakdown. Demonstrates production-grade delivery, client pipeline integration and compositing discipline under agency brief.',
    media: [
      { url: '/projects/vfx/videos/skrtcobain-sohigh-online-v07-h264-1d10d472.mp4', type: 'video' },
      { url: '/projects/vfx/videos/sohigh-vfxbd-spktrm-comp-162a9a6e.mp4',          type: 'video' },
      // TODO: add shot breakdown stills, comp layer splits, before/after plates
    ],
  },
  {
    id: 'web',
    order: 4, idx: '004', yearShort: '24–25',
    nm: 'Web & Interactive', year: '2024–2025', title: 'Web &\nInteractive',
    category: 'Code', axis: 'code', count: 3,
    client: 'Various',
    info1h: 'Scope',
    info1: 'Web development and interactive work for agency and personal clients — custom sites, embedded interactive components, WebGL experiments and creative tools built for the browser.',
    info2h: 'Stack',
    info2: 'React, TypeScript, Vite, WebGL/GLSL, vanilla JS. Focus on performant, visually precise builds that match the quality of the surrounding 3D and motion work.',
    media: [
      // TODO: add screenshots and recordings when web projects are ready
    ],
  },
  {
    id: 'flythroughs',
    order: 5, idx: '005', yearShort: '24–25',
    nm: 'Painting Flythroughs', year: '2024–2025', title: 'Painting\nFlythroughs',
    category: 'CGI', axis: 'cgi', count: 4,
    client: 'Personal',
    info1h: 'Pipeline',
    info1: 'AI-generated multi-perspective images used as training data for Gaussian Splat reconstruction via COLMAP and Lightfield Studio. The trained splats are loaded into Houdini, manipulated with GSOPs — adjusting splat density, scale and orientation — then a camera path is authored and the scene rendered with Relight in Octane.',
    info2h: 'Outcome',
    info2: 'A series of flythrough films through painting-like spatial environments — 2D imagery reconstructed into navigable 3D Gaussian Splat scenes. Each piece is a distinct visual world. The pipeline combines AI image synthesis, photogrammetric reconstruction, Houdini-native splat manipulation and production-grade rendering in a single workflow.',
    media: [
      { url: '/projects/flythroughs/videos/flythroughs-video-001.mp4', type: 'video' },
      // TODO: add flythroughs-video-002.mp4, flythroughs-video-003.mp4 when ready
      // TODO: add pipeline screenshots: COLMAP point cloud, GSOPs node network, Octane Relight setup
    ],
  },
  {
    id: 'reel',
    order: 6, idx: 'REEL', yearShort: '24–26',
    nm: 'Simulation Reel', year: '2024–2026', title: 'Simulation\nReel',
    category: 'CGI', axis: 'cgi', count: 2,
    client: 'Personal',
    info1h: 'Range',
    info1: 'Simulation and rendering experiments across Vellum cloth, FLIP fluid, volume VDB, COPs and AI-assisted look development via OTOY Canvas.',
    info2h: '',
    info2: '',
    media: [
      { url: '/projects/reel/videos/bubble-burst-dd2b2e4a.mp4',       type: 'video' },
      { url: '/projects/reel/videos/fluid-image-9040954f.mp4',        type: 'video' },
      { url: '/projects/reel/videos/ct-scan-339bb785.mp4',            type: 'video' },
      { url: '/projects/reel/videos/melting-landscapes-4f0ab15d.mp4', type: 'video' },
      { url: '/projects/reel/videos/spektrum-logo-final.mov',         type: 'video' },
      { url: '/projects/reel/videos/0001-0200-b5c2db65.mp4',          type: 'video' },
      { url: '/projects/reel/videos/otoy-studio-video-hyperlapse-transitioning-from-desaturated-teal-to-2025-12-19t20-41-32-ba50c582.mp4', type: 'video' },
    ],
  },
];

export const PROJECTS_BY_ID = Object.fromEntries(PROJECTS.map(p => [p.id, p]));
