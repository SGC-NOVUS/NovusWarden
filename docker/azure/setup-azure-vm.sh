#!/usr/bin/env bash
# ==============================================================================
# NovusWarden Azure VM Hardening Script (2 vCPU, 1 GB RAM)
# Configures swapfile, kernel memory tuning, UFW firewall, and Docker daemon
# ==============================================================================

set -euo pipefail

echo "==> [1/4] Configuring 2GB Swapfile (Vital to protect 1GB RAM from OOM Killer)..."
if [ ! -f /swapfile ]; then
    fallocate -l 2G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=2048
    chmod 600 /swapfile
    mkswap /swapfile
    swapon /swapfile
    echo '/swapfile none swap sw 0 0' >> /etc/fstab
    echo "    ✓ Swapfile active."
else
    echo "    ✓ Swapfile already exists."
fi

echo "==> [2/4] Applying Kernel Virtual Memory & Network Security Tunings..."
cat << 'EOF' > /etc/sysctl.d/99-novuswarden-azure.conf
# Virtual Memory tuning for 1GB RAM host
vm.swappiness = 10
vm.vfs_cache_pressure = 50
vm.overcommit_memory = 1

# TCP Syn flood and security tuning
net.ipv4.tcp_syncookies = 1
net.ipv4.tcp_max_syn_backlog = 2048
net.ipv4.tcp_fin_timeout = 15
net.ipv4.conf.all.rp_filter = 1
net.ipv4.conf.default.rp_filter = 1
EOF
sysctl --system > /dev/null
echo "    ✓ Kernel tunings loaded."

echo "==> [3/4] Hardening Host Firewall (UFW)..."
if command -v ufw > /dev/null; then
    ufw default deny incoming
    ufw default allow outgoing
    ufw allow 22/tcp comment 'SSH'
    ufw allow 80/tcp comment 'HTTP ACME'
    ufw allow 443/tcp comment 'HTTPS NovusWarden'
    ufw --force enable
    echo "    ✓ UFW firewall enabled (Only 22, 80, 443 open)."
fi

echo "==> [4/4] Host Preparation Complete!"
echo "You can now clone your repository or copy docker/azure/, create .env.azure, and run:"
echo "    docker compose -f docker-compose.azure.yml up -d"

