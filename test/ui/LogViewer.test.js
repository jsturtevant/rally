import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { render } from 'ink-testing-library';
import LogViewer from '../../lib/ui/components/LogViewer.js';

let lastInstance;
afterEach(() => {
  if (lastInstance) {
    lastInstance.unmount();
    lastInstance.cleanup();
  }
});

const SAMPLE_DISPATCH = {
  repo: 'owner/repo-a',
  type: 'issue',
  number: 42,
  logPath: '/tmp/test.log',
};

function makeLogContent(lineCount) {
  return Array.from({ length: lineCount }, (_, i) => `line-${i + 1}`).join('\n');
}

describe('LogViewer', () => {
  it('shows "No log file available" when logPath missing', () => {
    const dispatch = { ...SAMPLE_DISPATCH, logPath: null };
    lastInstance = render(
      React.createElement(LogViewer, {
        dispatch,
        onBack: () => {},
        _readFile: () => '',
        _existsSync: () => false,
      })
    );
    assert.ok(lastInstance.lastFrame().includes('No log output yet'));
  });

  it('starts scrolled to the bottom for long logs', () => {
    const content = makeLogContent(50);
    lastInstance = render(
      React.createElement(LogViewer, {
        dispatch: SAMPLE_DISPATCH,
        onBack: () => {},
        visibleLines: 10,
        _readFile: () => content,
        _existsSync: () => true,
      })
    );
    const frame = lastInstance.lastFrame();
    // Should show the last lines, not the first
    assert.ok(frame.includes('line-50'), 'should show last line');
    assert.ok(!frame.includes('line-1\n'), 'should not show first line at top');
  });

  it('renders escape hint in footer', () => {
    const content = makeLogContent(5);
    lastInstance = render(
      React.createElement(LogViewer, {
        dispatch: SAMPLE_DISPATCH,
        onBack: () => {},
        _readFile: () => content,
        _existsSync: () => true,
      })
    );
    assert.ok(lastInstance.lastFrame().includes('Esc back'), 'should show escape hint');
    assert.ok(lastInstance.lastFrame().includes('scroll'), 'should show scroll hint');
  });

  it('shows short logs without scrolling', () => {
    const content = makeLogContent(5);
    lastInstance = render(
      React.createElement(LogViewer, {
        dispatch: SAMPLE_DISPATCH,
        onBack: () => {},
        visibleLines: 20,
        _readFile: () => content,
        _existsSync: () => true,
      })
    );
    const frame = lastInstance.lastFrame();
    assert.ok(frame.includes('line-1'));
    assert.ok(frame.includes('line-5'));
  });
});
