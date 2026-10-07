# Branding

WebClaw's visual identity descends from [OpenClaw](https://github.com/openclaw/openclaw). The palette, logomark, and avatar glow system are designed to feel like a natural extension of the OpenClaw ecosystem.

## Logo

### Logomark

The primary mark is a geometric claw/shield shape. It reads as both a stylized crab claw and a directional chevron, symbolizing precision and agency.

| Variant | File | Usage |
|:--------|:-----|:------|
| Red (primary) | `branding/logos/logomark_red.png` | Dark backgrounds, hero sections, favicons |
| Lockup (horizontal) | `branding/logos/logo_lockup_red.png` | Headers, presentations, social cards |
| Wordmark | `branding/logos/wordmark_red.png` | When the logomark is already visible nearby |

### Served Assets

The gateway serves logo files at `/static/img/`:

| Path | Size | Usage |
|:-----|:-----|:------|
| `/static/img/logomark.png` | Full | Dashboard sidebar, about pages |
| `/static/img/logo-lockup.png` | Full | Landing pages, presentations |
| `/static/img/wordmark.png` | Full | Text-heavy contexts |
| `/static/img/favicon-16.png` | 16x16 | Browser tab favicon |
| `/static/img/favicon-32.png` | 32x32 | Browser tab favicon (HiDPI) |
| `/static/img/favicon-180.png` | 180x180 | Apple touch icon |
| `/static/img/favicon-192.png` | 192x192 | PWA icon |
| `/static/img/favicon-512.png` | 512x512 | PWA splash, large contexts |

### Extension Icons

The Chrome Extension ships with icons derived from the red favicon:

| File | Size | Context |
|:-----|:-----|:--------|
| `extension/icons/icon16.png` | 16x16 | Toolbar |
| `extension/icons/icon48.png` | 48x48 | Extensions page, popup header |
| `extension/icons/icon128.png` | 128x128 | Chrome Web Store, install dialog |

### Minimum Size

The logomark should not be rendered below 16px. At small sizes, use the simplified favicon variant (flat, no glow).

### Clear Space

Maintain clear space equal to 1x the height of the claw mark on all sides.

## Color Palette

### Primary (from OpenClaw)

The red gradient is inherited directly from OpenClaw's lobster identity (`#FF4D4D` to `#991B1B`).

| Role | Hex | RGB | Usage |
|:-----|:----|:----|:------|
| Primary | `#FF4D4D` | 255, 77, 77 | Logo, accent, interactive elements, avatar glow |
| Primary Light | `#FF7A7A` | 255, 122, 122 | Hover states, highlights |
| Primary Dark | `#CC2A2A` | 204, 42, 42 | Pressed states, active elements |
| Primary Deep | `#991B1B` | 153, 27, 27 | Gradient endpoint, dark accents |

### Secondary & Accent

| Role | Hex | RGB | Usage |
|:-----|:----|:----|:------|
| Teal | `#00E5CC` | 0, 229, 204 | Links, listening state, data visualization |
| Teal Dark | `#00B8A3` | 0, 184, 163 | Hover on teal elements |
| Warm Orange | `#FF6B35` | 255, 107, 53 | CTAs, acting state, notifications |

### Semantic

| Role | Hex | Usage |
|:-----|:----|:------|
| Success | `#00E676` | Connected, confirmed, completed |
| Warning | `#FFB800` | Thinking state, caution |
| Danger | `#FF4757` | Errors, destructive actions |

### Neutrals (Dark Mode)

| Role | Hex | Usage |
|:-----|:----|:------|
| Background | `#0A0A0F` | Page background |
| Surface | `#13131A` | Cards, panels, overlays |
| Surface Elevated | `#1A1A24` | Modals, dropdowns |
| Border | `#2A2A3A` | Dividers, input borders |
| Text | `#F0F0F5` | Primary body text |
| Text Muted | `#8B8BA3` | Secondary text, timestamps |

### Light Mode

| Role | Hex | Usage |
|:-----|:----|:------|
| Background | `#FAFAFE` | Page background |
| Surface | `#FFFFFF` | Cards |
| Border | `#E5E5EC` | Dividers |
| Text | `#0A0A0F` | Body text |

## Avatar Glow States

The animated avatar uses glow colors to communicate its current state:

| State | Color | Hex | Meaning |
|:------|:------|:----|:--------|
| Idle | Red | `#FF4D4D` | Soft pulse, ready for input |
| Listening | Teal | `#00E5CC` | Microphone active, capturing speech |
| Speaking | Bright Red | `#FF7A7A` | Responding with voice |
| Thinking | Amber | `#FFB800` | Processing, generating response |
| Acting | Orange | `#FF6B35` | Executing a DOM action |

These colors are set in `embed/src/avatar.ts` and can be overridden via the `data-color` attribute on the embed script tag (overrides the idle/primary color only).

## Typography

| Role | Font | Weight | Fallback |
|:-----|:-----|:-------|:---------|
| Headings | Inter | 600 (SemiBold) | -apple-system, sans-serif |
| Body | Inter | 400 (Regular) | -apple-system, sans-serif |
| Code | JetBrains Mono | 400 | SF Mono, Fira Code, monospace |

## Embed Script Integration

When site owners add the script tag, they can customize the accent color:

```html
<script src="https://your-gateway.run.app/embed.js"
        data-site-id="your_site_id"
        data-gateway="https://your-gateway.run.app"
        data-color="#FF4D4D">
</script>
```

The default `data-color` is `#FF4D4D`. Site owners may override it to match their own brand, but the WebClaw dashboard and extension always use the canonical red palette.

## Do's and Don'ts

**Do:**
- Use the red logomark on dark backgrounds
- Maintain clear space around the logo
- Use the lockup when both mark and name are needed
- Reference the teal accent for interactive/link elements

**Don't:**
- Stretch or distort the logomark
- Place the red logo on a red or orange background
- Use the cyan (original CellCog) variants in production
- Change the logo colors outside the defined palette

## Source Files

All brand assets live in `branding/`:

```
branding/
├── BRAND_GUIDE.md                  # Quick reference
├── logos/
│   ├── logomark_red.png            # Primary mark (red)
│   ├── logo_lockup_red.png         # Mark + wordmark (red)
│   ├── wordmark_red.png            # Text only (white on dark)
│   ├── logomark_concept_2.png      # Original (cyan, archival)
│   ├── logo_lockup_horizontal.png  # Original (cyan, archival)
│   └── wordmark_dark.png           # Original (cyan, archival)
├── icons/
│   ├── app_icon_red.png            # Rounded square (red)
│   ├── social_avatar_red.png       # Circle (red)
│   ├── chrome_store_icon_red.png   # Chrome Web Store (red)
│   ├── favicon_red.png             # Favicon source (red)
│   ├── app_icon.png                # Original (cyan, archival)
│   ├── social_avatar.png           # Original (cyan, archival)
│   ├── chrome_store_icon.png       # Original (cyan, archival)
│   └── favicon_concept.png         # Original (cyan, archival)
```

## OpenClaw Lineage

| Element | OpenClaw | WebClaw |
|:--------|:---------|:--------|
| Primary gradient | `#FF4D4D` to `#991B1B` | Same |
| Accent | `#00E5CC` (eyes) | `#00E5CC` (teal accent) |
| Background | `#050810` | `#0A0A0F` |
| Mascot | Lobster | Crab claw (geometric) |
