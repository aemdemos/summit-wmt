# Import Validator

Validates import script **parsers** and **transformers** against live URLs. This package contains two validators, both invoked automatically via PostToolUse hooks when relevant files are saved.

## Automatic Validation (Hooks)

- **Parser validator**: Invoked when parser files in `tools/importer/parsers/` are saved. See `../parser-validator-hook.js`.
- **Transformer validator**: Invoked when transformer files in `tools/importer/transformers/` are saved. See `../transformer-validator-hook.js`.

Each hook runs the corresponding validator against a URL from `tools/importer/page-templates.json` and displays the result for review.

## Parser Validator

Validates import script parsers by loading the page in a browser and executing the parser function.

### Manual Usage

```bash
node parser-validator.js <url> <parser-script-path> <page-templates-path>
```

### Examples

**WKND:**
```bash
node parser-validator.js \
  https://www.wknd-trendsetters.site/ \
  ./examples/wknd/accordion-faq.js \
  ./examples/wknd/page-templates.json
```

**Citizens Bank:**
```bash
node parser-validator.js \
  https://www.citizensbank.com/checking/overview.aspx \
  ./examples/citizens-bank/accordion.js \
  ./examples/citizens-bank/page-templates.json
```

### Output

The parser validator outputs a markdown table showing the extracted content, which can be reviewed to verify the parser correctly captures the expected content.

## Transformer Validator

Validates import script transformers by running `beforeTransform` and `afterTransform` with `{ document, template }` and reporting a DOM summary.

### Manual Usage

```bash
node transformer-validator.js <url> <transformer-script-path> <page-templates-path>
```

The URL must match a template in the page-templates file (i.e. the URL must be listed under one of the template’s `urls`).

### Output

The transformer validator prints success/failure and a short summary (e.g. main element child count and innerHTML length before/after) so you can confirm the transformer ran and modified the DOM as expected.

## Dependencies

Install before first use:

```bash
npm install
npx playwright install chromium
```

## Running Tests

```bash
npm test
```

This runs the parser validator test suite against the included example parsers.
