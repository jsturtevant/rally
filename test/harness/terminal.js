/**
 * PTY Test Harness - E2E testing infrastructure for terminal applications
 * 
 * Spawns CLI processes in pseudo-terminals with controlled dimensions,
 * renders output via xterm-headless, and captures screenshots.
 */

import pty from 'node-pty';
import xterm from '@xterm/headless';
const { Terminal } = xterm;
import { createCanvas } from 'canvas';
import fs from 'fs';
import path from 'path';

// Key codes for special keys
const KEY_CODES = {
  enter: '\r',
  escape: '\x1b',
  up: '\x1b[A',
  down: '\x1b[B',
  left: '\x1b[D',
  right: '\x1b[C',
  tab: '\t',
  backspace: '\x7f',
  space: ' ',
  delete: '\x1b[3~',
  home: '\x1b[H',
  end: '\x1b[F',
};

// Ctrl key combinations
function ctrlKey(char) {
  const code = char.toUpperCase().charCodeAt(0);
  return String.fromCharCode(code - 64);
}

/**
 * Parse a key specification like 'ctrl+c' or 'enter'
 */
function parseKey(keySpec) {
  const lower = keySpec.toLowerCase();
  
  // Handle ctrl+X combinations
  if (lower.startsWith('ctrl+')) {
    const char = lower.slice(5);
    if (char.length === 1) {
      return ctrlKey(char);
    }
    throw new Error(`Invalid ctrl combination: ${keySpec}`);
  }
  
  // Handle named keys
  if (KEY_CODES[lower]) {
    return KEY_CODES[lower];
  }
  
  throw new Error(`Unknown key: ${keySpec}`);
}

/**
 * Terminal rendering configuration for screenshots
 */
const FONT_CONFIG = {
  family: 'monospace',
  size: 14,
  lineHeight: 1.2,
  charWidth: 8.4,  // Approximate width for 14px monospace
  charHeight: 17,  // lineHeight * size
};

const COLORS = {
  background: '#1e1e1e',
  foreground: '#d4d4d4',
  cursor: '#ffffff',
  // ANSI colors
  0: '#000000', 1: '#cd3131', 2: '#0dbc79', 3: '#e5e510',
  4: '#2472c8', 5: '#bc3fbc', 6: '#11a8cd', 7: '#e5e5e5',
  8: '#666666', 9: '#f14c4c', 10: '#23d18b', 11: '#f5f543',
  12: '#3b8eea', 13: '#d670d6', 14: '#29b8db', 15: '#ffffff',
};

/**
 * Track active terminals for cleanup
 */
const activeTerminals = new Set();

/**
 * Clean up all active terminals (call on test failure/exit)
 */
export function cleanupAll() {
  for (const term of activeTerminals) {
    try {
      term.close();
    } catch {
      // Ignore errors during cleanup
    }
  }
  activeTerminals.clear();
}

// Ensure cleanup on process exit
process.on('exit', cleanupAll);
process.on('SIGINT', () => { cleanupAll(); process.exit(130); });
process.on('SIGTERM', () => { cleanupAll(); process.exit(143); });

/**
 * Spawn a CLI in a PTY with controlled dimensions
 * 
 * @param {string} command - Command to run (e.g., 'rally dashboard')
 * @param {Object} options - Spawn options
 * @param {number} [options.cols=120] - Terminal columns
 * @param {number} [options.rows=30] - Terminal rows
 * @param {string} [options.cwd] - Working directory
 * @param {Object} [options.env] - Environment variables (merged with process.env)
 * @returns {Promise<TerminalHandle>}
 */
export async function spawn(command, options = {}) {
  const {
    cols = 120,
    rows = 30,
    cwd = process.cwd(),
    env = {},
  } = options;

  // Parse command into shell and args
  const parts = command.split(/\s+/);
  const shell = parts[0];
  const args = parts.slice(1);

  // Create xterm headless terminal for rendering
  const xterm = new Terminal({ cols, rows, allowProposedApi: true });

  // Spawn the PTY process
  const proc = pty.spawn(shell, args, {
    cols,
    rows,
    cwd,
    env: { ...process.env, ...env, TERM: 'xterm-256color' },
  });

  // Buffer for raw output
  let rawOutput = '';
  let closed = false;

  // Pipe PTY output to xterm
  proc.onData((data) => {
    if (!closed) {
      rawOutput += data;
      xterm.write(data);
    }
  });

  // Create the terminal handle
  const handle = {
    _proc: proc,
    _xterm: xterm,
    _closed: false,
    cols,
    rows,

    /**
     * Send a single character or string
     */
    async send(text) {
      if (this._closed) throw new Error('Terminal is closed');
      this._proc.write(text);
      // Small delay to let the terminal process the input
      await sleep(10);
    },

    /**
     * Send a named key or key combination
     * @param {string} keySpec - Key name like 'enter', 'escape', 'ctrl+c', 'up', etc.
     */
    async sendKey(keySpec) {
      const keyData = parseKey(keySpec);
      await this.send(keyData);
    },

    /**
     * Wait for text to appear in the terminal
     * @param {string|RegExp} pattern - Text or regex to wait for
     * @param {Object} options
     * @param {number} [options.timeout=5000] - Timeout in milliseconds
     * @param {number} [options.pollInterval=50] - Poll interval in milliseconds
     */
    async waitFor(pattern, { timeout = 5000, pollInterval = 50 } = {}) {
      const start = Date.now();
      const regex = typeof pattern === 'string' 
        ? new RegExp(escapeRegex(pattern)) 
        : pattern;

      while (Date.now() - start < timeout) {
        const frame = this.getFrame();
        if (regex.test(frame)) {
          return frame;
        }
        await sleep(pollInterval);
      }

      const frame = this.getFrame();
      throw new Error(
        `Timeout waiting for "${pattern}" after ${timeout}ms.\n` +
        `Current terminal content:\n${frame}`
      );
    },

    /**
     * Get current terminal content as plain text (no ANSI codes)
     * @returns {string} Plain text grid
     */
    getFrame() {
      const lines = [];
      const buffer = this._xterm.buffer.active;
      
      for (let i = 0; i < this.rows; i++) {
        const line = buffer.getLine(i);
        if (line) {
          lines.push(line.translateToString(true));
        } else {
          lines.push('');
        }
      }
      
      return lines.join('\n');
    },

    /**
     * Get raw output (including ANSI codes)
     * @returns {string}
     */
    getRawOutput() {
      return rawOutput;
    },

    /**
     * Capture screenshot to PNG
     * @param {string} filePath - Path to save the PNG
     */
    async screenshot(filePath) {
      const { charWidth, charHeight, size: fontSize, family: fontFamily } = FONT_CONFIG;
      const width = Math.ceil(this.cols * charWidth);
      const height = Math.ceil(this.rows * charHeight);

      const canvas = createCanvas(width, height);
      const ctx = canvas.getContext('2d');

      // Background
      ctx.fillStyle = COLORS.background;
      ctx.fillRect(0, 0, width, height);

      // Set font
      ctx.font = `${fontSize}px ${fontFamily}`;
      ctx.textBaseline = 'top';

      const buffer = this._xterm.buffer.active;

      for (let y = 0; y < this.rows; y++) {
        const line = buffer.getLine(y);
        if (!line) continue;

        for (let x = 0; x < this.cols; x++) {
          const cell = line.getCell(x);
          if (!cell) continue;

          const char = cell.getChars();
          if (!char || char === ' ') continue;

          // Get foreground color
          const fgColor = cell.getFgColor();
          ctx.fillStyle = fgColor !== undefined && COLORS[fgColor] 
            ? COLORS[fgColor] 
            : COLORS.foreground;

          ctx.fillText(char, x * charWidth, y * charHeight);
        }
      }

      // Ensure directory exists
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Write PNG
      const buffer2 = canvas.toBuffer('image/png');
      fs.writeFileSync(filePath, buffer2);
    },

    /**
     * Resize the terminal
     * @param {number} cols
     * @param {number} rows
     */
    resize(cols, rows) {
      this.cols = cols;
      this.rows = rows;
      this._xterm.resize(cols, rows);
      this._proc.resize(cols, rows);
    },

    /**
     * Close the terminal and clean up
     */
    close() {
      if (this._closed) return;
      this._closed = true;
      closed = true;

      try {
        this._proc.kill();
      } catch {
        // Process may already be dead
      }

      try {
        this._xterm.dispose();
      } catch {
        // Ignore disposal errors
      }

      activeTerminals.delete(this);
    },
  };

  activeTerminals.add(handle);

  // Wait a tick for the process to start
  await sleep(50);

  return handle;
}

/**
 * Helper: sleep for ms milliseconds
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Helper: escape string for use in regex
 */
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export default { spawn, cleanupAll };
