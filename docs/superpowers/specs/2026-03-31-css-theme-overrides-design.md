# CSS Theme Overrides + YAML Config Migration

**Date:** 2026-03-31
**Status:** Draft

## Summary

Add user-customizable CSS theming via a `customCss` field in config, and migrate the config format from `docdog.config.json` to `docdog.yaml`.

## Config Migration: JSON to YAML

### What changes

- Config file: `docdog.config.json` → `docdog.yaml`
- Parser: `JSON.parse` → `yaml.parse` (using existing `yaml` v2 dependency)
- Same Zod schema validation after parsing
- New optional field: `customCss`

### New schema

```yaml
name: Chop-Chop              # required — site name in navbar
docsDir: ./docs               # optional, default ./docs
logo:
  image: ./images/logo.svg    # optional — logo image path
customCss: ./theme-overrides.css  # optional — path to custom CSS file
```

### Zod schema change

```typescript
const ConfigSchema = z.object({
  name: z.string(),
  docsDir: z.string().default('./docs'),
  logo: z.object({ image: z.string() }).optional(),
  customCss: z.string().optional(),
})
```

### Config type change

```typescript
export type Config = {
  name: string
  docsDir: string
  logo?: { image: string }
  customCss?: string  // absolute path, resolved from CWD
}
```

### Path resolution

`customCss` is resolved to an absolute path in `loadConfig()`, same as `docsDir` and `logo.image`:

```typescript
customCss: parsed.customCss ? path.resolve(cwd, parsed.customCss) : undefined
```

### Error handling

- If `customCss` is set but the file doesn't exist: `console.warn()` and proceed without custom CSS (don't crash)
- If the file exists but is empty: treat as no custom CSS (no-op)

## CSS Concatenation Strategy

### Merge approach

Concatenate default CSS + custom CSS into a single output:

```
[contents of src/templates/style.css]
\n/* custom overrides */\n
[contents of customCss file]
```

The CSS cascade ensures custom rules override defaults naturally. Users can:
- Override CSS custom properties (`:root { --accent: red; }`)
- Override any selector with equal or higher specificity
- Add entirely new styles

### No HTML template changes

The `<link rel="stylesheet" href="/style.css">` stays as-is. The concatenated CSS is served/written as a single `style.css`.

## Files Changed

### `src/types.ts`

Add `customCss?: string` to `Config` type.

### `src/core/config.ts`

1. Import `yaml` package
2. Look for `docdog.yaml` instead of `docdog.config.json`
3. Parse with `yaml.parse()` instead of `JSON.parse()`
4. Add `customCss` to Zod schema (optional string)
5. Resolve `customCss` path in return value

### `src/core/css.ts` (new file)

Single function to build the combined CSS:

```typescript
export function buildCss(customCssPath?: string): string
```

- Reads default `style.css` from `STYLE_PATH`
- If `customCssPath` is set and file exists, appends custom CSS
- If file doesn't exist, warns and returns default only
- Returns concatenated string

This centralizes CSS assembly so both dev-server and build use the same logic.

### `src/commands/build.ts`

- Replace direct `fs.readFileSync(STYLE_PATH)` with `buildCss(config.customCss)`
- Minify the combined CSS, write to `dist/style.css`
- If `customCss` file exists, copy it is NOT needed (it's already concatenated)

### `src/server/dev-server.ts`

- Replace `fs.readFileSync(STYLE_PATH)` with `buildCss(config.customCss)`
- The function is called on each request, so CSS changes are picked up on refresh
- The chokidar watcher in `src/commands/preview.ts` should also watch the custom CSS file for live reload

### `src/commands/preview.ts`

- If `config.customCss` is set, add it to the chokidar watch list so live reload triggers on custom CSS changes

### `example/docdog.config.json` → `example/docdog.yaml`

Delete `docdog.config.json`, create `docdog.yaml`:

```yaml
name: Chop-Chop
docsDir: ./docs
logo:
  image: ./images/logo.svg
customCss: ./theme-overrides.css
```

### `example/docs/docdog.yaml` (delete)

This unused file predates the config system and should be removed to avoid confusion with the new `example/docdog.yaml`.

### `example/theme-overrides.css` (new file)

Sample override demonstrating CSS custom property overrides:

```css
:root {
  --accent: #e11d48;
}
```

### Tests

- Update existing config tests to use YAML format
- Test: config with `customCss` resolves path correctly
- Test: missing `customCss` file warns but doesn't crash
- Test: `buildCss()` concatenates correctly
- Test: `buildCss()` without customCss returns default only

## What this does NOT do

- No new CLI flags
- No inline `<style>` injection
- No separate CSS file in output
- No OpenAPI support (future scope)
- No plugin system
- No config auto-migration from JSON to YAML
