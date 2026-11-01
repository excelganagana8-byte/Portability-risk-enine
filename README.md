# PRE — Portability Risk Engine

### Know what travels with your store.

**Imagine you've spent years building your Shopify store. Hundreds of products, thousands of variants, collections, marketing integrations, SEO rankings, and carefully configured storefront features.**

Now imagine you decide to move to WooCommerce.

You start the migration and suddenly discover that some product data doesn't transfer as expected, your URL structure is different, certain integrations need replacements, and some features require additional plugins or custom development.

Painful, right?

And before even starting the migration, you have to manually inspect the storefront, check URLs, investigate product structures, identify integrations, and audit the features your store depends on.

That means hours of manual investigation, and you could still miss something important.

**That's why I built PRE.**

PRE (Portability Risk Engine) is an evidence-based Shopify storefront assessment tool designed to identify potential portability risks before moving to WooCommerce.

Instead of jumping straight into migration, PRE helps you understand what your storefront contains, what might need attention, and what could require additional work on the destination platform.

---

## What does PRE do?

PRE inspects publicly accessible Shopify storefront data and analyzes technical signals that may affect a potential move to WooCommerce.

### Core capabilities

- **Product Discovery:** Discovers publicly accessible products and product information.
- **Collection Discovery:** Identifies collections through available public endpoints, sitemaps and navigation.
- **Variant Analysis:** Extracts product variants and identifies complex product configurations.
- **Technology Detection:** Identifies publicly observable technologies and storefront dependencies.
- **SEO Observations:** Examines publicly accessible SEO information and URL structures.
- **Portability Findings:** Identifies potential migration complications and explains their WooCommerce implications.
- **Evidence-Based Reporting:** Provides supporting evidence, severity, confidence and recommended investigation.

## What kind of risks can PRE identify?

| Finding | Potential WooCommerce implication |
|---|---|
| Large variant matrices | Variation performance and configuration |
| Multiple product options | Attribute and taxonomy mapping |
| High product tag density | Category and tag restructuring |
| Shopify URL structures | 301 redirect planning |
| Shopify Markets | Multilingual and multi-currency architecture |
| Third-party integrations | Plugin replacements or integration work |

PRE doesn't just flag an issue. It explains why that issue may matter when moving platforms.

## Real storefront testing

PRE has been tested against publicly accessible Shopify storefronts, including:

| Store | Products discovered | Collections discovered | Variants captured |
|---|---:|---:|---:|
| Allbirds | 100 | 50 | 1,087 |
| Gymshark | 10 | 78 | 0 |
| Fable | 67 | 45 | 397 |

These are sample results from individual scans, not verified store-wide inventories.

One interesting example was Gymshark: its public products endpoint returned HTTP 403, while its collections endpoint returned HTTP 404. PRE still discovered products and collections through alternative public sources.

This is important because an inaccessible endpoint shouldn't automatically mean the underlying store data doesn't exist.

## How PRE works

1. Enter a Shopify storefront URL.
2. PRE inspects publicly accessible storefront resources.
3. It discovers available products, collections, variants and technical signals.
4. It analyzes the collected evidence for potential portability risks.
5. It generates a report with findings and WooCommerce-specific considerations.

---

## Getting started

Want to run PRE locally?

### Prerequisites

- Node.js and npm
- Git
- A code editor such as VS Code

### 1. Clone the repository

```bash
git clone https://github.com/excelganagana8-byte/Portability-risk-enine.git
```

### 2. Enter the project directory

```bash
cd Portability-risk-enine
```

### 3. Install dependencies

```bash
npm install
```

### 4. Configure environment variables

Create your local environment file from the provided example.

On Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Open `.env` and configure the required values according to the environment variable descriptions in `.env.example`.

**Never commit your actual `.env` file or expose private credentials.**

### 5. Start the development environment

```bash
npm run dev
```

### 6. Run checks

```bash
npm run typecheck
npm test
npm run build
```

If you encounter setup issues, check the repository documentation and the required environment configuration.

---

## Important limitations

PRE is a public storefront assessment tool, not an internal Shopify store audit.

It does not:
- Access Shopify admin or private merchant data.
- Inspect private apps or internal configurations.
- Access customer records, orders or private checkout settings.
- Guarantee complete product or collection discovery.
- Guarantee that every storefront dependency will be detected.

Discovered counts represent publicly accessible records and samples, not verified store-wide totals.

Findings are preliminary and should be verified with the merchant before an actual migration.

## Project direction

PRE is being developed around a simple idea:

**Understand the risks before attempting the migration.**

The broader vision is to make e-commerce platform transitions more predictable by identifying data structures, dependencies and compatibility considerations before migration begins.

## Open Core

PRE's community codebase is released under the **Apache License 2.0**.

The intention is to make the core useful to developers, encourage contributions and build an ecosystem around storefront portability assessment.

Future commercial services and proprietary extensions may be developed separately.

## Contributing

Contributions, bug reports, feature suggestions and additional storefront test cases are welcome.

If you've encountered a Shopify storefront that PRE struggles to analyze, that feedback is particularly useful.

## License

Apache License 2.0. See [LICENSE](LICENSE) for details.

---

**Built to make the move before the migration.**

PRE — Portability Risk Engine.
