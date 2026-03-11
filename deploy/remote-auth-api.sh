#!/usr/bin/env bash
set -e

cd /opt/auth-api
docker compose down
docker compose up -d --build
docker compose ps
