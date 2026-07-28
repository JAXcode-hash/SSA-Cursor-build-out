# SSA-Cursor-build-out

## Cursor Cloud specific instructions

### Current repository state

This repository is currently an empty scaffold. The only tracked file besides this one
is `README.md` (a single title line). There is **no application code, no package
manifests, no lockfiles, no services, and no build/test/run tooling yet**. Because of
this, there is nothing to lint, test, build, or run end-to-end at the moment.

### Available toolchains on the VM

The base image already provides these (no install needed):

- Node.js `v22.14.0` with `npm`, `pnpm` (via corepack), and `yarn` available
- Python `3.12` with `pip`
- Go `1.22`
- Rust `1.83` (`cargo`)

### Update script behavior

The configured startup update script installs dependencies **only if** a recognized
manifest/lockfile exists (each command is guarded by a file check), so it is a safe
no-op on the current empty repo. Once application code and a dependency manifest are
added (for example `package.json`/lockfile, `requirements.txt`, `uv.lock`, or
`poetry.lock`), dependencies will be installed automatically on startup.

### Adding a product

When application code is introduced, update this file with the real service
descriptions and the standard lint/test/build/run commands (prefer referencing
`package.json` scripts, a `Makefile`, or `docker-compose.yml` rather than duplicating
commands), and extend the update script if the guarded manifest checks do not already
cover the chosen stack.
