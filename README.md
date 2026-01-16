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

1. Create a folder in `/public/projects/` (e.g., `my-project/`)
2. Add a `meta.json` file with project metadata
3. Add your media files (images, videos, 3D models)
4. Run `npm run build` to regenerate the project index

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
| `projects` | List all projects |
| `project <name>` | Open project viewer |
| `close` | Close current viewer |
| `contact` | Show contact info |
| `imprint` | Show legal notice |
| `clear` | Clear terminal |

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
