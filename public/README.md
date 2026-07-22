# web-cal favicon suite

Flat, geometric calendar-card mark: a three-segment header strip (indigo / terracotta / sage)
signals "themeable," two binder-ring tabs read as a classic calendar, and one highlighted
"today" cell repeats the terracotta accent. Colors are muted on purpose — no saturated
brights — so the mark sits quietly next to shadcn/ui product icons.

## Files

- `icon.svg` — master vector icon, any size
- `favicon-16x16.png`, `favicon-32x32.png`, `favicon-48x48.png` — browser tab favicons
- `favicon.ico` — bundles the 16/32/48 PNGs for legacy `<link rel="icon">` / IE support
- `icon-192.png`, `icon-512.png` — PWA / manifest icons
- `apple-touch-icon.png` (180×180) — opaque white background, no transparency, per Apple's requirement
- `site.webmanifest` — references the 192/512 PNGs, `theme_color` `#1E1B4B`, `background_color` `#FFFFFF`

## Install

Already wired up via the Metadata API (Option B below) in [src/app/layout.tsx](../src/app/layout.tsx).

## Wire-up

### Option A — static files + `<head>` tags

If you'd rather not use the Metadata API, drop this in your root layout's `<head>`:

```html
<link rel="icon" href="/favicon.ico" sizes="any" />
<link rel="icon" href="/icon.svg" type="image/svg+xml" />
<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
<link rel="manifest" href="/site.webmanifest" />
<meta name="theme-color" content="#1E1B4B" />
```

### Option B — Next.js Metadata API (recommended, App Router)

In `app/layout.tsx`:

```ts
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "web-cal",
  manifest: "/site.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
  themeColor: "#1E1B4B",
};
```

Next.js also auto-detects `app/favicon.ico`, `app/icon.svg`, and `app/apple-icon.png` if you
prefer file-convention routing over the Metadata API — just move the corresponding files into
`app/` instead of `public/` and drop the matching entries above.

## Colors

| Role | Hex |
|---|---|
| Outline / rings | `#1E1B4B` |
| Header — indigo segment | `#9CA3D4` |
| Header — terracotta segment | `#E3A972` |
| Header — sage segment | `#8FBF9F` |
| Card body | `#FFFFFF` |
| Grid dots | `#E4E6F5` |
| "Today" cell | `#E3A972` |
