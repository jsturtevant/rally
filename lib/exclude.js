import { readFileSync, writeFileSync, mkdirSync, existsSync, renameSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';

const RALLY_HEADER = '# Rally — Squad symlinks';

export function getExcludeEntries() {
  return [
    '.squad',
    '.squad/',
    '.squad-templates',
    '.squad-templates/',
    '.github/agents/squad.agent.md'
  ];
}

export function addExcludes(gitDir, entries) {
  const excludePath = join(gitDir, 'info', 'exclude');
  const infoDir = join(gitDir, 'info');
  
  if (!existsSync(infoDir)) {
    mkdirSync(infoDir, { recursive: true });
  }
  
  let content = '';
  if (existsSync(excludePath)) {
    content = readFileSync(excludePath, 'utf8');
  }
  
  const lines = content.split('\n');
  const entriesToAdd = [];
  
  for (const entry of entries) {
    if (!lines.includes(entry)) {
      entriesToAdd.push(entry);
    }
  }
  
  if (entriesToAdd.length === 0) {
    return;
  }
  
  if (!content.includes(RALLY_HEADER)) {
    if (content && !content.endsWith('\n')) {
      content += '\n';
    }
    content += `${RALLY_HEADER}\n`;
  }
  
  for (const entry of entriesToAdd) {
    content += `${entry}\n`;
  }
  
  const dir = dirname(excludePath);
  const base = basename(excludePath);
  const tmp = join(dir, `.${base}.${process.pid}.${Date.now()}.tmp`);
  writeFileSync(tmp, content, 'utf8');
  renameSync(tmp, excludePath);
}

// Planned for offboard command
export function removeExcludes(gitDir, entries) {
  const excludePath = join(gitDir, 'info', 'exclude');
  
  if (!existsSync(excludePath)) {
    return;
  }
  
  let content = readFileSync(excludePath, 'utf8');
  let lines = content.split('\n');
  
  lines = lines.filter(line => {
    if (line === RALLY_HEADER) {
      return false;
    }
    return !entries.includes(line);
  });
  
  content = lines.join('\n');
  writeFileSync(excludePath, content, 'utf8');
}

// Planned for offboard command
export function hasExcludes(gitDir, entries) {
  const excludePath = join(gitDir, 'info', 'exclude');
  
  if (!existsSync(excludePath)) {
    return false;
  }
  
  const content = readFileSync(excludePath, 'utf8');
  const lines = content.split('\n');
  
  for (const entry of entries) {
    if (!lines.includes(entry)) {
      return false;
    }
  }
  
  return true;
}
