/**
 * Unit tests for Escape key navigation in UI components
 * 
 * Tests onBack callback behavior for Escape key presses across all
 * navigation-aware components. These unit tests verify the contract
 * between components and their parents for navigation state management.
 */

import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { render } from 'ink-testing-library';
import ActionMenu from '../../lib/ui/components/ActionMenu.js';
import DetailView from '../../lib/ui/components/DetailView.js';
import LogViewer from '../../lib/ui/components/LogViewer.js';
import ProjectBrowser from '../../lib/ui/components/ProjectBrowser.js';
import ProjectItemPicker from '../../lib/ui/components/ProjectItemPicker.js';
import OnboardInput from '../../lib/ui/components/OnboardInput.js';
import BranchDispatchInput from '../../lib/ui/components/BranchDispatchInput.js';
import TrustConfirm from '../../lib/ui/components/TrustConfirm.js';

let lastInstance;
afterEach(() => {
  if (lastInstance) {
    lastInstance.unmount();
    lastInstance.cleanup();
  }
});

const delay = (ms = 50) => new Promise(r => setTimeout(r, ms));

const SAMPLE_DISPATCH = {
  repo: 'owner/repo',
  type: 'issue',
  number: 42,
  branch: 'rally/42-test',
  status: 'implementing',
  worktreePath: '/test/path',
  session_id: 'abc123',
  logPath: '/test/log.txt',
};

// ─── ACTION MENU ESCAPE ──────────────────────────────────────────────────────

describe('ActionMenu - Escape navigation', () => {
  it('calls onBack when Escape is pressed', async () => {
    let backCalled = false;
    lastInstance = render(
      React.createElement(ActionMenu, {
        dispatch: SAMPLE_DISPATCH,
        selectedAction: 0,
        onSelect: () => {},
        onBack: () => { backCalled = true; },
      })
    );
    await delay();
    lastInstance.stdin.write('\x1B'); // Escape key
    await delay();
    assert.ok(backCalled, 'Should call onBack when Escape is pressed');
  });

  it('calls onBack when q is pressed', async () => {
    let backCalled = false;
    lastInstance = render(
      React.createElement(ActionMenu, {
        dispatch: SAMPLE_DISPATCH,
        selectedAction: 0,
        onSelect: () => {},
        onBack: () => { backCalled = true; },
      })
    );
    await delay();
    lastInstance.stdin.write('q');
    await delay();
    assert.ok(backCalled, 'Should call onBack when q is pressed');
  });

  it('does not call onBack for other keys', async () => {
    let backCalled = false;
    lastInstance = render(
      React.createElement(ActionMenu, {
        dispatch: SAMPLE_DISPATCH,
        selectedAction: 0,
        onSelect: () => {},
        onBack: () => { backCalled = true; },
      })
    );
    await delay();
    lastInstance.stdin.write('j');
    await delay();
    lastInstance.stdin.write('k');
    await delay();
    lastInstance.stdin.write('x');
    await delay();
    assert.equal(backCalled, false, 'Should NOT call onBack for non-escape keys');
  });
});

// ─── DETAIL VIEW ESCAPE ──────────────────────────────────────────────────────

describe('DetailView - Escape navigation', () => {
  it('calls onBack when Escape is pressed', async () => {
    let backCalled = false;
    lastInstance = render(
      React.createElement(DetailView, {
        dispatch: SAMPLE_DISPATCH,
        onBack: () => { backCalled = true; },
      })
    );
    await delay();
    lastInstance.stdin.write('\x1B');
    await delay();
    assert.ok(backCalled, 'Should call onBack when Escape is pressed');
  });

  it('calls onBack when q is pressed', async () => {
    let backCalled = false;
    lastInstance = render(
      React.createElement(DetailView, {
        dispatch: SAMPLE_DISPATCH,
        onBack: () => { backCalled = true; },
      })
    );
    await delay();
    lastInstance.stdin.write('q');
    await delay();
    assert.ok(backCalled, 'Should call onBack when q is pressed');
  });

  it('calls onBack only for Escape or q, not other keys', async () => {
    let backCalled = false;
    lastInstance = render(
      React.createElement(DetailView, {
        dispatch: SAMPLE_DISPATCH,
        onBack: () => { backCalled = true; },
      })
    );
    await delay();
    lastInstance.stdin.write('d');
    await delay();
    lastInstance.stdin.write('\r');
    await delay();
    assert.equal(backCalled, false, 'Should only respond to Escape or q');
  });
});

// ─── LOG VIEWER ESCAPE ───────────────────────────────────────────────────────

describe('LogViewer - Escape navigation', () => {
  const mockLogDispatch = {
    ...SAMPLE_DISPATCH,
    logPath: import.meta.filename, // Use this file as a test log
  };

  it('calls onBack when Escape is pressed', async () => {
    let backCalled = false;
    lastInstance = render(
      React.createElement(LogViewer, {
        dispatch: mockLogDispatch,
        onBack: () => { backCalled = true; },
        terminalRows: 25,
      })
    );
    await delay();
    lastInstance.stdin.write('\x1B');
    await delay();
    assert.ok(backCalled, 'Should call onBack when Escape is pressed');
  });

  it('calls onBack when q is pressed', async () => {
    let backCalled = false;
    lastInstance = render(
      React.createElement(LogViewer, {
        dispatch: mockLogDispatch,
        onBack: () => { backCalled = true; },
        terminalRows: 25,
      })
    );
    await delay();
    lastInstance.stdin.write('q');
    await delay();
    assert.ok(backCalled, 'Should call onBack when q is pressed');
  });

  it('Escape works even when scrolling through log', async () => {
    let backCalled = false;
    lastInstance = render(
      React.createElement(LogViewer, {
        dispatch: mockLogDispatch,
        onBack: () => { backCalled = true; },
        terminalRows: 25,
      })
    );
    await delay();

    // Scroll up and down
    lastInstance.stdin.write('\x1B[A'); // Up arrow
    await delay(20);
    lastInstance.stdin.write('\x1B[B'); // Down arrow
    await delay(20);
    
    // Then press Escape
    lastInstance.stdin.write('\x1B');
    await delay();
    assert.ok(backCalled, 'Escape should work after scrolling');
  });

  it('handles missing log file gracefully and still responds to Escape', async () => {
    let backCalled = false;
    const noLogDispatch = { ...SAMPLE_DISPATCH, logPath: '/nonexistent/path' };
    
    lastInstance = render(
      React.createElement(LogViewer, {
        dispatch: noLogDispatch,
        onBack: () => { backCalled = true; },
        terminalRows: 25,
      })
    );
    await delay();
    lastInstance.stdin.write('\x1B');
    await delay();
    assert.ok(backCalled, 'Should still call onBack even with missing log');
  });
});

// ─── PROJECT BROWSER ESCAPE ──────────────────────────────────────────────────

describe('ProjectBrowser - Escape navigation', () => {
  const mockProjects = [
    { repo: 'owner/repo-a', name: 'repo-a', path: '/path/a' },
    { repo: 'owner/repo-b', name: 'repo-b', path: '/path/b' },
  ];

  it('calls onBack when Escape is pressed', async () => {
    let backCalled = false;
    lastInstance = render(
      React.createElement(ProjectBrowser, {
        onSelectProject: () => {},
        onAddProject: () => {},
        onBack: () => { backCalled = true; },
        _listOnboardedRepos: () => mockProjects,
      })
    );
    await delay();
    lastInstance.stdin.write('\x1B');
    await delay();
    assert.ok(backCalled, 'Should call onBack when Escape is pressed');
  });

  it('calls onBack when q is pressed', async () => {
    let backCalled = false;
    lastInstance = render(
      React.createElement(ProjectBrowser, {
        onSelectProject: () => {},
        onAddProject: () => {},
        onBack: () => { backCalled = true; },
        _listOnboardedRepos: () => mockProjects,
      })
    );
    await delay();
    lastInstance.stdin.write('q');
    await delay();
    assert.ok(backCalled, 'Should call onBack when q is pressed');
  });

  it('Escape works even in error state', async () => {
    let backCalled = false;
    lastInstance = render(
      React.createElement(ProjectBrowser, {
        onSelectProject: () => {},
        onAddProject: () => {},
        onBack: () => { backCalled = true; },
        _listOnboardedRepos: () => { throw new Error('Config error'); },
      })
    );
    await delay();
    const output = lastInstance.lastFrame();
    assert.ok(output.includes('Config error'), 'Should show error');

    lastInstance.stdin.write('\x1B');
    await delay();
    assert.ok(backCalled, 'Escape should work even in error state');
  });
});

// ─── PROJECT ITEM PICKER ESCAPE ──────────────────────────────────────────────

describe('ProjectItemPicker - Escape navigation', () => {
  const mockProject = { repo: 'owner/repo', name: 'repo', path: '/test' };
  const mockIssues = [
    { number: 1, title: 'Issue 1', labels: [], state: 'OPEN' },
  ];
  const mockPRs = [
    { number: 10, title: 'PR 1', state: 'OPEN' },
  ];

  it('calls onBack when Escape is pressed', async () => {
    let backCalled = false;
    lastInstance = render(
      React.createElement(ProjectItemPicker, {
        project: mockProject,
        onSelectItem: () => {},
        onBack: () => { backCalled = true; },
        _fetchIssues: () => mockIssues,
        _fetchPrs: () => mockPRs,
      })
    );
    await delay();
    lastInstance.stdin.write('\x1B');
    await delay();
    assert.ok(backCalled, 'Should call onBack when Escape is pressed');
  });

  it('calls onBack when q is pressed', async () => {
    let backCalled = false;
    lastInstance = render(
      React.createElement(ProjectItemPicker, {
        project: mockProject,
        onSelectItem: () => {},
        onBack: () => { backCalled = true; },
        _fetchIssues: () => mockIssues,
        _fetchPrs: () => mockPRs,
      })
    );
    await delay();
    lastInstance.stdin.write('q');
    await delay();
    assert.ok(backCalled, 'Should call onBack when q is pressed');
  });

  it('Escape works even when fetch fails', async () => {
    let backCalled = false;
    lastInstance = render(
      React.createElement(ProjectItemPicker, {
        project: mockProject,
        onSelectItem: () => {},
        onBack: () => { backCalled = true; },
        _fetchIssues: () => { throw new Error('Network error'); },
        _fetchPrs: () => [],
      })
    );
    await delay();

    lastInstance.stdin.write('\x1B');
    await delay();
    assert.ok(backCalled, 'Escape should work even when data fetch fails');
  });
});

// ─── ONBOARD INPUT ESCAPE ────────────────────────────────────────────────────

describe('OnboardInput - Escape navigation', () => {
  it('calls onBack when Escape is pressed at path step', async () => {
    let backCalled = false;
    lastInstance = render(
      React.createElement(OnboardInput, {
        terminalRows: 25,
        onSubmit: () => {},
        onBack: () => { backCalled = true; },
      })
    );
    await delay();
    lastInstance.stdin.write('\x1B');
    await delay();
    assert.ok(backCalled, 'Should call onBack when Escape is pressed');
  });

  it('Escape at fork step goes back to path step, not parent', async () => {
    let backCalled = false;
    lastInstance = render(
      React.createElement(OnboardInput, {
        terminalRows: 25,
        onSubmit: () => {},
        onBack: () => { backCalled = true; },
      })
    );
    await delay();

    // Enter a path to advance to fork step
    lastInstance.stdin.write('owner/repo');
    await delay(20);
    lastInstance.stdin.write('\r');
    await delay();

    // Should now be at fork step
    const forkFrame = lastInstance.lastFrame();
    assert.ok(forkFrame.includes('fork') || forkFrame.includes('Fork'), 'Should be at fork step');

    // Press Escape — should go back to path step, not call onBack
    lastInstance.stdin.write('\x1B');
    await delay();
    
    assert.equal(backCalled, false, 'Should NOT call onBack from fork step');
    
    // Should be back at path step
    const pathFrame = lastInstance.lastFrame();
    assert.ok(pathFrame.includes('owner/repo'), 'Should show the path input');
  });

  it('Escape from path step after going back from fork calls onBack', async () => {
    let backCalled = false;
    lastInstance = render(
      React.createElement(OnboardInput, {
        terminalRows: 25,
        onSubmit: () => {},
        onBack: () => { backCalled = true; },
      })
    );
    await delay();

    // Go to fork step
    lastInstance.stdin.write('owner/repo');
    await delay(20);
    lastInstance.stdin.write('\r');
    await delay();

    // Escape back to path
    lastInstance.stdin.write('\x1B');
    await delay();
    assert.equal(backCalled, false, 'First Escape should not call onBack');

    // Now Escape from path step
    lastInstance.stdin.write('\x1B');
    await delay();
    assert.ok(backCalled, 'Second Escape should call onBack');
  });
});

// ─── BRANCH DISPATCH INPUT ESCAPE ────────────────────────────────────────────

describe('BranchDispatchInput - Escape navigation', () => {
  it('calls onBack when Escape is pressed', async () => {
    let backCalled = false;
    lastInstance = render(
      React.createElement(BranchDispatchInput, {
        repo: 'owner/repo',
        terminalRows: 25,
        onSubmit: () => {},
        onBack: () => { backCalled = true; },
      })
    );
    await delay();
    lastInstance.stdin.write('\x1B');
    await delay();
    assert.ok(backCalled, 'Should call onBack when Escape is pressed');
  });

  it('does not respond to Escape while dispatching', async () => {
    let backCalled = false;
    lastInstance = render(
      React.createElement(BranchDispatchInput, {
        repo: 'owner/repo',
        terminalRows: 25,
        onSubmit: async () => {
          // Simulate long-running dispatch
          await new Promise(r => setTimeout(r, 500));
        },
        onBack: () => { backCalled = true; },
      })
    );
    await delay();

    // Enter some text and submit
    lastInstance.stdin.write('test task');
    await delay(20);
    lastInstance.stdin.write('\r');
    await delay(50); // Let dispatch start

    // Try Escape while dispatching
    lastInstance.stdin.write('\x1B');
    await delay(20);
    
    assert.equal(backCalled, false, 'Should NOT call onBack while dispatching');
  });
});

// ─── TRUST CONFIRM ESCAPE ────────────────────────────────────────────────────

describe('TrustConfirm - Escape navigation', () => {
  const mockItem = { type: 'issue', number: 42 };
  const mockWarnings = [
    { message: 'Warning 1', detail: 'Detail 1' },
  ];

  it('calls onCancel when Escape is pressed', async () => {
    let cancelCalled = false;
    lastInstance = render(
      React.createElement(TrustConfirm, {
        item: mockItem,
        warnings: mockWarnings,
        onConfirm: () => {},
        onCancel: () => { cancelCalled = true; },
      })
    );
    await delay();
    lastInstance.stdin.write('\x1B');
    await delay();
    assert.ok(cancelCalled, 'Should call onCancel when Escape is pressed');
  });

  it('calls onCancel when n is pressed', async () => {
    let cancelCalled = false;
    lastInstance = render(
      React.createElement(TrustConfirm, {
        item: mockItem,
        warnings: mockWarnings,
        onConfirm: () => {},
        onCancel: () => { cancelCalled = true; },
      })
    );
    await delay();
    lastInstance.stdin.write('n');
    await delay();
    assert.ok(cancelCalled, 'Should call onCancel when n is pressed');
  });

  it('calls onCancel when N is pressed', async () => {
    let cancelCalled = false;
    lastInstance = render(
      React.createElement(TrustConfirm, {
        item: mockItem,
        warnings: mockWarnings,
        onConfirm: () => {},
        onCancel: () => { cancelCalled = true; },
      })
    );
    await delay();
    lastInstance.stdin.write('N');
    await delay();
    assert.ok(cancelCalled, 'Should call onCancel when N is pressed');
  });

  it('does not call onCancel for other keys', async () => {
    let cancelCalled = false;
    lastInstance = render(
      React.createElement(TrustConfirm, {
        item: mockItem,
        warnings: mockWarnings,
        onConfirm: () => {},
        onCancel: () => { cancelCalled = true; },
      })
    );
    await delay();
    lastInstance.stdin.write('x');
    await delay();
    lastInstance.stdin.write('q');
    await delay();
    assert.equal(cancelCalled, false, 'Should only respond to Escape, n, or N');
  });
});

// ─── EDGE CASES ──────────────────────────────────────────────────────────────

describe('Escape navigation - edge cases', () => {
  it('multiple rapid Escape presses call onBack at least once', async () => {
    let backCount = 0;
    lastInstance = render(
      React.createElement(DetailView, {
        dispatch: SAMPLE_DISPATCH,
        onBack: () => { backCount++; },
      })
    );
    await delay();

    // Rapid Escape presses
    lastInstance.stdin.write('\x1B');
    lastInstance.stdin.write('\x1B');
    lastInstance.stdin.write('\x1B');
    await delay(100);

    // DetailView calls onBack for each escape; parent would unmount after first.
    // Without unmounting, all three fire — verify at least one was received.
    assert.ok(backCount >= 1, 'Should call onBack at least once');
  });

  it('Escape works with Unicode and special characters in component state', async () => {
    let backCalled = false;
    const unicodeDispatch = {
      ...SAMPLE_DISPATCH,
      branch: 'rally/42-测试-🚀',
      repo: 'owner/repo-français',
    };

    lastInstance = render(
      React.createElement(DetailView, {
        dispatch: unicodeDispatch,
        onBack: () => { backCalled = true; },
      })
    );
    await delay();

    const output = lastInstance.lastFrame();
    assert.ok(output.includes('测试') || output.includes('🚀'), 'Should render Unicode');

    lastInstance.stdin.write('\x1B');
    await delay();
    assert.ok(backCalled, 'Escape should work with Unicode content');
  });
});
