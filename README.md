# Terminal Portfolio

A fullscreen, terminal-style portfolio website where visitors explore projects by typing commands.

## Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Adding Projects

### Quick Method (Auto-Discovery)

Simply create a folder in `/public/projects/` with your media files:

1. Create a folder (e.g., `lookbook/`, `shows/`, `my-project/`)
2. Add your media files directly to the folder:
   - **Images**: `.jpg`, `.png`, `.gif`, `.webp`, `.svg`, etc.
   - **Videos**: `.mp4`, `.webm`, `.mov`, etc.
   - **3D Models**: `.gltf`, `.glb`, `.obj`, etc. (3D viewer coming soon)
3. (Optional) Add an `info.txt` file with project metadata (see format below)
4. Run `npm run build` (or `npm run discover`) to auto-generate project metadata

The system will:
- Use the folder name as the project name (capitalized)
- Auto-detect file types and categorize the project
- Support mixed media (images + videos in the same project)
- Create a slideshow viewer automatically
- Parse `info.txt` if present for additional metadata

**Example:**
```
public/projects/
  lookbook/
    info.txt
    image1.jpg
    image2.jpg
    image3.png
  shows/
    video1.mp4
    video2.mp4
  mixed-project/
    photo1.jpg
    video1.mp4
    photo2.jpg
```

#### info.txt Format

Create an `info.txt` file in your project folder with simple line-based metadata:

```
2024
Client Name
Project description
Additional info line 1 | Additional info line 2
```

**Format:**
- **Line 1**: Year (4 digits, e.g., `2024`) or Client name
- **Line 2**: Client name (if year was on line 1) or continue
- **Line 3**: Description
- **Line 4+**: Additional metadata (tags, role, etc.) - will be joined with ` | `

**Example info.txt:**
```
2024
Nike
Brand campaign for summer collection
Role: Creative Director | Tags: branding, photography, video
```

The data from `info.txt` is stored in the project metadata for future use on the website.

### Advanced Method (Custom Metadata)

For more control, add a `meta.json` file to your project folder:

```json
{
  "id": "my-project",
  "title": "My Project",
  "category": "photography",
  "description": "Project description",
  "year": 2026,
  "tags": ["tag1", "tag2"],
  "media": [
    {
      "id": "image1",
      "type": "image",
      "src": "image1.jpg",
      "description": "Optional description"
    }
  ]
}
```

See [PROJECT_TEMPLATE.md](./PROJECT_TEMPLATE.md) for detailed instructions.

## Editing Content

### Contact & Impressum

Edit the markdown files in `/public/content/`:
- `contact.md` - Your contact information
- `impressum.md` - Legal notice / imprint

## Commands

| Command | Description |
|---------|-------------|
| `help` | List available commands |
| `open` | List all projects |
| `open <name>` | Open project by folder name or title |
| `close` | Close current viewer |
| `contact` | Show contact info |
| `imprint` | Show legal notice |
| `clear` | Clear terminal |
| `snake` | Play Snake game |
| `tetris` | Play Tetris game |

## Deployment

1. Run `npm run build`
2. Upload the `dist/` folder to your hosting provider
3. Configure your custom domain

Works with any static hosting: Netlify, Vercel, GitHub Pages, Strato, IONOS, etc.

## Tech Stack

- React + TypeScript
- Vite (build tool)
- xterm.js (terminal emulator)
- Three.js (3D viewer)

## Project Structure

```
public/
  projects/          # Your project folders
  content/           # Contact & impressum markdown
src/
  components/        # React components
  hooks/             # Custom React hooks
  types/             # TypeScript definitions
scripts/
  discover-projects.js  # Build-time project scanner
```

See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed architecture documentation.
