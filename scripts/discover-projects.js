/**
 * Project Discovery Script
 * Scans /public/projects/ for project folders with meta.json
 * Generates /public/projects-index.json at build time
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROJECTS_DIR = path.resolve(__dirname, '../public/projects');
const OUTPUT_FILE = path.resolve(__dirname, '../public/projects-index.json');

function discoverProjects() {
  const projects = [];
  
  // Check if projects directory exists
  if (!fs.existsSync(PROJECTS_DIR)) {
    console.log('Creating projects directory...');
    fs.mkdirSync(PROJECTS_DIR, { recursive: true });
  }

  // Read all directories in projects folder
  const entries = fs.readdirSync(PROJECTS_DIR, { withFileTypes: true });
  
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    
    const projectPath = path.join(PROJECTS_DIR, entry.name);
    const metaPath = path.join(projectPath, 'meta.json');
    
    // Skip if no meta.json
    if (!fs.existsSync(metaPath)) {
      console.log(`Skipping ${entry.name}: no meta.json found`);
      continue;
    }
    
    try {
      const metaContent = fs.readFileSync(metaPath, 'utf-8');
      const meta = JSON.parse(metaContent);
      
      // Add folder path info
      meta._folder = entry.name;
      meta._basePath = `/projects/${entry.name}`;
      
      // Resolve media paths
      if (meta.media) {
        meta.media = meta.media.map(item => ({
          ...item,
          _resolvedSrc: Array.isArray(item.src)
            ? item.src.map(s => `/projects/${entry.name}/${s}`)
            : `/projects/${entry.name}/${item.src}`
        }));
      }
      
      projects.push(meta);
      console.log(`Found project: ${meta.title || entry.name}`);
    } catch (err) {
      console.error(`Error parsing ${metaPath}:`, err.message);
    }
  }

  // Sort by year (newest first), then by title
  projects.sort((a, b) => {
    if (b.year !== a.year) return (b.year || 0) - (a.year || 0);
    return (a.title || '').localeCompare(b.title || '');
  });

  // Write index file
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(projects, null, 2));
  console.log(`\nGenerated ${OUTPUT_FILE}`);
  console.log(`Found ${projects.length} project(s)`);
}

discoverProjects();
