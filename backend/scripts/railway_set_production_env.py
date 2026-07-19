#!/usr/bin/env python3
"""
Push local backend/.env to Railway for one service (Phase 4 + trigger deploy).

Usage (from repo):
  cd backend
  python3 scripts/railway_set_production_env.py --service backend
  python3 scripts/railway_set_production_env.py --service <service-uuid>

Skips: PORT, any key starting with VITE_
Overrides: NODE_ENV=production, FRONTEND_URL=https://menrush.com
Sets: DATABASE_URL to Railway reference ${{Postgres.DATABASE_URL}} (literal; not shell-expanded)

Uses `railway variable set KEY --stdin` so secrets with = or spaces are safe.
By default uses --skip-deploys on each set, then `railway redeploy -y --from-source`.
"""
from __future__ import annotations

import argparse
import os
import subprocess
import sys
from pathlib import Path


def parse_env(path: Path) -> dict[str, str]:
    out: dict[str, str] = {}
    for raw in path.read_text().splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        if "=" not in line:
            continue
        k, v = line.split("=", 1)
        key = k.strip()
        val = v.strip().strip('"').strip("'")
        out[key] = val
    return out


def railway(args: list[str], *, stdin: bytes | None = None) -> None:
    r = subprocess.run(
        ["railway", *args],
        input=stdin,
        cwd=Path(__file__).resolve().parents[1],
        capture_output=False,
    )
    if r.returncode != 0:
        sys.exit(r.returncode)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument(
        "--service",
        "-s",
        required=True,
        help="Railway service name or UUID (e.g. backend or paste ID from dashboard URL)",
    )
    ap.add_argument(
        "--database-url-ref",
        default="${{Postgres.DATABASE_URL}}",
        help="Railway variable reference for DATABASE_URL",
    )
    ap.add_argument(
        "--no-redeploy",
        action="store_true",
        help="Only set variables; do not redeploy at the end",
    )
    args = ap.parse_args()
    service = args.service

    root = Path(__file__).resolve().parents[1]
    env_path = root / ".env"
    if not env_path.is_file():
        print(f"Missing {env_path}", file=sys.stderr)
        sys.exit(1)

    env = parse_env(env_path)

    def set_var(key: str, value: str, *, skip_deploys: bool) -> None:
        cmd = ["variable", "set", key, "--stdin", "-s", service]
        if skip_deploys:
            cmd.append("--skip-deploys")
        railway(cmd, stdin=value.encode())

    # From .env verbatim, except rules below
    skip_keys = {"PORT", "DATABASE_URL", "NODE_ENV", "FRONTEND_URL"}
    for k in sorted(env.keys()):
        if k in skip_keys:
            continue
        if k.startswith("VITE_"):
            continue
        set_var(k, env[k], skip_deploys=True)

    set_var("NODE_ENV", "production", skip_deploys=True)
    set_var("FRONTEND_URL", "https://menrush.com", skip_deploys=True)
    set_var("DATABASE_URL", args.database_url_ref, skip_deploys=True)

    if not args.no_redeploy:
        railway(["redeploy", "-s", service, "-y", "--from-source"])


if __name__ == "__main__":
    main()
