![Novuswarden Logo](./resources/vaultwarden-logo.svg)

# NovusWarden

NovusWarden is an enterprise-grade, high-performance Bitwarden-compatible server implementation in Rust maintained by **SGC-NOVUS (System Generations Core Novus)** for self-hosted and cloud deployments.

## Authors, Fork and License Notice

- **Maintainer**: SGC-NOVUS (System Generations Core Novus) <https://github.com/SGC-NOVUS>
- **Contact**: <support@sgc-novus.fun>
- **Fork Repository**: <https://github.com/SGC-NOVUS/novuswarden>
- **Upstream Project**: <https://github.com/dani-garcia/vaultwarden>
- **License**: GNU Affero General Public License v3.0 (AGPL-3.0) — see [LICENSE.txt](./LICENSE.txt)
- **Contributors & Upstream Attribution**: Full attribution for all upstream authors and contributors is documented in [AUTHORS.md](./AUTHORS.md), [CREDITS.md](./CREDITS.md), and [NOTICE_FORK.md](./NOTICE_FORK.md).

This repository contains upstream code and independent architectural, performance, and UI enhancements by SGC-NOVUS.
When redistributing this software or operating it as a network service, comply with AGPL obligations.

## Project Status

Novuswarden targets protocol-level compatibility with official Bitwarden clients while applying independent branding, docs, and distribution workflow.

> [!IMPORTANT]
> Novuswarden is not affiliated with Bitwarden, Inc.
> Do not use official Bitwarden support channels for Novuswarden-specific issues.

## Features

- Personal vault
- Send
- Attachments
- Website icons
- Personal API key
- Organizations
- Collections
- Groups
- Event logs
- Multi-factor authentication
- Emergency access
- Admin backend

## Quick Start

### Docker/Podman

```shell
docker run --detach --name novuswarden \
  --env DOMAIN="https://vw.domain.tld" \
  --volume /vw-data/:/data/ \
  --restart unless-stopped \
  --publish 127.0.0.1:8000:80 \
  ghcr.io/sgc-novus/novuswarden:latest
```

If you have not published container images yet, build locally and run your own image tag.

### Docker Compose

Create a compose file:

```yaml
services:
  novuswarden:
    image: ghcr.io/sgc-novus/novuswarden:latest
    container_name: novuswarden
    restart: unless-stopped
    environment:
      DOMAIN: "https://vw.domain.tld"
    volumes:
      - ./vw-data/:/data/
    ports:
      - 127.0.0.1:8000:80
```

## Build from Source

```shell
cargo build --features sqlite
```

Run:

```shell
cargo run --features sqlite
```

## Configuration

- Main settings are environment-driven.
- For production use, run behind a reverse proxy and enable HTTPS.
- Store data on persistent volumes and create regular backups.

## Support

- Discussions: https://github.com/SGC-NOVUS/novuswarden/discussions
- Issues: https://github.com/SGC-NOVUS/novuswarden/issues

If you can reproduce a bug on unmodified upstream Vaultwarden, consider reporting upstream as well.

## Security

For vulnerability reports, use private security channels where possible. Avoid posting exploitable details in public issues before triage.

## Disclaimer

This project is not associated with Bitwarden or Bitwarden, Inc.

The software is provided as-is, without warranties. You are responsible for backups, key management, and operational security.

## Upstream Attribution

Novuswarden stands on the work of the Vaultwarden maintainers and contributors.
Please consider supporting upstream development:

- https://github.com/dani-garcia/vaultwarden
