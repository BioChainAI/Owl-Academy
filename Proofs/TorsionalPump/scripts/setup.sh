#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
export ELAN_HOME="${ELAN_HOME:-/workspace/.cache/elan}"
export XDG_CACHE_HOME="${XDG_CACHE_HOME:-/workspace/.cache}"
export PATH="$ELAN_HOME/bin:$PATH"
setup_dir="$XDG_CACHE_HOME/lean-setup"
mkdir -p "$setup_dir"
if [ ! -x "$ELAN_HOME/bin/elan" ]; then
  curl --fail --location --retry 3 \
    https://raw.githubusercontent.com/leanprover/elan/v4.2.4/elan-init.sh \
    --output "$setup_dir/elan-init-v4.2.4.sh"
  sh "$setup_dir/elan-init-v4.2.4.sh" -y --no-modify-path --default-toolchain none
fi
if ! elan run leanprover/lean4:v4.24.0 lean --version >/dev/null 2>&1; then
  # The official direct release works where the installer redirect is unavailable.
  if [ ! -x "$setup_dir/lean-4.24.0-linux/bin/lean" ]; then
    curl --fail --location --retry 3 \
      https://github.com/leanprover/lean4/releases/download/v4.24.0/lean-4.24.0-linux.tar.zst \
      --output "$setup_dir/lean-4.24.0-linux.tar.zst"
    tar --zstd -xf "$setup_dir/lean-4.24.0-linux.tar.zst" -C "$setup_dir"
  fi
  elan toolchain link leanprover/lean4:v4.24.0 "$setup_dir/lean-4.24.0-linux"
fi
# The committed manifest pins Mathlib and all transitive Git dependencies.
lake exe cache get
bash scripts/check.sh
