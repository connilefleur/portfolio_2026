# Project Template Guide

How to add projects to your terminal portfolio.

## Quick Start

1. Create a folder in `/public/projects/` (folder name = project ID)
2. Add a `meta.json` file
3. Add your media files
4. Rebuild with `npm run build`

## Folder Structure

```
/public/projects/
  /my-project/
    meta.json           # Required - project metadata
    cover.jpg           # Main image
    detail-1.jpg
    demo.mp4
    model.glb
    /sequence/          # For image stacks
      frame-001.jpg
      frame-002.jpg
```

## meta.json Format

```json
{
  "id": "my-project",
  "title": "My Project",
  "category": "3d-render",
  "description": "A brief description of your project.",
  "year": 2024,
  "tags": ["3d", "blender", "rendering"],
  "media": [
    {
      "id": "cover",
      "type": "image",
      "src": "cover.jpg",
      "description": "Main project image"
    },
    {
      "id": "demo",
      "type": "video",
      "src": "demo.mp4",
      "description": "Project demonstration"
    },
    {
      "id": "model",
      "type": "3d-model",
      "src": "model.glb",
      "description": "Interactive 3D model"
    },
    {
      "id": "breakdown",
      "type": "image-stack",
      "src": ["sequence/frame-001.jpg", "sequence/frame-002.jpg"],
      "description": "Step-by-step breakdown"
    }
  ]
}
```

## Field Reference

### Required Fields
| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique identifier (lowercase, hyphens, no spaces) |
| `title` | string | Display name |
| `category` | string | One of: `3d-render`, `vfx`, `photography`, `video-editing`, `experimental`, `coding` |
| `media` | array | At least one media item |

### Optional Fields
| Field | Type | Description |
|-------|------|-------------|
| `description` | string | Project description |
| `year` | number | Year created |
| `tags` | string[] | Tags for filtering |

### Media Types

| Type | Description | src Format |
|------|-------------|------------|
| `image` | Single image | `"filename.jpg"` |
| `video` | Video file | `"filename.mp4"` |
| `3d-model` | 3D model (GLB/GLTF) | `"filename.glb"` |
| `image-stack` | Image sequence | `["img1.jpg", "img2.jpg"]` |

## Supported Formats

**Images:** `.jpg`, `.jpeg`, `.png`, `.webp`, `.gif`

**Videos:** `.mp4`, `.webm`

**3D Models:** `.glb` (recommended), `.gltf`

## Path Rules

All `src` paths are relative to your project folder.

```
/public/projects/my-project/
  meta.json
  cover.jpg          → src: "cover.jpg"
  videos/demo.mp4    → src: "videos/demo.mp4"
```

## Example: Simple Image Project

```
/public/projects/photo-series/
  meta.json
  photo-1.jpg
  photo-2.jpg
  photo-3.jpg
```

```json
{
  "id": "photo-series",
  "title": "Photo Series",
  "category": "photography",
  "description": "A collection of photographs",
  "media": [
    { "id": "p1", "type": "image", "src": "photo-1.jpg" },
    { "id": "p2", "type": "image", "src": "photo-2.jpg" },
    { "id": "p3", "type": "image", "src": "photo-3.jpg" }
  ]
}
```

## Troubleshooting

**Project not appearing:**
- Verify `meta.json` is valid JSON
- Check folder is in `/public/projects/`
- Run `npm run build` to regenerate index

**Media not loading:**
- Check `src` paths match actual filenames (case-sensitive)
- Verify files exist in the project folder

**Invalid JSON:**
- Use a JSON validator
- Ensure double quotes for all strings
- No trailing commas
