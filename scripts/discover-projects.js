/**
 * Project Discovery Script
 * Scans /public/projects/ for project folders
 * Auto-detects content and generates metadata if no meta.json exists
 * Generates /public/projects-index.json at build time
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROJECTS_DIR = path.resolve(__dirname, '../public/projects');
const OUTPUT_FILE = path.resolve(__dirname, '../public/projects-index.json');

// File type detection
const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.tiff', '.tif'];
const VIDEO_EXTENSIONS = ['.mp4', '.webm', '.ogg', '.mov', '.avi', '.mkv', '.m4v'];
const MODEL_3D_EXTENSIONS = ['.gltf', '.glb', '.obj', '.fbx', '.dae', '.3ds'];

function getFileType(filename) {
  const ext = path.extname(filename).toLowerCase();
  if (IMAGE_EXTENSIONS.includes(ext)) return 'image';
  if (VIDEO_EXTENSIONS.includes(ext)) return 'video';
  if (MODEL_3D_EXTENSIONS.includes(ext)) return '3d-model';
  return null;
}

function parseInfoTxt(projectPath) {
  const infoPath = path.join(projectPath, 'info.txt');
  if (!fs.existsSync(infoPath)) {
    return null;
  }
  
  try {
    const content = fs.readFileSync(infoPath, 'utf-8').trim();
    const lines = content.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    
    if (lines.length === 0) return null;
    
    const info = {};
    
    // Parse line by line - simple format
    // Line 1: Year (optional, can be number or text)
    if (lines[0]) {
      const yearMatch = lines[0].match(/^(\d{4})$/);
      if (yearMatch) {
        info.year = parseInt(yearMatch[1], 10);
      } else {
        // If first line doesn't look like a year, treat it as client/name
        info.client = lines[0];
      }
    }
    
    // Line 2: Client (if year was on line 1) or continue parsing
    if (lines[1]) {
      if (info.year) {
        info.client = lines[1];
      } else if (!info.client) {
        info.client = lines[1];
      }
    }
    
    // Line 3: Description or additional info
    if (lines[2]) {
      info.description = lines[2];
    }
    
    // Line 4+: Additional metadata (tags, role, etc.)
    if (lines.length > 3) {
      info.additionalInfo = lines.slice(3).join(' | ');
    }
    
    // Store raw lines for future use
    info._rawLines = lines;
    
    return info;
  } catch (err) {
    console.warn(`Warning: Could not parse info.txt in ${projectPath}:`, err.message);
    return null;
  }
}

function scanProjectFolder(projectPath, folderName) {
  const media = [];
  const files = fs.readdirSync(projectPath, { withFileTypes: true });
  
  // Sort files naturally (alphabetically)
  const sortedFiles = files
    .filter(f => f.isFile())
    .map(f => f.name)
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
  
  for (const filename of sortedFiles) {
    // Skip meta.json, info.txt and other config files
    if (filename === 'meta.json' || filename === 'info.txt' || filename.startsWith('.')) continue;
    
    const fileType = getFileType(filename);
    if (!fileType) continue;
    
    media.push({
      id: path.parse(filename).name,
      type: fileType,
      src: filename,
      _resolvedSrc: `/projects/${folderName}/${filename}`
    });
  }
  
  return media;
}

function generateProjectMetadata(folderName, media, infoTxt = null) {
  // Determine category based on media types
  const hasImages = media.some(m => m.type === 'image');
  const hasVideos = media.some(m => m.type === 'video');
  const has3D = media.some(m => m.type === '3d-model');
  
  let category = 'experimental';
  if (has3D) category = '3d-render';
  else if (hasVideos && !hasImages) category = 'video-editing';
  else if (hasImages && !hasVideos) category = 'photography';
  else if (hasImages && hasVideos) category = 'vfx';
  
  // Generate title from folder name (capitalize and replace dashes/underscores)
  const title = folderName
    .split(/[-_]/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
  
  const project = {
    id: folderName,
    title: title,
    category: category,
    description: `Auto-generated project from ${folderName} folder`,
    media: media
  };
  
  // Merge info.txt data if available
  if (infoTxt) {
    if (infoTxt.year) project.year = infoTxt.year;
    if (infoTxt.client) project.client = infoTxt.client;
    if (infoTxt.description) project.description = infoTxt.description;
    if (infoTxt.additionalInfo) project.additionalInfo = infoTxt.additionalInfo;
    if (infoTxt._rawLines) project._infoLines = infoTxt._rawLines;
  }
  
  return project;
}

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
    
    // Skip hidden directories
    if (entry.name.startsWith('.')) continue;
    
    const projectPath = path.join(PROJECTS_DIR, entry.name);
    const metaPath = path.join(projectPath, 'meta.json');
    const infoTxt = parseInfoTxt(projectPath);
    
    let project;
    
    // If meta.json exists, use it (but still scan for media if not provided)
    if (fs.existsSync(metaPath)) {
      try {
        const metaContent = fs.readFileSync(metaPath, 'utf-8');
        project = JSON.parse(metaContent);
        
        // If media is not provided in meta.json, scan folder
        if (!project.media || project.media.length === 0) {
          project.media = scanProjectFolder(projectPath, entry.name);
        }
        
        // Merge info.txt data if available (info.txt overrides meta.json for these fields)
        if (infoTxt) {
          if (infoTxt.year && !project.year) project.year = infoTxt.year;
          if (infoTxt.client) project.client = infoTxt.client;
          if (infoTxt.description && !project.description) project.description = infoTxt.description;
          if (infoTxt.additionalInfo) project.additionalInfo = infoTxt.additionalInfo;
          if (infoTxt._rawLines) project._infoLines = infoTxt._rawLines;
        }
      } catch (err) {
        console.error(`Error parsing ${metaPath}:`, err.message);
        // Fall through to auto-discovery
        project = null;
      }
    }
    
    // Auto-discover if no meta.json or parsing failed
    if (!project) {
      const media = scanProjectFolder(projectPath, entry.name);
      
      // Skip folders with no recognized media files
      if (media.length === 0) {
        console.log(`Skipping ${entry.name}: no recognized media files found`);
        continue;
      }
      
      project = generateProjectMetadata(entry.name, media, infoTxt);
      const infoNote = infoTxt ? ' (with info.txt)' : '';
      console.log(`Auto-discovered project: ${project.title} (${media.length} media files)${infoNote}`);
    } else {
      console.log(`Found project: ${project.title || entry.name}`);
    }
    
    // Add folder path info
    project._folder = entry.name;
    project._basePath = `/projects/${entry.name}`;
    
    // Resolve media paths (if not already resolved)
    if (project.media) {
      project.media = project.media.map(item => {
        if (item._resolvedSrc) return item;
        
        return {
          ...item,
          _resolvedSrc: Array.isArray(item.src)
            ? item.src.map(s => `/projects/${entry.name}/${s}`)
            : `/projects/${entry.name}/${item.src}`
        };
      });
    }
    
    projects.push(project);
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
