#!/usr/bin/env bash
set -e

# Vessel 30-Second Installer for Linux Servers
# Docker Compose Self-Hosted Application Hub

echo "=========================================================="
echo "    ╦  ╦╔═╗╔═╗╔═╗╔═╗╦  "
echo "    ╚╗╔╝║╣ ╚═╗╚═╗║╣ ║  "
echo "     ╚╝ ╚═╝╚═╝╚═╝╚═╝╩═╝"
echo "  Vessel — Lean Docker Compose Application Hub"
echo "=========================================================="

# Check root
if [ "$EUID" -ne 0 ]; then
  echo "[-] Please run as root (sudo bash install.sh)"
  exit 1
fi

# Check Docker
if ! command -v docker &> /dev/null; then
  echo "[+] Installing Docker Engine..."
  curl -fsSL https://get.docker.com | bash
fi

# Prepare install dir
INSTALL_DIR="/opt/vessel"
mkdir -p "$INSTALL_DIR"
cd "$INSTALL_DIR"

echo "[+] Initializing Vessel Docker Network (vessel-net)..."
docker network create vessel-net 2>/dev/null || true

echo "[+] Fetching Vessel Compose Configuration..."
cat << 'EOF' > docker-compose.yml
services:
  vessel:
    image: ghcr.io/vessel-hub/vessel:latest
    container_name: vessel-hub
    restart: unless-stopped
    ports:
      - "3900:3900"
      - "80:80"
      - "443:443"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - ./data:/app/data
    networks:
      - vessel-net
    environment:
      - NODE_ENV=production
      - PORT=3900

networks:
  vessel-net:
    external: true
EOF

echo "[+] Starting Vessel Control Plane..."
docker compose pull || true
docker compose up -d

SERVER_IP=$(curl -s https://api.ipify.org || hostname -I | awk '{print $1}')

echo ""
echo "=========================================================="
echo "[✓] Vessel installed and running successfully!"
echo "    Access Dashboard: http://${SERVER_IP}:3900"
echo "    Default Port:     3900"
echo "    Data Directory:   ${INSTALL_DIR}/data"
echo "=========================================================="
