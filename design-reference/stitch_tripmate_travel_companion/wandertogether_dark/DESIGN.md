---
name: Wandertogether Dark
colors:
  surface: '#141310'
  surface-dim: '#141310'
  surface-bright: '#3b3935'
  surface-container-lowest: '#0f0e0b'
  surface-container-low: '#1d1b18'
  surface-container: '#211f1c'
  surface-container-high: '#2b2a27'
  surface-container-highest: '#363531'
  on-surface: '#e6e2dc'
  on-surface-variant: '#bdc9c4'
  inverse-surface: '#e6e2dc'
  inverse-on-surface: '#32302d'
  outline: '#88938e'
  outline-variant: '#3e4945'
  surface-tint: '#7fd7be'
  primary: '#7fd7be'
  on-primary: '#00382d'
  primary-container: '#4da68f'
  on-primary-container: '#00372c'
  inverse-primary: '#006b58'
  secondary: '#ffb4a1'
  on-secondary: '#5d1805'
  secondary-container: '#7f301b'
  on-secondary-container: '#ffa087'
  tertiary: '#e9c349'
  on-tertiary: '#3c2f00'
  tertiary-container: '#cca72f'
  on-tertiary-container: '#4e3d00'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#9bf3d9'
  primary-fixed-dim: '#7fd7be'
  on-primary-fixed: '#002019'
  on-primary-fixed-variant: '#005142'
  secondary-fixed: '#ffdbd2'
  secondary-fixed-dim: '#ffb4a1'
  on-secondary-fixed: '#3c0800'
  on-secondary-fixed-variant: '#7c2e19'
  tertiary-fixed: '#ffe088'
  tertiary-fixed-dim: '#e9c349'
  on-tertiary-fixed: '#241a00'
  on-tertiary-fixed-variant: '#574500'
  background: '#141310'
  on-background: '#e6e2dc'
  surface-variant: '#363531'
typography:
  display-lg:
    fontFamily: Fraunces
    fontSize: 48px
    fontWeight: '600'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Fraunces
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
  headline-lg-mobile:
    fontFamily: Fraunces
    fontSize: 28px
    fontWeight: '600'
    lineHeight: 36px
  headline-md:
    fontFamily: Fraunces
    fontSize: 24px
    fontWeight: '500'
    lineHeight: 32px
  body-lg:
    fontFamily: Hanken Grotesk
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Hanken Grotesk
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-md:
    fontFamily: Hanken Grotesk
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0.01em
  caption:
    fontFamily: Hanken Grotesk
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 8px
  xs: 4px
  sm: 12px
  md: 24px
  lg: 40px
  xl: 64px
  gutter: 16px
  margin-mobile: 16px
  margin-desktop: 48px
---

## Brand & Style
This design system adapts the core travel journal aesthetic into a refined dark mode experience. It maintains the character of an analog field notes journal, reimagined for evening use or low-light environments. The personality is adventurous yet grounded, evoking the feeling of planning a journey by candlelight.

The design style is **Minimalist / Tactile**, utilizing subtle tonal layering instead of aggressive shadows. It avoids the harshness of pure black, opting instead for deep, ink-inspired charcoals and warm, paper-adjacent typography to ensure long-form readability and a premium, curated feel.

## Colors
The palette is built on a "Deep Ink" foundation. The background uses a charcoal base with a slight warm undertone to prevent visual fatigue. 

- **Primary (Pine Green):** Used for main actions and active states, calibrated for high legibility against dark surfaces.
- **Secondary (Terracotta):** Reserved for alerts, highlights, and emotive callouts.
- **Tertiary (Muted Gold):** Used for rewards, "featured" badges, and specialized journal entries.
- **Neutral (Ink & Taupe):** Text hierarchy is established through the contrast between the warm off-white "Ink" and the muted "Taupe-grey" for secondary information.

## Typography
The typographic system pair the literary, high-personality **Fraunces** for headings with the functional, contemporary **Hanken Grotesk** for interface elements and body copy.

Headings should utilize the variable weight capabilities of Fraunces to emphasize a "journaled" look, often appearing in semi-bold weights. Body text is set with generous line-height to maintain an open, readable feel against the dark background. Capitalization should be used sparingly for labels to maintain a friendly, approachable tone.

## Layout & Spacing
The layout follows a **Fixed Grid** philosophy on desktop (max-width 1200px) to simulate the bounded edges of a physical book or journal. On mobile, it transitions to a fluid 4-column system.

- **Desktop:** 12-column grid, 24px gutters, 48px margins.
- **Tablet:** 8-column grid, 16px gutters, 32px margins.
- **Mobile:** 4-column grid, 16px gutters, 16px margins.

The spacing rhythm is based on an 8px baseline, ensuring all components and vertical rhythms feel intentional and structured.

## Elevation & Depth
In this dark variant, depth is achieved through **Tonal Layers** and subtle "Ghost Outlines" rather than traditional shadows.

1.  **Base (Level 0):** The deep charcoal (#1A1916) background.
2.  **Surface (Level 1):** The secondary charcoal (#24231F) for cards and container elements.
3.  **Raised (Level 2):** For interactive components like buttons or hovering cards, use a 1px border of #F2ECE0 at 10% opacity (a soft "ink stroke") to define the edge.
4.  **Overlay:** Modals use a slightly more opaque version of the surface color with a 20px backdrop blur to maintain focus on the travel content behind.

## Shapes
Shapes are defined by generous, approachable curves that feel organic. 

- **Standard Containers:** Use 0.5rem (8px) for cards and large sections.
- **Buttons and Chips:** Use 1rem (16px) or 1.5rem (24px) for a "pebble" or "pill" feel that invites interaction.
- **Media (Photos):** Images of destinations should always feature the standard 8px corner radius to match the container language, reinforcing the "scrapbook" aesthetic.

## Components
- **Buttons:** Primary buttons use the Pine Green fill with the Deep Ink text. Secondary buttons are outlined with the warm off-white stroke.
- **Input Fields:** Use the Surface-container color (#24231F) as a fill with a 1px bottom border in Muted Taupe to mimic a lined journal page.
- **Cards:** Defined by the surface-container color. They should not have shadows; instead, use a subtle 1px border (#F2ECE0 at 5% opacity) for separation.
- **Chips:** Small, pill-shaped tags used for travel categories (e.g., "Hiking", "Cafes"). Use the Muted Gold for active/selected tags.
- **Lists:** Separated by thin, horizontal dividers in #9E998E at 20% opacity.
- **Checkboxes:** Custom rounded squares that, when checked, fill with Pine Green and show a hand-drawn style checkmark in the background color.