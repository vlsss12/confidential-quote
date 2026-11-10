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

## Verify the sandbox tier with Primus zkTLS

The private Dev Hub template **Sandbox Loyalty Level** extracts `$.loyaltyLevel` from the [public synthetic fixture](https://vlsss12.github.io/confidential-quote/fixtures/). The verification demonstrates the value served by that fixture.

Install Node.js and the official Primus extension in Chrome. In the project directory, run `npm ci` and `npm run build`. Build the Rust helper as above. Set `CONFIDENTIAL_QUOTE_PRIMUS_SECRET` in the local server process to the app secret for **Confidential Quote**. For example, in zsh:

```zsh
read -rs 'CONFIDENTIAL_QUOTE_PRIMUS_SECRET?Primus app secret: '
export CONFIDENTIAL_QUOTE_PRIMUS_SECRET
python3 serve.py
```

Open the local app in Chrome and choose **Verify sandbox tier and quote**. The local server signs a request for the fixed template, the browser SDK starts the attestation, and the server checks the signature, source URL, freshness, and tier before invoking Rust. A verified tier of 2 produces an $8 quote for two items. The public sandbox value is reusable within the freshness window and represents synthetic data, independent of the viewer’s identity.

## Deploy on Vercel

Deploy this directory as a separate Vercel project. Vercel builds the pinned Primus Rust engine for Linux and bundles it with the quote function. Visitors can compute sample quotes with synthetic inputs. The hosted helper receives those inputs and decrypts the resulting price before returning it to the browser.

For the optional live zkTLS flow, set these two variables under **Settings → Environment Variables** for the deployment, then redeploy:

- `CONFIDENTIAL_QUOTE_PRIMUS_SECRET` holds the Secret Key for the configured Primus application.
- `CONFIDENTIAL_QUOTE_ACCESS_CODE` is a separate random reviewer code of at least 24 characters. Share this code with reviewers through a private channel. Never use the Primus Secret Key as the reviewer code.

On the deployed site, use Chrome with the Primus extension, enter the reviewer code, then select **Verify sandbox tier and quote**.

## Store checkout pilot

Call `POST /store/quote` from the store backend after authenticating the customer and looking up their cart. The request accepts a JSON object with exactly `sku` and `quantity`. The pilot supports `loyalty-item` and quantities 1 to 3. The FHE engine owns the pricing rule: USD 5 per item and USD 2 off the order at loyalty tier 2 or higher.

The store backend sends `Authorization: Bearer <credential>`. Provision one randomly generated 32-byte credential per pilot account, encoded as lowercase hex. Keep the raw credential in the store backend. Configure `CONFIDENTIAL_QUOTE_STORE_MEMBERS` on the quote server as a JSON object mapping the lowercase SHA-256 hash of each credential string to its tier (0–3). Replace the credential by replacing its hash in the configuration. Leave the variable unset to disable this route.

An accepted response includes `sku`, `quantity`, `currency`, and `totalCents`. For two items, the total is 1000 cents at tier 1 and 800 cents at tier 2. Recompute the quote from the authoritative cart before charging. For a live store, replace the pilot member mapping with the store's account integration and connect checkout through the store backend. This pilot uses the existing FHE engine, which encrypts and decrypts inside one server-side process.
