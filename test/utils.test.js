import { test } from 'node:test';
import assert from 'node:assert/strict';
import { slugify, findProjectPath } from '../lib/utils.js';

test('slugify creates URL-safe slugs', () => {
  assert.equal(slugify('Hello World'), 'hello-world');
  assert.equal(slugify('Test Title 123'), 'test-title-123');
  assert.equal(slugify('Special!@#$%Chars'), 'special-chars');
  assert.equal(slugify('  Leading and trailing  '), 'leading-and-trailing');
  assert.equal(slugify('multiple---hyphens'), 'multiple-hyphens');
  assert.equal(slugify(''), 'untitled');
  assert.equal(
    slugify('a'.repeat(100)),
    'a'.repeat(50)
  );
});

test('findProjectPath returns path for matching repo', () => {
  const mockReadProjects = () => ({
    projects: [
      { name: 'rally', path: '/home/user/rally' },
      { name: 'dispatcher', path: '/home/user/dispatcher' },
    ],
  });

  const result = findProjectPath('jsturtevant/rally', mockReadProjects);
  assert.equal(result, '/home/user/rally');
});

test('findProjectPath returns null when no match found', () => {
  const mockReadProjects = () => ({
    projects: [
      { name: 'rally', path: '/home/user/rally' },
    ],
  });

  const result = findProjectPath('jsturtevant/other-repo', mockReadProjects);
  assert.equal(result, null);
});

test('findProjectPath handles empty projects list', () => {
  const mockReadProjects = () => ({
    projects: [],
  });

  const result = findProjectPath('jsturtevant/rally', mockReadProjects);
  assert.equal(result, null);
});

test('findProjectPath handles missing projects property', () => {
  const mockReadProjects = () => ({});

  const result = findProjectPath('jsturtevant/rally', mockReadProjects);
  assert.equal(result, null);
});

test('findProjectPath extracts repo name from owner/repo format', () => {
  const mockReadProjects = () => ({
    projects: [
      { name: 'my-project', path: '/home/user/my-project' },
    ],
  });

  const result = findProjectPath('github-org/my-project', mockReadProjects);
  assert.equal(result, '/home/user/my-project');
});
