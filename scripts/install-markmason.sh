#!/usr/bin/env bash
set -euo pipefail

version=v0.4.1
root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
destination="$root/.tools/markmason/bin"
binary=mm
extension=tar.gz
case "$(uname -s):$(uname -m)" in
  Linux:x86_64) target=x86_64-unknown-linux-gnu ;;
  Darwin:x86_64) target=x86_64-apple-darwin ;;
  Darwin:arm64) target=aarch64-apple-darwin ;;
  MINGW*:x86_64 | MSYS*:x86_64)
    target=x86_64-pc-windows-msvc
    binary=mm.exe
    extension=zip
    ;;
  *)
    printf 'Unsupported Markmason platform: %s %s\n' "$(uname -s)" "$(uname -m)" >&2
    exit 1
    ;;
esac

archive="markmason-$version-$target.$extension"
temporary=$(mktemp -d)
trap 'rm -f "$temporary/$archive" "$temporary/$archive.sha256" "$temporary/$binary" "$temporary/LICENSE" "$temporary/README.md"; rmdir "$temporary"' EXIT
gh release download "$version" --repo jsturtevant/markmason \
  --pattern "$archive" --pattern "$archive.sha256" --dir "$temporary"
(
  cd "$temporary"
  if command -v sha256sum >/dev/null; then
    sha256sum --check "$archive.sha256"
  else
    shasum -a 256 --check "$archive.sha256"
  fi
)
if [[ "$extension" == zip ]]; then
  MARKMASON_ARCHIVE=$(cygpath -w "$temporary/$archive") \
  MARKMASON_DESTINATION=$(cygpath -w "$temporary") \
    powershell.exe -NoProfile -NonInteractive -Command \
      'Expand-Archive -LiteralPath $env:MARKMASON_ARCHIVE -DestinationPath $env:MARKMASON_DESTINATION'
else
  tar -xzf "$temporary/$archive" -C "$temporary" "$binary"
fi
actual=$("$temporary/$binary" --version)
if [[ "$actual" != "mm ${version#v}" ]]; then
  printf 'Expected mm %s, downloaded %s\n' "${version#v}" "$actual" >&2
  exit 1
fi
mkdir -p "$destination"
install -m 755 "$temporary/$binary" "$destination/$binary"
if [[ -n "${GITHUB_PATH:-}" ]]; then
  if [[ "$extension" == zip ]]; then
    cygpath -w "$destination" >>"$GITHUB_PATH"
  else
    printf '%s\n' "$destination" >>"$GITHUB_PATH"
  fi
fi
printf 'Installed %s in %s\n' "$actual" "$destination"
