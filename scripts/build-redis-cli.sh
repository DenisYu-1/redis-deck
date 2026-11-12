#!/usr/bin/env bash
# Builds redis-cli (with TLS) from a pinned Redis source tarball for the host arch.
# Output: build/redis-cli/redis-cli   (gitignored)
# Needs: curl, tar, make, cc, openssl dev headers (macOS: brew install openssl@3).
set -euo pipefail

REDIS_VERSION="${REDIS_VERSION:-7.2.5}" # the single place the version is pinned
REDIS_SHA256="${REDIS_SHA256:-5981179706f8391f03be91d951acafaeda91af7fac56beffb2701963103e423d}"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT_DIR="$ROOT/build/redis-cli"
WORK="$(mktemp -d "${TMPDIR:-/tmp}/redis-cli-build.XXXXXX")"
trap 'rm -rf "$WORK"' EXIT

if [[ "$(uname)" == "Darwin" && -z "${OPENSSL_PREFIX:-}" ]]; then
  OPENSSL_PREFIX="$(brew --prefix openssl@3 2>/dev/null || true)"
fi

echo "==> Downloading redis-$REDIS_VERSION"
curl -fsSL "https://download.redis.io/releases/redis-$REDIS_VERSION.tar.gz" -o "$WORK/redis.tar.gz"
echo "$REDIS_SHA256  $WORK/redis.tar.gz" | shasum -a 256 -c - >/dev/null \
  || { echo "SHA256 mismatch for redis-$REDIS_VERSION" >&2; exit 1; }
mkdir "$WORK/src"
tar -xzf "$WORK/redis.tar.gz" -C "$WORK/src" --strip-components=1

echo "==> Building redis-cli (BUILD_TLS=yes, $(uname -m))"
JOBS="$(getconf _NPROCESSORS_ONLN 2>/dev/null || echo 2)"
MAKE_ARGS=(BUILD_TLS=yes -j"$JOBS" redis-cli)
[[ -n "${OPENSSL_PREFIX:-}" ]] && MAKE_ARGS+=(OPENSSL_PREFIX="$OPENSSL_PREFIX")
make -C "$WORK/src/src" "${MAKE_ARGS[@]}" >"$WORK/build.log" 2>&1 \
  || { tail -40 "$WORK/build.log" >&2; exit 1; }

mkdir -p "$OUT_DIR"
cp "$WORK/src/src/redis-cli" "$OUT_DIR/redis-cli"
chmod +x "$OUT_DIR/redis-cli"
BIN="$OUT_DIR/redis-cli"

echo "==> Verifying"
"$BIN" --version
# TLS-enabled builds link OpenSSL; non-TLS builds do not.
if [[ "$(uname)" == "Darwin" ]]; then LINKS="$(otool -L "$BIN")"; else LINKS="$(ldd "$BIN")"; fi
grep -Eqi 'libssl|libcrypto' <<<"$LINKS" || { echo "TLS check failed: no openssl linkage" >&2; exit 1; }
# Non-TLS builds reject --tls as an unrecognized option; here it must only fail to connect.
ERR="$("$BIN" --tls -h 127.0.0.1 -p 1 ping 2>&1 || true)"
if grep -qi 'unrecognized option\|not built with TLS' <<<"$ERR"; then
  echo "TLS check failed: $ERR" >&2
  exit 1
fi
echo "TLS: OK (openssl linked, --tls accepted)"
echo "Built: $BIN"
