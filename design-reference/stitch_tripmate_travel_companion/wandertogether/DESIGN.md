---
name: Wandertogether
colors:
  surface: '#fff9ed'
  surface-dim: '#dfd9ce'
  surface-bright: '#fff9ed'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f9f3e7'
  surface-container: '#f3ede1'
  surface-container-high: '#ede8dc'
  surface-container-highest: '#e8e2d6'
  on-surface: '#1d1c14'
  on-surface-variant: '#404945'
  inverse-surface: '#333028'
  inverse-on-surface: '#f6f0e4'
  outline: '#717975'
  outline-variant: '#c0c8c3'
  surface-tint: '#3a6758'
  primary: '#023629'
  on-primary: '#ffffff'
  primary-container: '#1f4d3f'
  on-primary-container: '#8dbdab'
  inverse-primary: '#a1d1be'
  secondary: '#a04018'
  on-secondary: '#ffffff'
  secondary-container: '#ff8759'
  on-secondary-container: '#712300'
  tertiary: '#422b00'
  on-tertiary: '#ffffff'
  tertiary-container: '#5f3f00'
  on-tertiary-container: '#ddaa59'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#bcedda'
  primary-fixed-dim: '#a1d1be'
  on-primary-fixed: '#002118'
  on-primary-fixed-variant: '#214f41'
  secondary-fixed: '#ffdbcf'
  secondary-fixed-dim: '#ffb59a'
  on-secondary-fixed: '#380d00'
  on-secondary-fixed-variant: '#802901'
  tertiary-fixed: '#ffddaf'
  tertiary-fixed-dim: '#f3be6a'
  on-tertiary-fixed: '#281800'
  on-tertiary-fixed-variant: '#614000'
  background: '#fff9ed'
  on-background: '#1d1c14'
  surface-variant: '#e8e2d6'
  ink-text: '#211F1A'
  muted-text: '#5E594E'
  card-cream: '#FCFAF4'
  border-warm-grey: '#D9D4CB'
  ai-sage-tint: '#E8F0EA'
typography:
  display:
    fontFamily: Fraunces
    fontSize: 40px
    fontWeight: '700'
    lineHeight: 48px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Fraunces
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
  headline-md:
    fontFamily: Fraunces
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  headline-sm:
    fontFamily: Fraunces
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
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
  body-sm:
    fontFamily: Hanken Grotesk
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-caps:
    fontFamily: Hanken Grotesk
    fontSize: 12px
    fontWeight: '700'
    lineHeight: 16px
    letterSpacing: 0.05em
  mono-price:
    fontFamily: Hanken Grotesk
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 8px
  container-padding: 20px
  gutter: 16px
  stack-sm: 12px
  stack-md: 24px
  stack-lg: 40px
---

## Brand & Style
The brand personality is **refined, friendly, and slightly analog**, capturing the essence of a beautifully curated travel journal rather than a sterile utility app. It caters to groups who value shared experiences and thoughtful planning, evoking a sense of warmth, anticipation, and collaboration.

The design style is **Modern Editorial with Tactile influences**. It utilizes generous whitespace, sophisticated serif typography, and a "paper-and-ink" color philosophy. Key characteristics include:
- **Analog Textures:** High-contrast, near-black ink on warm off-white paper backgrounds.
- **Journalistic Layout:** Large, characterful headings and structured, readable body copy.
- **Subtle Depth:** Soft shadows and thin borders that suggest layered paper rather than digital elevation.
- **Human-Centric AI:** AI interventions are styled as gentle "notations" or "drafts" on the page, maintaining the organic feel of the travel journal.

## Colors
The palette is rooted in natural, earthy tones that reinforce the "journal" aesthetic.
- **Primary (Pine Green):** Used for "locked" states, confirmed actions, and primary buttons. It signifies stability and progress.
- **Secondary (Terracotta):** Used for "open" items, active proposals, alerts, and accents. It draws attention to things requiring group participation.
- **Tertiary (Muted Gold):** Reserved for "maybe" states or tentative information, providing a soft middle ground.
- **Surface Strategy:** The main background uses a warm paper tone (#F2ECE0). Cards use a lighter cream (#FCFAF4) to create a subtle lift, defined by thin warm-grey borders rather than heavy shadows.
- **Typography:** Use the near-black "ink" for primary readability and the muted grey-brown for secondary metadata.

## Typography
The typographic system creates an editorial rhythm by pairing a characterful serif for structure and a clean humanist grotesk for utility.
- **Serif (Fraunces):** Use for headlines, trip titles, and large numbers that need personality. It provides the "editorial" voice of the app.
- **Grotesk (Hanken Grotesk):** Use for body copy, labels, and form inputs. It ensures high legibility and a modern touch.
- **Tabular Numbers:** Always use tabular spacing for currency and dates within the Money and Itinerary views to maintain vertical alignment in lists.
- **Scale:** On mobile, prioritize vertical breathing room; headings should feel substantial but never crowded.

## Layout & Spacing
The layout follows a **Fixed Grid** philosophy optimized for a 390px mobile width. 
- **Rhythm:** A 12-column grid with 20px outer margins and 16px gutters.
- **Breathing Room:** High emphasis on vertical white space between sections (stack-lg) to evoke a premium, unhurried journal feel.
- **Structure:** Content is primarily organized into full-width or inset cards. 
- **Reflow:** On tablets, the layout expands to a multi-column view where the "Chat Lane" can persist alongside "Plan" or "Money" views, but for mobile, it remains a focused single-column experience.

## Elevation & Depth
Depth is achieved through **Tonal Layers** and **Low-contrast Outlines** rather than aggressive shadows.
- **The "Paper" Stack:** The background is the bottom layer. Cards (soft cream) sit on top, delineated by a 1px border (#D9D4CB).
- **Shadows:** When used for primary cards or floating buttons, shadows must be extremely soft, diffused, and slightly tinted with the paper color (e.g., a low-opacity warm-brown shadow) to avoid a "plastic" look.
- **AI Layers:** AI-generated content (sage-tinted cards) should appear as if they are pinned or clipped onto the main journal, using the same border weight but a distinct background tint.

## Shapes
The shape language is **Rounded**, leaning towards a soft, approachable feel. 
- **Standard Corners:** 14px–18px for main cards and containers.
- **Interactive Elements:** Buttons and input fields should follow the same 14px–18px radius to maintain consistency.
- **Pills:** Used for status tags, chips, and the invite link container to differentiate them from structural cards.

## Components
- **Buttons:** 
    - *Primary:* Solid Pine Green (#1F4D3F) with Cream text. 
    - *Secondary/Ghost:* Warm-grey border with Ink text.
    - *Alert:* Terracotta (#C2592F) used sparingly for destructive or urgent actions.
- **Cards:** Soft cream background, 1px warm-grey border, 16px corner radius. Internal padding should be a generous 16px-20px.
- **AI Message/Drafts:** Sage-tinted (#E8F0EA) cards with a small "AI" badge. These should feel like helpful suggestions, not commands.
- **Proposal Cards:** Special cards with a Terracotta top-border or accent to signal an "open" status.
- **Input Fields:** Soft cream cards with a subtle inset feel. The "Amount" input in Money views should use the Serif font for a distinctive, high-end feel.
- **Status Indicators:** Small colored dots (Pine = Confirmed, Gold = Maybe, Grey = Pending) placed next to names or items.
- **Progress Bars:** Segmented bars for voting, where segments fill in solid Pine Green as consensus is reached.