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
* **Vue 3 Web Vault & Organizations Console (`web_vault_vue = true`):**
  * Full Zero-Knowledge Web Vault SPA (`frontend/vault/`) written in Vue 3 + Pinia + Tailwind CSS with Bitwarden v2026+ client protocol parity.
  * Complete Organizations Management Console (`/organizations`): creation, members invitation/RSA-OAEP confirmation/role control, collections, groups, enterprise policies, audit events, export, and Org Duo 2FA.
  * Registration enforces strong **Argon2id** (`64 MiB`, `3` iterations, `4` parallelism) key derivation with browser language detection and explicit user locale selection.
  * Light & Dark theme support across every Vault, Auth, Documentation, and Control Plane screen.
  * Built-in Documentation & Security Transparency Center accessible before sign-in (`/docs`) and inside Vault / Admin Control Plane.
* **Vue-Email Pre-Compilation Pipeline:**
  * Responsive email templates written in Vue 3 (`@vue-email/components`, `@vue-email/compiler`, `EmailLayout.vue`) with Light & Dark mail client adaptation (`prefers-color-scheme: dark` + `[data-ogsc]`).
  * Synchronized 33 HTML (`*.html.hbs`) + 33 plain-text (`*.hbs`) templates rendered natively by Rust with full per-user and browser-detected localization (`en` / `ru` / `uk`).
* **Turnkey Backup & Database Migration Hub:**
  * Added `/admin/users/export` endpoint for one-click downloading of comprehensive JSON vault backups (users, organizations, security settings).
  * Added SQLite server-side snapshot triggering (`VACUUM INTO`).
  * Introduced `tools/migrate_sqlite_to_postgres.py` for automated, topological schema and data migration from SQLite to PostgreSQL 16/17/18+.
* **Universal Infrastructure & Minimal Footprint:**
  * Universal, cloud-neutral `docker-compose.yml` with strict memory limits (512 MB limit, 64 MB reservation), operable on low-spec hardware and VPS.
  * Support for embedded SQLite (<30 MB RAM) and external PostgreSQL.
  * Unified Object Storage backend powered by Apache OpenDAL supporting Cloudflare R2 (zero egress fees), AWS S3, and MinIO.
  * Minimal Alpine 3.24 multi-stage container image (`ghcr.io/sgc-novus/novuswarden:latest`) with a total size of ~50 MB.
* **B2C & B2B Subscription & Licensing Hub:**
  * Added Vue 3 Subscriptions Management view (`/subscriptions`) supporting server-wide unlimited tier and configurable B2C/B2B quotas.
  * Added organization subscription and plan change preview endpoints (`/api/organizations/<id>/subscription/preview`, `/api/organizations/<id>/plan-change-preview`) to guarantee zero-latency compatibility with Bitwarden v2026.10+ client apps.
  * Built-in Air-Gapped License Generator (`.novuslic`) for offline enterprise activations.
* **SCIM 2.0 Enterprise Discovery Protocol:**
  * Implemented standard discovery endpoints (`/scim/v2/ServiceProviderConfig`, `/scim/v2/ResourceTypes`, `/scim/v2/Schemas`) for seamless IdP directory integrations.
* **Cryptographic KDF Boundary Protection:**
  * Enforced strict upper bounds on Argon2id (max 64 iterations) and PBKDF2 (max 2,000,000 rounds) parameters to prevent CPU and memory exhaustion attacks.
* **i18n Quality Gates:**
  * Curated, verified translation catalogs across all `15/15` dictionary files for `en`, `ru`, and `uk` locales (`401` template keys, `161` admin setting names, `144` admin descriptions, and `118` admin UI keys), plus reactive `75`-key frontend i18n with `Accept-Language` quality negotiation.
  * Automated validation tests rendering all `33` email templates across `en`, `ru`, and `uk` in Rust.
* **Modern CI/CD Automation:**
  * GitHub Actions workflows powered by Node.js 26 LTS and latest stable Rust toolchain.
  * Multi-arch container builds (`linux/amd64`, `linux/arm64`) publishing directly to GitHub Packages (GHCR).
