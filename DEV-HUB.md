# Confidential Quote · Dev Hub project details

**Project name** — Confidential Quote

**Category** — Confidential computing / applied cryptography

**Short description** — An interactive local demo that uses Primus FHE to calculate loyalty discounts over encrypted inputs.

**Project description** — Confidential Quote demonstrates a merchant pricing rule evaluated on encrypted order quantity and loyalty level. The Rust helper encrypts both inputs, applies the public pricing policy through Primus TFHE programmable bootstrapping, and decrypts the resulting price for the user. The browser demo includes presets below, at, and above the loyalty threshold. It uses synthetic data and runs locally with experimental Primus FHE parameters.

**Primus integration** — Rust `primus_tfhe_glwe_ntt` and `primus_ntt`, pinned to upstream commit `a3a6aae`.

**Reviewer walkthrough** — Follow the [README](README.md), then try each threshold preset. With quantity 2, the expected outputs are $10 below the threshold and $8 at or above it.

**Listing links** — Add the source repository URL after publishing it. Use a demo recording if a public browser link is required for review. The current browser app needs a native helper on the same device.

**zkTLS template** — Sandbox Loyalty Level, `0a254030-f3b4-4b2d-8b43-189269d63e85`. The Dev Hub test returned `loyaltyLevel = 2`. See the README for the local SDK flow and configuration.
