/**
 * Restore Original Projects Script
 * Restores the original (unoptimized) projects from backup
 * Use this if you need to restore original images after optimization
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BACKUP_DIR = path.resolve(__dirname, '../public/projects-original');
const PROJECTS_DIR = path.resolve(__dirname, '../public/projects');

function restoreOriginals() {
  console.log('Restoring original projects...\n');
  
  if (!fs.existsSync(BACKUP_DIR)) {
    console.log('No backup found. Nothing to restore.');
    return;
  }
  
  if (fs.existsSync(PROJECTS_DIR)) {
    console.log('Removing optimized projects...');
    fs.rmSync(PROJECTS_DIR, { recursive: true, force: true });
  }
  
  console.log('Copying original projects from backup...');
  fs.cpSync(BACKUP_DIR, PROJECTS_DIR, { recursive: true });
  
  console.log('\n✓ Original projects restored successfully!');
  console.log(`Projects folder: ${PROJECTS_DIR}`);
}

restoreOriginals();
