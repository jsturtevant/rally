#!/usr/bin/env node
/**
 * Visual Documentation Generator
 * 
 * Generates markdown documentation from E2E journey tests.
 * Each E2E test creates baseline screenshots; this script generates
 * markdown documentation that shows the user journey step-by-step.
 * 
 * Usage: node scripts/generate-docs.js
 * 
 * Test files should have metadata comments:
 *   // @step 1: Open the Dashboard
 *   // @command: rally dashboard
 *   await term.screenshot('test/baselines/dispatch-issue/01-dashboard.png');
 */

import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'node:fs';
import { join, basename, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');
const JOURNEYS_DIR = join(REPO_ROOT, 'test', 'e2e', 'journeys');
const BASELINES_DIR = join(REPO_ROOT, 'test', 'baselines');
const OUTPUT_DIR = join(REPO_ROOT, 'docs', 'journeys');

/**
 * Convert kebab-case or snake_case to Title Case
 */
function toTitleCase(str) {
  return str
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * Parse @step and @command comments from a test file
 */
function parseStepComments(content) {
  const steps = [];
  const lines = content.split('\n');
  
  let currentStep = null;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Match @step comments: // @step 1: Description
    const stepMatch = line.match(/\/\/\s*@step\s+(\d+):\s*(.+)/i);
    if (stepMatch) {
      currentStep = {
        number: parseInt(stepMatch[1], 10),
        description: stepMatch[2].trim(),
        command: null,
        screenshot: null,
        lineNumber: i + 1,
      };
      continue;
    }
    
    // Match @command comments: // @command: rally dashboard
    const commandMatch = line.match(/\/\/\s*@command:\s*(.+)/i);
    if (commandMatch && currentStep) {
      currentStep.command = commandMatch[1].trim();
      continue;
    }
    
    // Match screenshot calls
    const screenshotMatch = line.match(/screenshot\s*\(\s*(?:path\.join\s*\([^)]+,\s*)?['"`]([^'"`]+\.png)['"`]/);
    if (screenshotMatch) {
      if (currentStep) {
        currentStep.screenshot = screenshotMatch[1];
        steps.push(currentStep);
        currentStep = null;
      }
    }
  }
  
  return steps;
}

/**
 * Parse test file header comments for journey description
 */
function parseJourneyDescription(content) {
  const match = content.match(/\/\*\*\s*\n\s*\*\s*E2E\s+(?:Journey\s+)?Test:\s*([^\n]+)\s*\n([\s\S]*?)\*\//);
  if (match) {
    const title = match[1].trim();
    // Extract description lines (lines starting with * but not @)
    const descLines = match[2]
      .split('\n')
      .filter(line => line.match(/^\s*\*/))
      .map(line => line.replace(/^\s*\*\s*/, '').trim())
      .filter(line => line && !line.startsWith('@'));
    
    return {
      title,
      description: descLines.join('\n'),
    };
  }
  return { title: null, description: null };
}

/**
 * Find all screenshots in a baseline directory
 */
function findScreenshots(baselineDir) {
  if (!existsSync(baselineDir)) {
    return [];
  }
  
  const screenshots = [];
  
  function scanDir(dir, prefix = '') {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        scanDir(fullPath, join(prefix, entry.name));
      } else if (entry.name.endsWith('.png')) {
        screenshots.push({
          path: fullPath,
          relativePath: join(prefix, entry.name),
          name: entry.name,
        });
      }
    }
  }
  
  scanDir(baselineDir);
  return screenshots.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Generate markdown for a single journey test file
 */
function generateJourneyMarkdown(testFile, category) {
  const content = readFileSync(testFile, 'utf8');
  const testName = basename(testFile, '.test.js');
  const { title, description } = parseJourneyDescription(content);
  const steps = parseStepComments(content);
  
  // Determine baseline directory name
  const baselineDirName = `${category}-${testName}`;
  const baselineDir = join(BASELINES_DIR, baselineDirName);
  const screenshots = findScreenshots(baselineDir);
  
  // Also check category subdirectory in baselines
  const altBaselineDir = join(BASELINES_DIR, category, testName);
  const altScreenshots = findScreenshots(altBaselineDir);
  
  const allScreenshots = screenshots.length > 0 ? screenshots : altScreenshots;
  const effectiveBaselineDir = screenshots.length > 0 ? baselineDir : altBaselineDir;
  
  // Build markdown
  const lines = [];
  
  // Title
  const journeyTitle = title || toTitleCase(`${category} ${testName}`);
  lines.push(`# ${journeyTitle}`);
  lines.push('');
  
  // Description
  if (description) {
    lines.push(description);
    lines.push('');
  }
  
  // If we have parsed @step comments, use them
  if (steps.length > 0) {
    for (const step of steps) {
      lines.push(`## Step ${step.number}: ${step.description}`);
      lines.push('');
      
      if (step.command) {
        lines.push(`Run \`${step.command}\` to proceed.`);
        lines.push('');
      }
      
      if (step.screenshot) {
        const screenshotPath = relative(OUTPUT_DIR, join(REPO_ROOT, 'test', 'baselines', dirname(step.screenshot), basename(step.screenshot)));
        lines.push(`![${step.description}](${screenshotPath})`);
        lines.push('');
      }
    }
  } else if (allScreenshots.length > 0) {
    // Fallback: generate steps from screenshots
    lines.push('## Screenshots');
    lines.push('');
    lines.push('The following screenshots show the visual state at each step:');
    lines.push('');
    
    for (let i = 0; i < allScreenshots.length; i++) {
      const ss = allScreenshots[i];
      const stepName = ss.name
        .replace(/^\d+-/, '')
        .replace(/\.png$/, '')
        .replace(/[-_]/g, ' ');
      
      const relPath = relative(OUTPUT_DIR, ss.path);
      lines.push(`### ${toTitleCase(stepName)}`);
      lines.push('');
      lines.push(`![${toTitleCase(stepName)}](${relPath})`);
      lines.push('');
    }
  } else {
    lines.push('*No screenshots available yet. Run the E2E tests to generate baseline images.*');
    lines.push('');
  }
  
  // Footer with source reference
  lines.push('---');
  lines.push('');
  const relTestPath = relative(REPO_ROOT, testFile);
  lines.push(`*Generated from [\`${relTestPath}\`](../../${relTestPath})*`);
  lines.push('');
  
  return lines.join('\n');
}

/**
 * Discover all journey test files
 */
function discoverJourneys() {
  const journeys = [];
  
  if (!existsSync(JOURNEYS_DIR)) {
    console.log(`No journeys directory found at ${JOURNEYS_DIR}`);
    return journeys;
  }
  
  const categories = readdirSync(JOURNEYS_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);
  
  for (const category of categories) {
    const categoryDir = join(JOURNEYS_DIR, category);
    const testFiles = readdirSync(categoryDir)
      .filter(f => f.endsWith('.test.js'))
      .map(f => join(categoryDir, f));
    
    for (const testFile of testFiles) {
      journeys.push({
        category,
        testFile,
        name: basename(testFile, '.test.js'),
      });
    }
  }
  
  return journeys;
}

/**
 * Generate index.md listing all journeys
 */
function generateIndex(journeys) {
  const lines = [];
  
  lines.push('# Rally User Journey Documentation');
  lines.push('');
  lines.push('This documentation is auto-generated from E2E journey tests.');
  lines.push('Each guide shows step-by-step screenshots of Rally\'s terminal UI.');
  lines.push('');
  lines.push('## Journeys');
  lines.push('');
  
  // Group by category
  const byCategory = {};
  for (const j of journeys) {
    if (!byCategory[j.category]) {
      byCategory[j.category] = [];
    }
    byCategory[j.category].push(j);
  }
  
  for (const category of Object.keys(byCategory).sort()) {
    lines.push(`### ${toTitleCase(category)}`);
    lines.push('');
    
    for (const j of byCategory[category]) {
      const docFile = `${category}-${j.name}.md`;
      lines.push(`- [${toTitleCase(j.name)}](./${docFile})`);
    }
    lines.push('');
  }
  
  lines.push('---');
  lines.push('');
  lines.push('*To regenerate this documentation, run: `npm run docs:generate`*');
  lines.push('');
  
  return lines.join('\n');
}

/**
 * Main entry point
 */
function main() {
  console.log('📚 Generating visual documentation from E2E journey tests...\n');
  
  // Ensure output directory exists
  mkdirSync(OUTPUT_DIR, { recursive: true });
  
  // Discover all journey tests
  const journeys = discoverJourneys();
  
  if (journeys.length === 0) {
    console.log('No journey tests found in test/e2e/journeys/');
    return;
  }
  
  console.log(`Found ${journeys.length} journey test(s):\n`);
  
  // Generate markdown for each journey
  for (const journey of journeys) {
    const markdown = generateJourneyMarkdown(journey.testFile, journey.category);
    const outputFile = join(OUTPUT_DIR, `${journey.category}-${journey.name}.md`);
    
    writeFileSync(outputFile, markdown, 'utf8');
    console.log(`  ✓ ${journey.category}/${journey.name} → ${relative(REPO_ROOT, outputFile)}`);
  }
  
  // Generate index
  const indexMarkdown = generateIndex(journeys);
  const indexFile = join(OUTPUT_DIR, 'index.md');
  writeFileSync(indexFile, indexMarkdown, 'utf8');
  console.log(`\n  ✓ Index → ${relative(REPO_ROOT, indexFile)}`);
  
  console.log('\n✅ Documentation generated successfully!');
  console.log(`   Output: ${relative(REPO_ROOT, OUTPUT_DIR)}/`);
}

main();
