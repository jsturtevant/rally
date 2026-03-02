# Rally Documentation Site

This is the Rally documentation site, built with [Astro](https://astro.build) and [Starlight](https://starlight.astro.build).

## Development

```bash
# Install dependencies
npm install

# Start dev server at localhost:4321
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Structure

```
docs-site/
├── src/
│   ├── assets/          # Images and static assets
│   └── content/
│       └── docs/        # Markdown documentation files
│           ├── guides/      # Getting started, quickstart
│           ├── workflows/   # Dashboard, dispatch workflows
│           ├── reference/   # CLI commands, configuration
│           └── security/    # Trust checks, sandboxing
├── astro.config.mjs     # Astro + Starlight configuration
└── package.json
```

## Adding Content

1. Create `.md` or `.mdx` files in `src/content/docs/`
2. Each file becomes a route based on its path
3. Update sidebar in `astro.config.mjs` if needed

## Deployment

The site deploys automatically to GitHub Pages via the `rally-docs.yml` workflow when changes are pushed to `main`.

Live site: https://jsturtevant.github.io/rally
