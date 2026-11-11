# Confidential Quote · Dev Hub project details

**Project name** — Confidential Quote

**Category** — Confidential computing / applied cryptography

**Short description** — An interactive local demo that uses Primus FHE to calculate loyalty discounts over encrypted inputs.

**Project description** — Confidential Quote makes a small merchant pricing rule inspectable end to end. Visitors can calculate a synthetic quote, or use the official Primus extension to attest to a loyalty value from the project’s public sandbox fixture. The server checks the attestation signature, requested source and method, freshness window, and value range before it uses the tier in a quote. The Rust helper evaluates the pricing rule with Primus TFHE. After verification, the page shows the exact claim, fixture host, verification time, and template ID. This proof confirms only what the public fixture served; it does not establish a visitor’s identity, account ownership, or real customer status. Hosted quote inputs are synthetic and processed by the server.

**Primus integration** — Rust `primus_tfhe_glwe_ntt` and `primus_ntt`, pinned to upstream commit `a3a6aae`.

**Reviewer walkthrough** — Open the [live app](https://confidential-quote.vercel.app/), choose a sample preset, then select **Verify sandbox tier and quote** in Chrome with the Primus extension. Enter the reviewer access code supplied privately. The app displays the verified fixture claim and quote metadata. With quantity 2, the fixture’s tier 2 returns $8. The proof is public synthetic data, not the reviewer’s personal loyalty record.

**Listing links** — [Live app](https://confidential-quote.vercel.app/) · [GitHub source](https://github.com/vlsss12/confidential-quote) · [X profile](https://x.com/vlsss12).

**zkTLS template** — Sandbox Loyalty Level, `0a254030-f3b4-4b2d-8b43-189269d63e85`. The Dev Hub test returned `loyaltyLevel = 2`. The fixture is served from the project’s public GitHub Pages URL and can be read by anyone. See the README for SDK flow, configuration, and trust boundaries.
