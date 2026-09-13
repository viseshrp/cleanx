# CI and releases

The three GitHub Actions workflows are adapted from TabMD and NuffTabs.
They require no custom secrets for ordinary CI, ZIP artifacts, or GitHub releases.
The workflow token receives read-only repository access in CI and write access
only in the release workflows.

## Continuous integration

Every push and pull request runs TypeScript, Biome, manifest smoke checks,
production-extension browser tests, and unit/integration tests. Coverage must
reach 90% for statements, branches, functions, and lines. Main-branch builds
produce a ZIP artifact after all checks pass. The ZIP budget is 100 KiB.

All jobs use Node.js 22, the package's pinned pnpm version, and frozen lockfile
installs. Chromium is installed only for browser tests. Coverage is uploaded as
a GitHub artifact. Optional Codecov publishing can be enabled with the repository
variable `CODECOV_ENABLED=true` after connecting the repository to Codecov.

## Publish a GitHub release

1. On the intended commit, run `pnpm quality`, `pnpm test`, `pnpm test:e2e`, and `pnpm package`.
2. Push a version tag such as `v1.0.0`. The tag workflow validates it and creates a draft GitHub release.
3. Review and publish the draft. The release workflow reruns quality, unit, and browser checks, rebuilds the tagged source, verifies the manifest version, enforces the size limit, and attaches the ZIP.

Release tags use `v<major>.<minor>.<patch>`. `scripts/version-from-tag.mjs`
derives `RELEASE_VERSION`, which WXT uses for the built manifest.
For a local versioned build, run `RELEASE_VERSION=1.2.3 pnpm package`.

This pipeline publishes GitHub release assets. Chrome Web Store submission is
separate; the repository includes a listing draft and privacy policy for that step.
