import { describe, it } from 'node:test';
import React from 'react';
import { Text } from 'ink';
import { render } from 'ink-testing-library';

describe('handle test', () => {
  it('renders and cleans up', () => {
    const result = render(React.createElement(Text, null, 'Hello'));
    result.unmount();
    result.cleanup();
  });
});
