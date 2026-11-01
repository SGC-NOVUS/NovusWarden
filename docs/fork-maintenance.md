# Novuswarden Fork Maintenance

This document describes the branch model for keeping Novuswarden close to upstream while preserving SGC-NOVUS customization layers.

## Branch Model

- `upstream-tracking`: clean mirror of `upstream/main`.
- `novus-core`: core functional changes (i18n architecture, transport extensions, engine patches).
- `main`: product branch with branding, docs, CI, assets, and deployment defaults.

## One-Time Setup

```bash
git remote add upstream https://github.com/dani-garcia/vaultwarden.git
git fetch upstream

git branch -f upstream-tracking upstream/main
git branch -f novus-core pr/admin-templates-i18n
```

## Update Routine

When a new upstream release appears:

```bash
git checkout upstream-tracking && git pull upstream main
git checkout novus-core && git merge upstream-tracking
git checkout main && git merge novus-core
```

Resolve conflicts in `main` only for product-level customization (branding/assets/workflows), then run quality gates.

## Recommended Quality Gates

```bash
python3 tools/check_template_locale_duplicates.py
python3 tools/check_template_i18n_keys.py
python3 tools/check_admin_i18n_keys.py
cargo fmt --all --check
cargo check --features sqlite
cargo check --features postgresql
cargo check --features mysql
```

## Notes

- Keep API contracts aligned with upstream Bitwarden clients.
- Prefer branding and deployment changes in `main`, not `novus-core`.
- Keep upstream attribution and AGPL notices intact.
