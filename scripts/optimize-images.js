/**
 * Image Optimization Script
 * Processes images from /public/projects/ and creates optimized versions
 * - Copies projects folder to preserve originals
 * - Creates desktop (~2000px) and mobile (~1200px) versions
 * - Converts PNG to JPG/WebP for better compression
 * - Skips videos (handled separately)
 */

import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SOURCE_PROJECTS_DIR = path.resolve(__dirname, '../public/projects');
const OPTIMIZED_PROJECTS_DIR = path.resolve(__dirname, '../public/projects-optimized');

// Image file extensions to process
const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tiff', '.tif'];
const VIDEO_EXTENSIONS = ['.mp4', '.webm', '.ogg', '.mov', '.avi', '.mkv', '.m4v'];
const MODEL_3D_EXTENSIONS = ['.gltf', '.glb', '.obj', '.fbx', '.dae', '.3ds'];

// Optimization settings
const DESKTOP_MAX_WIDTH = 2000;
const MOBILE_MAX_WIDTH = 1200;
const DESKTOP_QUALITY = 90; // High quality for desktop
const MOBILE_QUALITY = 85; // Slightly lower for mobile (still high quality)

function isImageFile(filename) {
  const ext = path.extname(filename).toLowerCase();
  return IMAGE_EXTENSIONS.includes(ext);
}

function isVideoFile(filename) {
  const ext = path.extname(filename).toLowerCase();
  return VIDEO_EXTENSIONS.includes(ext);
}

function is3DModelFile(filename) {
  const ext = path.extname(filename).toLowerCase();
  return MODEL_3D_EXTENSIONS.includes(ext);
}

function shouldConvertToJpg(filename) {
  const ext = path.extname(filename).toLowerCase();
  // Convert PNG, BMP, TIFF to JPG for better compression
  // Keep JPG, WebP as-is (or convert to WebP if needed)
  return ['.png', '.bmp', '.tiff', '.tif'].includes(ext);
}

async function optimizeImage(inputPath, outputDir, filename) {
  const ext = path.extname(filename).toLowerCase();
  const baseName = path.parse(filename).name;
  const shouldConvert = shouldConvertToJpg(filename);
  const outputExt = shouldConvert ? '.jpg' : ext;
  
  // Create desktop version
  const desktopFilename = `${baseName}${outputExt}`;
  const desktopPath = path.join(outputDir, desktopFilename);
  
  // Create mobile version
  const mobileFilename = `${baseName}_mobile${outputExt}`;
  const mobilePath = path.join(outputDir, mobileFilename);
  
  try {
    // Get image metadata
    const metadata = await sharp(inputPath).metadata();
    const { width, height } = metadata;
    
    // Determine the long side (width or height) - this is what we'll use to fit
    const longSide = Math.max(width, height);
    
    // Determine if we need to resize based on long side
    const needsDesktopResize = longSide > DESKTOP_MAX_WIDTH;
    const needsMobileResize = longSide > MOBILE_MAX_WIDTH;
    
    // Process desktop version
    let desktopProcessor = sharp(inputPath);
    if (needsDesktopResize) {
      // Resize using long side to fit, maintaining aspect ratio
      // fit: 'inside' ensures the image fits within the box while maintaining aspect ratio
      // Setting both dimensions to the max ensures the long side is constrained
      desktopProcessor = desktopProcessor.resize(DESKTOP_MAX_WIDTH, DESKTOP_MAX_WIDTH, {
        withoutEnlargement: true,
        fit: 'inside' // Maintains aspect ratio, fits inside the box
      });
    }
    
    if (shouldConvert) {
      desktopProcessor = desktopProcessor.jpeg({ quality: DESKTOP_QUALITY, mozjpeg: true });
    } else if (ext === '.png') {
      desktopProcessor = desktopProcessor.png({ quality: DESKTOP_QUALITY, compressionLevel: 9 });
    } else if (ext === '.webp') {
      desktopProcessor = desktopProcessor.webp({ quality: DESKTOP_QUALITY });
    }
    
    await desktopProcessor.toFile(desktopPath);
    
    // Process mobile version (only if significantly different from desktop)
    if (needsMobileResize && longSide > MOBILE_MAX_WIDTH) {
      let mobileProcessor = sharp(inputPath);
      // Resize using long side to fit, maintaining aspect ratio
      mobileProcessor = mobileProcessor.resize(MOBILE_MAX_WIDTH, MOBILE_MAX_WIDTH, {
        withoutEnlargement: true,
        fit: 'inside' // Maintains aspect ratio, fits inside the box
      });
      
      if (shouldConvert) {
        mobileProcessor = mobileProcessor.jpeg({ quality: MOBILE_QUALITY, mozjpeg: true });
      } else if (ext === '.png') {
        mobileProcessor = mobileProcessor.png({ quality: MOBILE_QUALITY, compressionLevel: 9 });
      } else if (ext === '.webp') {
        mobileProcessor = mobileProcessor.webp({ quality: MOBILE_QUALITY });
      }
      
      await mobileProcessor.toFile(mobilePath);
    } else {
      // If image is already small enough, just copy desktop version as mobile
      fs.copyFileSync(desktopPath, mobilePath);
    }
    
    const desktopStats = fs.statSync(desktopPath);
    const mobileStats = fs.existsSync(mobilePath) ? fs.statSync(mobilePath) : null;
    const originalStats = fs.statSync(inputPath);
    
    return {
      desktop: desktopFilename,
      mobile: mobileFilename,
      originalSize: originalStats.size,
      desktopSize: desktopStats.size,
      mobileSize: mobileStats?.size || desktopStats.size,
      width: metadata.width,
      height: metadata.height
    };
  } catch (error) {
    console.error(`Error optimizing ${filename}:`, error.message);
    // Fallback: just copy the original file
    const fallbackPath = path.join(outputDir, filename);
    fs.copyFileSync(inputPath, fallbackPath);
    return {
      desktop: filename,
      mobile: filename,
      originalSize: fs.statSync(inputPath).size,
      desktopSize: fs.statSync(fallbackPath).size,
      mobileSize: fs.statSync(fallbackPath).size,
      error: error.message
    };
  }
}

async function processProjectFolder(sourcePath, projectName, outputPath) {
  // Create output directory
  if (!fs.existsSync(outputPath)) {
    fs.mkdirSync(outputPath, { recursive: true });
  }
  
  const files = fs.readdirSync(sourcePath, { withFileTypes: true });
  const stats = {
    images: 0,
    videos: 0,
    models: 0,
    other: 0,
    totalSaved: 0
  };
  
  for (const file of files) {
    if (file.isDirectory()) continue;
    if (file.name.startsWith('.')) continue;
    if (file.name === 'meta.json' || file.name === 'info.txt') {
      // Copy config files as-is
      fs.copyFileSync(
        path.join(sourcePath, file.name),
        path.join(outputPath, file.name)
      );
      continue;
    }
    
    if (isImageFile(file.name)) {
      console.log(`  Optimizing image: ${file.name}`);
      const result = await optimizeImage(
        path.join(sourcePath, file.name),
        outputPath,
        file.name
      );
      stats.images++;
      const saved = result.originalSize - result.desktopSize;
      if (saved > 0) {
        stats.totalSaved += saved;
        const savedMB = (saved / 1024 / 1024).toFixed(2);
        const reduction = ((saved / result.originalSize) * 100).toFixed(1);
        console.log(`    ✓ Desktop: ${(result.desktopSize / 1024 / 1024).toFixed(2)}MB (saved ${savedMB}MB, ${reduction}%)`);
      }
    } else if (isVideoFile(file.name)) {
      // Copy videos as-is (user handles compression separately)
      fs.copyFileSync(
        path.join(sourcePath, file.name),
        path.join(outputPath, file.name)
      );
      stats.videos++;
      console.log(`  Copied video: ${file.name} (not optimized)`);
    } else if (is3DModelFile(file.name)) {
      // Copy 3D models as-is
      fs.copyFileSync(
        path.join(sourcePath, file.name),
        path.join(outputPath, file.name)
      );
      stats.models++;
      console.log(`  Copied 3D model: ${file.name}`);
    } else {
      // Copy other files as-is
      fs.copyFileSync(
        path.join(sourcePath, file.name),
        path.join(outputPath, file.name)
      );
      stats.other++;
      console.log(`  Copied other file: ${file.name}`);
    }
  }
  
  return stats;
}

async function optimizeProjects() {
  console.log('Starting image optimization...\n');
  
  // Check if source directory exists
  if (!fs.existsSync(SOURCE_PROJECTS_DIR)) {
    console.log('No projects directory found. Skipping optimization.');
    return;
  }
  
  // Create a backup of original projects (only images, keep structure)
  const BACKUP_DIR = path.resolve(__dirname, '../public/projects-original');
  if (!fs.existsSync(BACKUP_DIR)) {
    console.log('Creating backup of original projects...');
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    
    // Copy only the structure and non-image files to backup
    const entries = fs.readdirSync(SOURCE_PROJECTS_DIR, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.startsWith('.')) {
        const sourcePath = path.join(SOURCE_PROJECTS_DIR, entry.name);
        const backupPath = path.join(BACKUP_DIR, entry.name);
        fs.mkdirSync(backupPath, { recursive: true });
        
        // Copy all files to backup (we'll restore originals if needed)
        const files = fs.readdirSync(sourcePath);
        for (const file of files) {
          if (!fs.statSync(path.join(sourcePath, file)).isDirectory()) {
            fs.copyFileSync(
              path.join(sourcePath, file),
              path.join(backupPath, file)
            );
          }
        }
      }
    }
    console.log('Backup created.\n');
  }
  
  // Remove old optimized directory if it exists
  if (fs.existsSync(OPTIMIZED_PROJECTS_DIR)) {
    console.log('Removing old optimized projects...');
    fs.rmSync(OPTIMIZED_PROJECTS_DIR, { recursive: true, force: true });
  }
  
  // Create optimized directory
  fs.mkdirSync(OPTIMIZED_PROJECTS_DIR, { recursive: true });
  
  // Process each project folder
  const entries = fs.readdirSync(SOURCE_PROJECTS_DIR, { withFileTypes: true });
  const totalStats = {
    images: 0,
    videos: 0,
    models: 0,
    other: 0,
    totalSaved: 0
  };
  
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith('.')) continue;
    
    console.log(`Processing project: ${entry.name}`);
    const sourcePath = path.join(SOURCE_PROJECTS_DIR, entry.name);
    const outputPath = path.join(OPTIMIZED_PROJECTS_DIR, entry.name);
    
    const stats = await processProjectFolder(sourcePath, entry.name, outputPath);
    
    totalStats.images += stats.images;
    totalStats.videos += stats.videos;
    totalStats.models += stats.models;
    totalStats.other += stats.other;
    totalStats.totalSaved += stats.totalSaved;
    
    console.log(`  ✓ Processed: ${stats.images} images, ${stats.videos} videos, ${stats.models} models\n`);
  }
  
  // Copy optimized folder to projects folder (for build)
  // This way paths stay the same (/projects/...)
  console.log('Copying optimized projects to projects folder for build...');
  if (fs.existsSync(SOURCE_PROJECTS_DIR)) {
    // Remove existing projects folder
    fs.rmSync(SOURCE_PROJECTS_DIR, { recursive: true, force: true });
  }
  // Copy optimized to projects
  fs.cpSync(OPTIMIZED_PROJECTS_DIR, SOURCE_PROJECTS_DIR, { recursive: true });
  
  console.log('\n=== Optimization Summary ===');
  console.log(`Total images optimized: ${totalStats.images}`);
  console.log(`Total videos copied: ${totalStats.videos}`);
  console.log(`Total 3D models copied: ${totalStats.models}`);
  console.log(`Total space saved: ${(totalStats.totalSaved / 1024 / 1024).toFixed(2)}MB`);
  console.log(`\nOriginal projects backed up to: ${BACKUP_DIR}`);
  console.log(`Optimized projects in: ${SOURCE_PROJECTS_DIR}`);
}

optimizeProjects().catch(error => {
  console.error('Error during optimization:', error);
  process.exit(1);
});
