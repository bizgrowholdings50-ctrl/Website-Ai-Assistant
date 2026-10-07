# WebClaw Brand Guide

## Lineage
WebClaw is built on **OpenClaw**. The branding reflects that heritage: red-leaning tones inspired by OpenClaw's lobster gradient (`#ff4d4d` → `#991b1b`), with teal accents carried from the OpenClaw eye color (`#00e5cc`).

## Logomark
A geometric claw/shield mark. The core shape (from CellCog generation) is retained but recolored to the WebClaw red palette.

## Color Palette

### Primary (Red family, from OpenClaw)

| Role | Hex | Usage |
|:-----|:----|:------|
| **Primary** | `#FF4D4D` | Logo, accent, interactive elements, avatar glow |
| **Primary Light** | `#FF7A7A` | Hover states, highlights |
| **Primary Dark** | `#CC2A2A` | Pressed states, active elements |
| **Primary Deep** | `#991B1B` | Gradient endpoint, dark accents |

### Secondary & Accent

| Role | Hex | Usage |
|:-----|:----|:------|
| **Teal Accent** | `#00E5CC` | Eye highlights, success states, links, data viz |
| **Teal Dark** | `#00B8A3` | Hover on teal elements |
| **Warm Orange** | `#FF6B35` | CTAs, notifications, warm highlights |

### Semantic

| Role | Hex | Usage |
|:-----|:----|:------|
| **Success** | `#00E676` | Confirmations, connected status |
| **Warning** | `#FFB800` | Caution states |
| **Danger** | `#FF4757` | Errors, destructive actions |

### Neutrals (Dark mode native)

| Role | Hex | Usage |
|:-----|:----|:------|
| **BG Dark** | `#0A0A0F` | Primary background |
| **Surface** | `#13131A` | Cards, panels, overlays |
| **Surface Elevated** | `#1A1A24` | Modals, dropdowns |
| **Border** | `#2A2A3A` | Dividers, input borders |
| **Text Primary** | `#F0F0F5` | Body text |
| **Text Muted** | `#8B8BA3` | Secondary text, labels, timestamps |

### Light Mode

| Role | Hex | Usage |
|:-----|:----|:------|
| **BG Light** | `#FAFAFE` | Primary background |
| **Surface Light** | `#FFFFFF` | Cards |
| **Border Light** | `#E5E5EC` | Dividers |
| **Text Light** | `#0A0A0F` | Body text |

## Avatar Glow Colors (by state)

| State | Color | Description |
|:------|:------|:------------|
| Idle | `#FF4D4D` | Soft red pulse |
| Listening | `#00E5CC` | Teal (mic active) |
| Speaking | `#FF7A7A` | Bright red (animated) |
| Thinking | `#FFB800` | Amber pulse |
| Acting | `#FF6B35` | Orange (executing DOM action) |

## Typography

| Role | Font | Weight |
|:-----|:-----|:-------|
| Headings | Inter | 600 (SemiBold) |
| Body | Inter | 400 (Regular) |
| Code / Metrics | JetBrains Mono | 400 |

## Logo Usage

- **On dark backgrounds**: Primary red `#FF4D4D` or gradient `#FF4D4D` → `#991B1B`
- **On light backgrounds**: Deep red `#991B1B` solid
- **Minimum size**: 16px (favicon uses simplified flat version)
- **Clear space**: 1x the height of the claw mark on all sides

## Assets

```
branding/
├── logos/
│   ├── logomark_concept_2.png      # Primary logomark (cyan, original)
│   ├── wordmark_dark.png           # Wordmark on dark bg (original)
│   └── logo_lockup_horizontal.png  # Mark + wordmark combo (original)
├── icons/
│   ├── app_icon.png                # Rounded square (original)
│   ├── social_avatar.png           # Circle with gradient (original)
│   ├── chrome_store_icon.png       # Chrome Web Store icon (original)
│   └── favicon_concept.png         # Favicon concept (original)
└── BRAND_GUIDE.md                  # This file
```

> **Note**: Current image assets use the CellCog-generated cyan (`#00D4FF`) colorway.
> These need to be recolored to the red palette above. The claw shape is correct;
> swap cyan → `#FF4D4D` and the subtle violet gradient → `#991B1B`.

## Emoji
🦀

## OpenClaw Reference
- OpenClaw gradient: `#ff4d4d` → `#991b1b`
- OpenClaw eyes: `#00e5cc` (teal)
- OpenClaw bg: `#050810`
- Source: OpenClaw favicon.svg

## Attribution
Logo shapes generated via CellCog, March 2026. Color system derived from OpenClaw branding.
