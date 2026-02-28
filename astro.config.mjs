// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

// https://astro.build/config
export default defineConfig({
	site: 'https://jsturtevant.github.io',
	base: '/rally',
	integrations: [
		starlight({
			title: 'Rally',
			social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/jsturtevant/rally' }],
			sidebar: [
				{
					label: 'Getting Started',
					items: [
						{ label: 'Introduction', slug: 'guides/introduction' },
						{ label: 'Installation', slug: 'guides/installation' },
						{ label: 'Quick Start', slug: 'guides/quickstart' },
						{ label: 'Onboarding Projects', slug: 'guides/onboarding' },
					],
				},
				{
					label: 'Workflows',
					items: [
						{ label: 'Dashboard (Human)', slug: 'workflows/dashboard' },
						{ label: 'CLI (Agents)', slug: 'workflows/cli' },
						{ label: 'Multi-Project', slug: 'workflows/multi-project' },
						{ label: 'Fork Workflow', slug: 'workflows/fork' },
					],
				},
				{
					label: 'Reference',
					autogenerate: { directory: 'reference' },
				},
				{
					label: 'Security',
					items: [
						{ label: 'Overview', slug: 'security/overview' },
						{ label: 'Read-only Policy', slug: 'security/read-only-policy' },
						{ label: 'Docker Sandbox', slug: 'security/docker-sandbox' },
						{ label: 'Trust Checks', slug: 'security/trust-checks' },
					],
				},
			],
		}),
	],
});
