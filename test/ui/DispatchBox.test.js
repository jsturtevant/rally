import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { render, cleanup } from 'ink-testing-library';
import { DispatchBox } from '../../lib/ui/index.js';
import { Text } from 'ink';

afterEach(() => { cleanup(); });

describe('DispatchBox', () => {
  it('renders bordered box with title', () => {
    const { lastFrame } = render(
      React.createElement(DispatchBox, { title: 'Status' },
        React.createElement(Text, null, 'Hello')
      )
    );
    const output = lastFrame();
    assert.ok(output.includes('Status'), 'should include title');
    assert.ok(output.includes('Hello'), 'should include children');
  });

  it('renders bordered box without title', () => {
    const { lastFrame } = render(
      React.createElement(DispatchBox, null,
        React.createElement(Text, null, 'Content')
      )
    );
    const output = lastFrame();
    assert.ok(output.includes('Content'), 'should include children');
  });

  it('renders border characters', () => {
    const { lastFrame } = render(
      React.createElement(DispatchBox, { title: 'Test' },
        React.createElement(Text, null, 'Inside')
      )
    );
    const output = lastFrame();
    assert.ok(output.includes('╭') || output.includes('│'), 'should include border characters');
  });
});
