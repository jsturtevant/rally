import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { render, cleanup } from 'ink-testing-library';
import StatusMessage from '../../lib/ui/components/StatusMessage.js';

afterEach(() => { cleanup(); });

describe('StatusMessage', () => {
  it('renders success with green checkmark', () => {
    const { lastFrame } = render(React.createElement(StatusMessage, { type: 'success' }, 'Done'));
    const output = lastFrame();
    assert.ok(output.includes('✓'), 'should include ✓ icon');
    assert.ok(output.includes('Done'), 'should include children text');
  });

  it('renders error with red X', () => {
    const { lastFrame } = render(React.createElement(StatusMessage, { type: 'error' }, 'Failed'));
    const output = lastFrame();
    assert.ok(output.includes('✗'), 'should include ✗ icon');
    assert.ok(output.includes('Failed'), 'should include children text');
  });

  it('renders warning with yellow triangle', () => {
    const { lastFrame } = render(React.createElement(StatusMessage, { type: 'warning' }, 'Careful'));
    const output = lastFrame();
    assert.ok(output.includes('⚠'), 'should include ⚠ icon');
    assert.ok(output.includes('Careful'), 'should include children text');
  });

  it('renders skip with gray circle', () => {
    const { lastFrame } = render(React.createElement(StatusMessage, { type: 'skip' }, 'Skipped'));
    const output = lastFrame();
    assert.ok(output.includes('⊘'), 'should include ⊘ icon');
    assert.ok(output.includes('Skipped'), 'should include children text');
  });

  it('returns null for unknown type', () => {
    const { lastFrame } = render(React.createElement(StatusMessage, { type: 'unknown' }, 'Nope'));
    const output = lastFrame();
    assert.equal(output, '', 'should render nothing for unknown type');
  });
});
