# Changelog

All notable changes to **NovusWarden** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.0.1] - 2026-11-01

### 🚀 Initial Release by SGC-NOVUS (System Generations Core Novus)

This is the initial independent release of **NovusWarden**, a high-performance, Bitwarden-compatible password vault server developed and maintained by **SGC-NOVUS**.

### Added
* **NovusWarden Core Identity & Rebranding:**
  * Rebranded package identity, server headers, and web vault overlays to NovusWarden.
  * Full legal attribution and credits preserved in accordance with AGPLv3 in [`AUTHORS.md`](AUTHORS.md), [`CREDITS.md`](CREDITS.md), and [`LICENSE.txt`](LICENSE.txt).
  * Clean, independent root commit graph authored by `SGC-NOVUS <support@sgc-novus.fun>`.
* **Vue 3 Modern Control Plane:**
  * Interactive administrative SPA accessible via `/admin/ui` with dark mode, system status cards, and real-time telemetry.
  * Direct management views for Users, Organizations, Settings, and Diagnostics.
  * Safe session revocation, credential management, and quick navigation toggle between Classic Admin and Vue 3 Control Plane.
  * Zero-runtime overhead: client assets are bundled by Vite and embedded directly into the Rust executable via `include_dir`.
* **Vue-Email Pre-Compilation Pipeline:**
  * Modern, responsive email templates written in Vue 3 (`@vue-email/components`, `@vue-email/compiler`).
  * Automated build-time precompiler (`frontend/emails/compile-emails.mjs`) generating standalone, inlined HTML Handlebars templates.
  * Zero Node.js runtime footprint in production; email dispatch is handled natively by the Rust backend.
* **Turnkey Backup & Database Migration Hub:**
  * Added `/admin/users/export` endpoint for one-click downloading of comprehensive JSON vault backups (users, organizations, security settings).
  * Added SQLite server-side snapshot triggering (`VACUUM INTO`).
  * Introduced `tools/migrate_sqlite_to_postgres.py` for automated, topological schema and data migration from SQLite to PostgreSQL 16/17/18+.
* **Universal Infrastructure & Minimal Footprint:**
  * Universal, cloud-neutral `docker-compose.yml` with strict memory limits (512 MB limit, 64 MB reservation), operable on low-spec hardware and VPS.
  * Support for embedded SQLite (<30 MB RAM) and external PostgreSQL.
  * Unified Object Storage backend powered by Apache OpenDAL supporting Cloudflare R2 (zero egress fees), AWS S3, and MinIO.
  * Minimal Alpine 3.24 multi-stage container image (`ghcr.io/sgc-novus/novuswarden:latest`) with a total size of ~50 MB.
* **i18n Quality Gates:**
  * Curated, verified translation catalogs for `en`, `ru`, and `uk` locales covering all 386 template keys and 118 admin UI keys.
  * CI validation guards for template and admin key completeness.
* **Modern CI/CD Automation:**
  * GitHub Actions workflows powered by Node.js 26 LTS and latest stable Rust toolchain.
  * Multi-arch container builds (`linux/amd64`, `linux/arm64`) publishing directly to GitHub Packages (GHCR).
