#!/bin/sh
set -eu

# Build-time branding controls. Keep defaults aligned with project naming.
brand_name="${WEB_VAULT_BRAND_NAME:-NovusWarden}"
brand_web_name="${WEB_VAULT_BRAND_WEB_NAME:-${brand_name} Web}"
brand_admin_name="${WEB_VAULT_BRAND_ADMIN_NAME:-${brand_name} Control Plane}"

web_vault_dir="/web-vault"
overlay_dir="/web-vault-overlay"

if [ ! -d "$web_vault_dir" ]; then
    echo "web-vault directory not found: $web_vault_dir" >&2
    exit 1
fi

# Patch plain-text assets in place. This keeps upstream web-vault functionality,
# but ensures user-visible product naming is branded consistently.
find "$web_vault_dir" -type f \( -name '*.html' -o -name '*.json' -o -name '*.js' -o -name '*.css' -o -name '*.txt' \) \
    -exec sed -i \
        -e "s/Vaultwarden Web/${brand_web_name}/g" \
        -e "s/Vaultwarden Admin/${brand_admin_name}/g" \
        -e "s/Vaultwarden/${brand_name}/g" \
        {} +

# Optional overlay for logos/icons/custom files from repository.
if [ -d "$overlay_dir" ]; then
    cp -a "$overlay_dir"/. "$web_vault_dir"/
    rm -f "$web_vault_dir/README.md"
fi

# Inject custom branding stylesheet into web-vault index when available.
# This avoids patching hashed bundle files and keeps the override stable across updates.
if [ -f "$web_vault_dir/novus-brand.css" ] && [ -f "$web_vault_dir/index.html" ]; then
    if ! grep -q 'novus-brand.css' "$web_vault_dir/index.html"; then
        sed -i 's#</head>#<link rel="stylesheet" href="novus-brand.css?v=1"></head>#' "$web_vault_dir/index.html"
    fi
fi
