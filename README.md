# Confidential Quote

A local browser demo of loyalty pricing with [Primus FHE](https://github.com/primus-labs/primus-fhe). Try an order below, at, or above the discount threshold and see the decrypted quote.

## Run locally

Install Rust with Cargo, Python 3.8 or newer, and Git. Put this project and the pinned Primus FHE checkout in sibling directories. From the parent directory, prepare the upstream dependency if you do not already have it:

```sh
git clone https://github.com/primus-labs/primus-fhe.git
git -C primus-fhe checkout --detach a3a6aae51bdd02f2879f071bba0f690dd1a71d3b
cd confidential-quote
cargo build --release --locked
python3 serve.py
```

Open [http://127.0.0.1:8765](http://127.0.0.1:8765). The server listens on loopback only. Stop it with Ctrl+C. For a command-line quote, run `./target/release/confidential-quote 2 2` and expect `8`.

## Pricing and data flow

Each item costs $5. A loyalty level of 2 or higher takes $2 off the order. At quantity 2, levels 1, 2, and 3 yield $10, $8, and $8 respectively.

1. The browser sends sample inputs to a helper running on the same device.
2. The Rust client role generates keys and encrypts quantity and loyalty level separately. The evaluation stage combines both ciphertexts into a lookup index using `4 × (quantity − 1) + loyalty level`.
3. The Primus GLWE NTT backend applies the public pricing table using programmable bootstrapping. The client role decrypts the resulting ciphertext and returns the price to the UI.

The browser and local helper exchange plaintext over loopback. The client and evaluator roles share one Rust process. This demo uses upstream experimental parameters, limits quantities to 1–3 and loyalty levels to 0–3, and is intended for synthetic inputs. The decrypted price can reveal discount eligibility to someone who knows the quantity and public policy.

See [Dev Hub project details](DEV-HUB.md) for the listing text and reviewer walkthrough.
