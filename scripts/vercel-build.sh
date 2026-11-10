#!/usr/bin/env bash
set -euo pipefail
npm run build
if ! command -v cargo >/dev/null; then
  curl --proto '=https' --tlsv1.2 -fsS https://sh.rustup.rs | sh -s -- -y --profile minimal
  source "$HOME/.cargo/env"
fi
build_dir="$(mktemp -d)"
trap 'rm -rf "$build_dir"' EXIT
mkdir "$build_dir/app"
cp Cargo.toml Cargo.lock "$build_dir/app/"
cp -R src "$build_dir/app/"
git init -q "$build_dir/primus-fhe"
git -C "$build_dir/primus-fhe" fetch -q --depth 1 https://github.com/primus-labs/primus-fhe.git a3a6aae51bdd02f2879f071bba0f690dd1a71d3b
git -C "$build_dir/primus-fhe" checkout -q --detach FETCH_HEAD
# Rust versions before integer bit_width stabilized need the equivalent expression.
sed -i.bak 's/<\$t>::bit_width(self)/<\$t>::BITS - self.leading_zeros()/'   "$build_dir/primus-fhe/crates/primus_integer/src/unsigned_integer.rs"
cargo build --manifest-path "$build_dir/app/Cargo.toml" --release --locked
test "$("$build_dir/app/target/release/confidential-quote" 2 2)" = 8
mkdir -p runtime
install -m 755 "$build_dir/app/target/release/confidential-quote" runtime/confidential-quote
