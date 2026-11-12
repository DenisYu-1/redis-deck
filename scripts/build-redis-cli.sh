#!/usr/bin/env bash
# Builds redis-cli (with TLS) from a pinned Redis source tarball for the host arch.
# Output: build/redis-cli/redis-cli   (gitignored), plus .stamp (OS-arch-version);
# a no-op when the stamp already matches, so it is safe to run on every build.
# Needs: curl, tar, make, cc, openssl dev headers (macOS: brew install openssl@3;
# Linux: apt install libssl-dev patchelf).
set -euo pipefail

REDIS_VERSION="${REDIS_VERSION:-7.2.5}" # the single place the version is pinned
REDIS_SHA256="${REDIS_SHA256:-5981179706f8391f03be91d951acafaeda91af7fac56beffb2701963103e423d}"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT_DIR="$ROOT/build/redis-cli"
# Stamp of what is in OUT_DIR; a different arch or REDIS_VERSION forces a rebuild.
STAMP="$OUT_DIR/.stamp"
WANT="$(uname -s)-$(uname -m)-redis-$REDIS_VERSION"
if [[ -x "$OUT_DIR/redis-cli" && -f "$STAMP" && "$(cat "$STAMP")" == "$WANT" ]]; then
  echo "==> redis-cli up to date ($WANT), skipping build"
  exit 0
fi
rm -rf "$OUT_DIR"
WORK="$(mktemp -d "${TMPDIR:-/tmp}/redis-cli-build.XXXXXX")"
trap 'rm -rf "$WORK"' EXIT

if [[ "$(uname)" == "Darwin" && -z "${OPENSSL_PREFIX:-}" ]]; then
  OPENSSL_PREFIX="$(brew --prefix openssl@3 2>/dev/null || true)"
fi

echo "==> Downloading redis-$REDIS_VERSION"
curl -fsSL "https://download.redis.io/releases/redis-$REDIS_VERSION.tar.gz" -o "$WORK/redis.tar.gz"
echo "$REDIS_SHA256  $WORK/redis.tar.gz" | (sha256sum -c - 2>/dev/null || shasum -a 256 -c -) >/dev/null \
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

if [[ "$(uname)" == "Darwin" ]]; then
  # Make the binary self-contained: copy the OpenSSL dylibs next to it and point
  # every reference at @executable_path, so no Homebrew path is needed at runtime.
  echo "==> Bundling OpenSSL dylibs"
  for dep in $(otool -L "$BIN" | awk 'NR>1 {print $1}' | grep -E '/lib(ssl|crypto)\.[0-9.]*dylib$'); do
    name="$(basename "$dep")"
    cp -f "$dep" "$OUT_DIR/$name"
    chmod u+w "$OUT_DIR/$name"
    install_name_tool -id "@executable_path/$name" "$OUT_DIR/$name"
    install_name_tool -change "$dep" "@executable_path/$name" "$BIN"
  done
  # libssl references libcrypto by absolute path too.
  for lib in "$OUT_DIR"/*.dylib; do
    for dep in $(otool -L "$lib" | awk 'NR>1 {print $1}' | grep -E '^/(opt|usr/local)/'); do
      install_name_tool -change "$dep" "@executable_path/$(basename "$dep")" "$lib"
    done
    codesign --force --sign - "$lib" >/dev/null 2>&1
  done
  codesign --force --sign - "$BIN" >/dev/null 2>&1
  if otool -L "$BIN" "$OUT_DIR"/*.dylib | grep -Eq '/opt/|/usr/local/'; then
    echo "Self-containment check failed: non-system dylib refs remain" >&2
    otool -L "$BIN" "$OUT_DIR"/*.dylib >&2
    exit 1
  fi
fi

if [[ "$(uname)" == "Linux" ]]; then
  # Self-contained: copy libssl/libcrypto next to the binary and make every lookup
  # use $ORIGIN, so the target machine needs no matching OpenSSL (only glibc).
  echo "==> Bundling OpenSSL shared libs"
  command -v patchelf >/dev/null || { echo "patchelf not found (apt install patchelf)" >&2; exit 1; }
  for dep in $(ldd "$BIN" | awk '/lib(ssl|crypto)\.so/ {print $3}'); do
    cp -fL "$dep" "$OUT_DIR/$(basename "$dep")"
  done
  for f in "$BIN" "$OUT_DIR"/*.so*; do
    patchelf --set-rpath '$ORIGIN' "$f"
  done
  if ldd "$BIN" | grep -E 'lib(ssl|crypto)\.so' | grep -vq "$OUT_DIR"; then
    echo "Self-containment check failed: openssl not resolved from $OUT_DIR" >&2
    ldd "$BIN" >&2
    exit 1
  fi
fi

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
echo "$WANT" >"$STAMP"
echo "Built: $BIN ($WANT)"
