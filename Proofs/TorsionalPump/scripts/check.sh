#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
export ELAN_HOME="${ELAN_HOME:-/workspace/.cache/elan}"
export XDG_CACHE_HOME="${XDG_CACHE_HOME:-/workspace/.cache}"
export PATH="$ELAN_HOME/bin:$PATH"
lake build TorsionalPump
lake env lean Audit.lean
