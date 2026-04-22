#!/usr/bin/env node
/**
 * Lightweight secret scanner for pre-commit/CI hygiene.
 * - Scans text files in the repo for common secret patterns.
 * - Skips obvious non-source directories.
 * - Exits non-zero on finding matches.
 */

import fs from 'node:fs';
import path from 'node:path';

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();

const ignoreDirs = new Set([
  '.git',
  'node_modules',
  'dist',
  'tmp',
  '.openclaw',
  '.vite',
  '.cache',
]);

const textExtensions = new Set([
  '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs', '.json', '.yaml', '.yml', '.toml', '.ini', '.env', '.example',
  '.md', '.txt', '.html', '.css', '.scss', '.sass', '.less', '.vue', '.svelte', '.sql', '.sh', '.bash', '.zsh', '.py',
  '.rb', '.go', '.java', '.kt', '.kts', '.swift', '.php', '.cs', '.c', '.cpp', '.h', '.hpp', '.rs', '.dockerfile'
]);

const binaryExt = new Set(['.png','.jpg','.jpeg','.gif','.webp','.ico','.woff','.woff2','.ttf','.otf','.eot','.svg','.mp4','.mov','.mp3','.pdf','.zip','.gz','.tgz','.tar','.bz2','.7z']);

const patterns = [
  { name: 'GitHub PAT', re: /gh[pousr]_[A-Za-z0-9_]{20,}/g },
  { name: 'OpenAI API', re: /sk-[A-Za-z0-9]{20,}/g },
  { name: 'Google API', re: /AIzaSy[A-Za-z0-9_-]{35}/g },
  { name: 'AWS Access Key', re: /AKIA[0-9A-Z]{16}/g },
  { name: 'Slack Token', re: /xox[baprs]-[0-9A-Za-z-]{10,}/g },
  { name: 'Discord Webhook', re: /discord\.com\/api\/webhooks\/\d+\/[A-Za-z0-9_-]+/gi },
  { name: 'Private Key Header', re: /-----BEGIN (?:RSA|OPENSSH|EC|DSA|ENCRYPTED) PRIVATE KEY-----/g },
  { name: 'JWT-like Secret', re: /ey[a-zA-Z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g },
];

// Permit placeholders in environment templates.
const allowedPlaceholderValues = [
  /replace_with_/i,
  /your-?example\./i,
  /example\.com/i,
  /dummy/,
  /placeholder/i,
];

function shouldIgnoreFile(filePath) {
  const base = path.basename(filePath);
  const ext = path.extname(filePath).toLowerCase();

  if (binaryExt.has(ext)) return true;
  if (base === '.env.example') return true;
  if (base === '.gitkeep') return true;

  if (ext) return !textExtensions.has(ext) && !base.includes('.');
  return false;
}

function scanDir(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const findings = [];

  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (ignoreDirs.has(entry.name)) continue;
    if (entry.isDirectory()) {
      findings.push(...scanDir(full));
      continue;
    }

    if (shouldIgnoreFile(full)) continue;

    let content;
    try {
      content = fs.readFileSync(full, 'utf8');
    } catch {
      continue;
    }

    const lines = content.split(/\r?\n/);

    for (const rule of patterns) {
      let match;
      rule.re.lastIndex = 0;
      while ((match = rule.re.exec(content)) !== null) {
        const absoluteOffset = match.index;
        let line = 1;
        let col = 1;

        for (let i = 0; i < absoluteOffset; i++) {
          if (content[i] === '\n') {
            line += 1;
            col = 1;
          } else {
            col += 1;
          }
        }

        const lineText = lines[Math.min(line - 1, lines.length - 1)] || '';

        const allowed = allowedPlaceholderValues.some((rx) => rx.test(lineText));
        if (allowed) continue;

        findings.push({
          path: path.relative(root, full),
          line,
          col,
          kind: rule.name,
          value: match[0],
          lineText: lineText.trim(),
        });
      }
    }
  }

  return findings;
}

const findings = scanDir(root);

if (findings.length === 0) {
  console.log('✅ Secret scan clean.');
  process.exit(0);
}

console.log('❌ Secret scan found potential secrets:');
for (const f of findings) {
  console.log(`- ${f.path}:${f.line}:${f.col} ${f.kind}: ${f.value}`);
  console.log(`  ${f.lineText}`);
}
console.log(`\nTotal findings: ${findings.length}`);
process.exit(1);
