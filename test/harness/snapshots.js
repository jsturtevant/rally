/**
 * Snapshot Manager - Visual regression infrastructure for terminal screenshots
 * 
 * Compares PNG screenshots against baselines using pixel-level comparison.
 * Generates visual diff images highlighting mismatched pixels.
 */

import fs from 'fs';
import path from 'path';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

/**
 * SnapshotManager handles visual regression testing for terminal screenshots
 */
export class SnapshotManager {
  /**
   * @param {Object} options
   * @param {string} [options.baselineDir='test/baselines'] - Directory for baseline images
   * @param {string} [options.actualDir='test/actual'] - Directory for actual screenshots
   * @param {string} [options.diffDir='test/diffs'] - Directory for diff images
   * @param {number} [options.threshold=0.005] - Pixel difference tolerance (0-1)
   */
  constructor(options = {}) {
    this.baselineDir = options.baselineDir || 'test/baselines';
    this.actualDir = options.actualDir || 'test/actual';
    this.diffDir = options.diffDir || 'test/diffs';
    this.threshold = options.threshold ?? 0.005;
    
    // Check for --update-snapshots flag
    this.shouldUpdate = process.argv.includes('--update-snapshots');
  }

  /**
   * Ensure a directory exists
   * @param {string} dir
   */
  _ensureDir(dir) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  /**
   * Get path for a snapshot file
   * @param {string} dir - Base directory
   * @param {string} name - Snapshot name
   * @returns {string}
   */
  _getPath(dir, name) {
    return path.join(dir, `${name}.png`);
  }

  /**
   * Read a PNG file and return its data
   * @param {string} filePath
   * @returns {Promise<PNG>}
   */
  _readPNG(filePath) {
    return new Promise((resolve, reject) => {
      const stream = fs.createReadStream(filePath);
      stream.on('error', reject);
      stream.pipe(new PNG())
        .on('parsed', function() {
          resolve(this);
        })
        .on('error', reject);
    });
  }

  /**
   * Parse a PNG buffer
   * @param {Buffer} buffer
   * @returns {Promise<PNG>}
   */
  _parsePNG(buffer) {
    return new Promise((resolve, reject) => {
      new PNG().parse(buffer, (err, data) => {
        if (err) reject(err);
        else resolve(data);
      });
    });
  }

  /**
   * Write a PNG to file
   * @param {PNG} png
   * @param {string} filePath
   * @returns {Promise<void>}
   */
  _writePNG(png, filePath) {
    return new Promise((resolve, reject) => {
      this._ensureDir(path.dirname(filePath));
      const stream = fs.createWriteStream(filePath);
      stream.on('error', reject);
      stream.on('finish', resolve);
      png.pack().pipe(stream);
    });
  }

  /**
   * Compare a screenshot against its baseline
   * 
   * @param {string} name - Snapshot name (without .png extension)
   * @param {Buffer} actualPngBuffer - PNG image buffer to compare
   * @returns {Promise<Object>} Result object
   * @property {boolean} match - Whether the images match within threshold
   * @property {number} diffPixels - Number of different pixels
   * @property {number} diffPercent - Percentage of different pixels
   * @property {string} [diffPath] - Path to diff image (if mismatch)
   * @property {boolean} [newBaseline] - True if this was a new baseline
   */
  async compare(name, actualPngBuffer) {
    const baselinePath = this._getPath(this.baselineDir, name);
    const actualPath = this._getPath(this.actualDir, name);

    // Parse the actual image
    const actual = await this._parsePNG(actualPngBuffer);

    // Save actual screenshot
    this._ensureDir(this.actualDir);
    fs.writeFileSync(actualPath, actualPngBuffer);

    // Check if baseline exists
    if (!fs.existsSync(baselinePath)) {
      // No baseline — save this as the new baseline
      this._ensureDir(this.baselineDir);
      fs.writeFileSync(baselinePath, actualPngBuffer);
      return {
        match: true,
        diffPixels: 0,
        diffPercent: 0,
        newBaseline: true,
      };
    }

    // Read baseline
    const baseline = await this._readPNG(baselinePath);

    // Check dimensions match
    if (actual.width !== baseline.width || actual.height !== baseline.height) {
      const diffPath = this._getPath(this.diffDir, name);
      // Can't generate a proper diff with mismatched sizes
      // Save actual as diff to show what we got
      this._ensureDir(this.diffDir);
      fs.writeFileSync(diffPath, actualPngBuffer);
      
      const totalPixels = Math.max(
        actual.width * actual.height,
        baseline.width * baseline.height
      );
      
      return {
        match: false,
        diffPixels: totalPixels,
        diffPercent: 1.0,
        diffPath,
        error: `Dimension mismatch: baseline ${baseline.width}x${baseline.height}, actual ${actual.width}x${actual.height}`,
      };
    }

    // Create diff image
    const { width, height } = baseline;
    const diff = new PNG({ width, height });

    // Perform pixel comparison
    const diffPixels = pixelmatch(
      baseline.data,
      actual.data,
      diff.data,
      width,
      height,
      {
        threshold: 0.1, // Per-pixel color threshold
        diffColor: [255, 0, 0], // Red for differences
        diffColorAlt: [0, 255, 0], // Green for anti-aliasing differences
        alpha: 0.1,
      }
    );

    const totalPixels = width * height;
    const diffPercent = diffPixels / totalPixels;
    const match = diffPercent <= this.threshold;

    // If --update-snapshots flag is set, auto-bless
    if (!match && this.shouldUpdate) {
      fs.copyFileSync(actualPath, baselinePath);
      return {
        match: true,
        diffPixels,
        diffPercent,
        updated: true,
      };
    }

    // Generate diff image if there's a mismatch
    if (!match) {
      const diffPath = this._getPath(this.diffDir, name);
      await this._writePNG(diff, diffPath);
      
      return {
        match: false,
        diffPixels,
        diffPercent,
        diffPath,
      };
    }

    return {
      match: true,
      diffPixels,
      diffPercent,
    };
  }

  /**
   * Bless a single snapshot (copy actual → baseline)
   * 
   * @param {string} name - Snapshot name (without .png extension)
   * @returns {Promise<void>}
   * @throws {Error} If no actual snapshot exists
   */
  async bless(name) {
    const actualPath = this._getPath(this.actualDir, name);
    const baselinePath = this._getPath(this.baselineDir, name);
    const diffPath = this._getPath(this.diffDir, name);

    if (!fs.existsSync(actualPath)) {
      throw new Error(`No actual snapshot found for "${name}" at ${actualPath}`);
    }

    // Copy actual to baseline
    this._ensureDir(this.baselineDir);
    fs.copyFileSync(actualPath, baselinePath);

    // Remove diff if it exists
    if (fs.existsSync(diffPath)) {
      fs.unlinkSync(diffPath);
    }
  }

  /**
   * Bless all snapshots (copy all actuals → baselines)
   * 
   * @returns {Promise<string[]>} List of blessed snapshot names
   */
  async blessAll() {
    this._ensureDir(this.actualDir);
    
    const files = fs.readdirSync(this.actualDir);
    const pngFiles = files.filter(f => f.endsWith('.png'));
    const blessed = [];

    for (const file of pngFiles) {
      const name = path.basename(file, '.png');
      await this.bless(name);
      blessed.push(name);
    }

    return blessed;
  }

  /**
   * List all snapshots and their status
   * 
   * @returns {Promise<Object[]>} Array of snapshot info objects
   */
  async list() {
    const snapshots = new Map();

    // Gather baselines
    if (fs.existsSync(this.baselineDir)) {
      for (const file of fs.readdirSync(this.baselineDir)) {
        if (file.endsWith('.png')) {
          const name = path.basename(file, '.png');
          snapshots.set(name, { name, hasBaseline: true, hasActual: false, hasDiff: false });
        }
      }
    }

    // Gather actuals
    if (fs.existsSync(this.actualDir)) {
      for (const file of fs.readdirSync(this.actualDir)) {
        if (file.endsWith('.png')) {
          const name = path.basename(file, '.png');
          const existing = snapshots.get(name) || { name, hasBaseline: false, hasActual: false, hasDiff: false };
          existing.hasActual = true;
          snapshots.set(name, existing);
        }
      }
    }

    // Gather diffs
    if (fs.existsSync(this.diffDir)) {
      for (const file of fs.readdirSync(this.diffDir)) {
        if (file.endsWith('.png')) {
          const name = path.basename(file, '.png');
          const existing = snapshots.get(name) || { name, hasBaseline: false, hasActual: false, hasDiff: false };
          existing.hasDiff = true;
          snapshots.set(name, existing);
        }
      }
    }

    return Array.from(snapshots.values());
  }

  /**
   * Clean up actual and diff directories
   * 
   * @returns {Promise<void>}
   */
  async clean() {
    for (const dir of [this.actualDir, this.diffDir]) {
      if (fs.existsSync(dir)) {
        const files = fs.readdirSync(dir);
        for (const file of files) {
          if (file.endsWith('.png')) {
            fs.unlinkSync(path.join(dir, file));
          }
        }
      }
    }
  }
}

export default SnapshotManager;
