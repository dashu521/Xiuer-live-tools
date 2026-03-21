#!/usr/bin/env bash
set -e

cd /opt/auth-api
docker compose down
DOCKER_BUILDKIT=0 docker compose build --pull=false api
docker compose up -d api --no-build
docker compose ps
