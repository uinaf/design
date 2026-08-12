#!/usr/bin/env bash
set -euo pipefail

[[ "$(uname -s)" == "Darwin" ]] || {
  echo "error: slopwake native exports require macOS qlmanage and sips" >&2
  exit 1
}

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source_svg="${repo_root}/assets/products/slopwake/slopwake-app-icon.svg"
if [[ "${1:-}" == "--" ]]; then
  shift
fi
output_root="${1:-${repo_root}/.artifacts/slopwake-native}"
render_root="$(mktemp -d)"
trap 'rm -rf "${render_root}"' EXIT

mkdir -p "${output_root}"
qlmanage -t -s 1024 -o "${render_root}" "${source_svg}" >/dev/null 2>&1
master="${render_root}/slopwake-app-icon.svg.png"
[[ -f "${master}" ]] || {
  echo "error: qlmanage did not render the slopwake app icon" >&2
  exit 1
}

for size in 16 32 128 256 512 1024; do
  sips -z "${size}" "${size}" "${master}" --out "${output_root}/slopwake-app-icon-${size}.png" >/dev/null
done

cp "${repo_root}/assets/products/slopwake/slopwake-menu-idle.svg" "${output_root}/"
cp "${repo_root}/assets/products/slopwake/slopwake-menu-active.svg" "${output_root}/"

echo "slopwake native assets: ${output_root}"
