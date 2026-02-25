import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { render } from 'ink-testing-library';
import ProjectBrowser from '../../lib/ui/components/ProjectBrowser.js';

let lastInstance;
afterEach(() => {
  if (lastInstance) {
    lastInstance.unmount();
    lastInstance.cleanup();
  }
});

const delay = () => new Promise(r => setImmediate(r));

const SAMPLE_PROJECTS = [
  { repo: 'owner/repo-a', name: 'repo-a', path: '/home/user/repo-a' },
  { repo: 'owner/repo-b', name: 'repo-b', path: '/home/user/repo-b' },
];

describe('ProjectBrowser', () => {
  it('renders project list', () => {
    lastInstance = render(
      React.createElement(ProjectBrowser, {
        onSelectProject: () => {},
        onAddProject: () => {},
        onBack: () => {},
        _listOnboardedRepos: () => SAMPLE_PROJECTS,
      })
    );
    const output = lastInstance.lastFrame();
    assert.ok(output.includes('Select a Project'), 'should show title');
    assert.ok(output.includes('owner/repo-a'), 'should show first project');
    assert.ok(output.includes('owner/repo-b'), 'should show second project');
  });

  it('renders "Add Project" option', () => {
    lastInstance = render(
      React.createElement(ProjectBrowser, {
        onSelectProject: () => {},
        onAddProject: () => {},
        onBack: () => {},
        _listOnboardedRepos: () => SAMPLE_PROJECTS,
      })
    );
    const output = lastInstance.lastFrame();
    assert.ok(output.includes('+ Add Project'), 'should show Add Project option');
  });

  it('renders error state when listRepos throws', () => {
    lastInstance = render(
      React.createElement(ProjectBrowser, {
        onSelectProject: () => {},
        onAddProject: () => {},
        onBack: () => {},
        _listOnboardedRepos: () => { throw new Error('Config not found'); },
      })
    );
    const output = lastInstance.lastFrame();
    assert.ok(output.includes('Config not found'), 'should show error message');
    assert.ok(output.includes('Esc back'), 'should show escape hint');
  });

  it('navigates with up/down arrows', async () => {
    lastInstance = render(
      React.createElement(ProjectBrowser, {
        onSelectProject: () => {},
        onAddProject: () => {},
        onBack: () => {},
        _listOnboardedRepos: () => SAMPLE_PROJECTS,
      })
    );
    const output = lastInstance.lastFrame();
    assert.ok(output.includes('❯'), 'should show selector');

    // Move down
    lastInstance.stdin.write('\x1B[B');
    await delay();
    const afterDown = lastInstance.lastFrame();
    assert.ok(afterDown.includes('❯'), 'selector should still be visible after down');
  });

  it('selects project on Enter', async () => {
    let selectedProject = null;
    lastInstance = render(
      React.createElement(ProjectBrowser, {
        onSelectProject: (proj) => { selectedProject = proj; },
        onAddProject: () => {},
        onBack: () => {},
        _listOnboardedRepos: () => SAMPLE_PROJECTS,
      })
    );
    await delay();
    lastInstance.stdin.write('\r');
    await delay();
    assert.ok(selectedProject, 'should have selected a project');
    assert.equal(selectedProject.repo, 'owner/repo-a', 'should select first project');
  });

  it('selects Add Project on Enter when navigated to it', async () => {
    let addCalled = false;
    lastInstance = render(
      React.createElement(ProjectBrowser, {
        onSelectProject: () => {},
        onAddProject: () => { addCalled = true; },
        onBack: () => {},
        _listOnboardedRepos: () => SAMPLE_PROJECTS,
      })
    );
    await delay();
    // Navigate down to Add Project (index 2, after 2 projects)
    lastInstance.stdin.write('\x1B[B');
    await delay();
    lastInstance.stdin.write('\x1B[B');
    await delay();
    lastInstance.stdin.write('\r');
    await delay();
    assert.ok(addCalled, 'should call onAddProject');
  });

  it('goes back on Escape', async () => {
    let backCalled = false;
    lastInstance = render(
      React.createElement(ProjectBrowser, {
        onSelectProject: () => {},
        onAddProject: () => {},
        onBack: () => { backCalled = true; },
        _listOnboardedRepos: () => SAMPLE_PROJECTS,
      })
    );
    await delay();
    lastInstance.stdin.write('\x1B');
    await delay();
    assert.ok(backCalled, 'Escape should call onBack');
  });

  it('goes back on q', async () => {
    let backCalled = false;
    lastInstance = render(
      React.createElement(ProjectBrowser, {
        onSelectProject: () => {},
        onAddProject: () => {},
        onBack: () => { backCalled = true; },
        _listOnboardedRepos: () => SAMPLE_PROJECTS,
      })
    );
    await delay();
    lastInstance.stdin.write('q');
    await delay();
    assert.ok(backCalled, 'q should call onBack');
  });
});
