import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { render } from 'ink-testing-library';
import OnboardInput from '../../lib/ui/components/OnboardInput.js';

let lastInstance;
afterEach(() => {
  if (lastInstance) {
    lastInstance.unmount();
    lastInstance.cleanup();
  }
});

const delay = (ms = 50) => new Promise(r => setTimeout(r, ms));

describe('OnboardInput', () => {
  it('renders initial path step', () => {
    lastInstance = render(
      React.createElement(OnboardInput, {
        terminalRows: 20,
        onSubmit: () => {},
        onBack: () => {},
      })
    );
    const output = lastInstance.lastFrame();
    assert.ok(output.includes('Add Project'), 'should show title');
    assert.ok(output.includes('Upstream repository'), 'should show path prompt');
    assert.ok(output.includes('Enter continue · Esc back'), 'should show path help text');
  });

  it('moves to fork step after entering path', async () => {
    lastInstance = render(
      React.createElement(OnboardInput, {
        terminalRows: 20,
        onSubmit: () => {},
        onBack: () => {},
      })
    );
    
    // Type a path
    lastInstance.stdin.write('owner/repo');
    await delay();
    
    // Press enter to continue
    lastInstance.stdin.write('\r');
    await delay();
    
    const output = lastInstance.lastFrame();
    assert.ok(output.includes('Is this a fork?'), 'should show fork prompt');
    assert.ok(output.includes('Enter submit · Esc back'), 'should show fork help text');
  });

  it('calls onSubmit with {path, fork: "auto"} when fork=y', async () => {
    let submitCalled = false;
    let submitPayload = null;
    
    lastInstance = render(
      React.createElement(OnboardInput, {
        terminalRows: 20,
        onSubmit: (payload) => {
          submitCalled = true;
          submitPayload = payload;
          return Promise.resolve();
        },
        onBack: () => {},
      })
    );
    
    // Type a path
    lastInstance.stdin.write('owner/repo');
    await delay();
    lastInstance.stdin.write('\r');
    await delay();
    
    // Type 'y' for fork
    lastInstance.stdin.write('y');
    await delay();
    lastInstance.stdin.write('\r');
    await delay();
    
    assert.ok(submitCalled, 'onSubmit should be called');
    assert.deepEqual(submitPayload, { path: 'owner/repo', fork: 'auto' }, 'should pass correct payload');
  });

  it('calls onSubmit with {path} when fork=n', async () => {
    let submitCalled = false;
    let submitPayload = null;
    
    lastInstance = render(
      React.createElement(OnboardInput, {
        terminalRows: 20,
        onSubmit: (payload) => {
          submitCalled = true;
          submitPayload = payload;
          return Promise.resolve();
        },
        onBack: () => {},
      })
    );
    
    // Type a path
    lastInstance.stdin.write('owner/repo');
    await delay();
    lastInstance.stdin.write('\r');
    await delay();
    
    // Type 'n' for fork
    lastInstance.stdin.write('n');
    await delay();
    lastInstance.stdin.write('\r');
    await delay();
    
    assert.ok(submitCalled, 'onSubmit should be called');
    assert.deepEqual(submitPayload, { path: 'owner/repo' }, 'should pass correct payload without fork');
  });

  it('returns to path step when Escape pressed from fork step', async () => {
    lastInstance = render(
      React.createElement(OnboardInput, {
        terminalRows: 20,
        onSubmit: () => {},
        onBack: () => {},
      })
    );
    
    // Type a path and advance to fork step
    lastInstance.stdin.write('owner/repo');
    await delay();
    lastInstance.stdin.write('\r');
    await delay();
    
    let output = lastInstance.lastFrame();
    assert.ok(output.includes('Is this a fork?'), 'should be on fork step');
    
    // Press Escape
    lastInstance.stdin.write('\x1B');
    await delay();
    
    output = lastInstance.lastFrame();
    assert.ok(output.includes('Upstream repository'), 'should return to path step');
    assert.ok(output.includes('owner/repo'), 'should preserve entered path');
  });

  it('calls onBack when Escape pressed from path step', async () => {
    let backCalled = false;
    
    lastInstance = render(
      React.createElement(OnboardInput, {
        terminalRows: 20,
        onSubmit: () => {},
        onBack: () => { backCalled = true; },
      })
    );
    
    // Press Escape from initial path step
    lastInstance.stdin.write('\x1B');
    await delay();
    
    assert.ok(backCalled, 'onBack should be called');
  });

  it('shows error message for invalid fork input', async () => {
    lastInstance = render(
      React.createElement(OnboardInput, {
        terminalRows: 20,
        onSubmit: () => Promise.resolve(),
        onBack: () => {},
      })
    );
    
    // Type a path and advance to fork step
    lastInstance.stdin.write('owner/repo');
    await delay();
    lastInstance.stdin.write('\r');
    await delay();
    
    // Type invalid fork answer
    lastInstance.stdin.write('x');
    await delay();
    lastInstance.stdin.write('\r');
    await delay();
    
    const output = lastInstance.lastFrame();
    assert.ok(output.includes('Please enter y or n'), 'should show error message');
  });

  it('shows error state help text when onboarding fails', async () => {
    lastInstance = render(
      React.createElement(OnboardInput, {
        terminalRows: 20,
        onSubmit: () => Promise.reject(new Error('Onboard failed')),
        onBack: () => {},
      })
    );
    
    // Complete path step
    lastInstance.stdin.write('owner/repo');
    await delay();
    lastInstance.stdin.write('\r');
    await delay();
    
    // Complete fork step with 'n'
    lastInstance.stdin.write('n');
    await delay();
    lastInstance.stdin.write('\r');
    await delay(100); // Give time for promise to reject
    
    const output = lastInstance.lastFrame();
    assert.ok(output.includes('Onboard failed'), 'should show error message');
    assert.ok(output.includes('Press any key to continue'), 'should show error help text');
  });
});
