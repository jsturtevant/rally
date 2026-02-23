/**
 * Pre-compile all .jsx files to .js so tests run without the --loader hook.
 * Eliminates per-child-process esbuild re-initialization overhead.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { transformSync } from 'esbuild';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const jsxFiles = [
  'lib/ui/Dashboard.jsx',
  'lib/ui/components/ActionMenu.jsx',
  'lib/ui/components/StatusMessage.jsx',
  'lib/ui/components/DispatchBox.jsx',
  'lib/ui/components/DispatchTable.jsx',
];

for (const rel of jsxFiles) {
  const file = join(root, rel);
  const source = readFileSync(file, 'utf8');
  const { code } = transformSync(source, {
    loader: 'jsx',
    format: 'esm',
    jsx: 'transform',
    jsxFactory: 'React.createElement',
    jsxFragment: 'React.Fragment',
  });
  // Rewrite .jsx import specifiers to .js in compiled output
  const output = code.replace(/(from\s+['"])([^'"]+)\.jsx(['"])/g, '$1$2.js$3');
  writeFileSync(file.replace(/\.jsx$/, '.js'), output);
}
