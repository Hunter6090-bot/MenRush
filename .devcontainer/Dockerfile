FROM mcr.microsoft.com/devcontainers/javascript-node:20-bookworm

# Install Docker CLI + Compose so setup.sh can run docker-compose
RUN apt-get update && apt-get install -y --no-install-recommends docker.io docker-compose-plugin \
    && rm -rf /var/lib/apt/lists/*

# Default workdir matches repo root
WORKDIR /workspaces/MenRush
