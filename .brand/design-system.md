# The Closer Method — Design System (v2.1)

**Single source of truth.** May 2026. Locked for launch (Wed May 27).

This system runs **two tiers** on shared tokens. Anywhere a tier-specific pattern is unclear, the canonical reference page wins.

---

## TL;DR

- **Tier A — Editorial Elegance** governs purchase pages. Canonical: `closermethod.com/toolkit`
- **Tier B — Streetwear Editorial** governs free tools. Canonical: `closermethod.com/reply`
- **Tokens are shared.** Only display typography, button shape, and hero treatment differ between tiers.

---

## When to use each tier

| Page | Tier | Why |
|---|---|---|
| `/` apex homepage | **A** | Bridges to /toolkit; the buy journey starts here |
| `/toolkit` | **A** | Canonical Tier A |
| `/access/founding`, `/access/pro`, `/access/dfy`, `/access/kit`, `/access/bundle` | **A** | Post-purchase, premium |
| `/skill` | **B** | Free AI tool |
| `/pitch` | **B** | Free AI tool |
| `/reply` | **B** | Canonical Tier B |
| `/objection` | **B** | Free AI tool, sibling of /reply |
| `/rate` | **B** (external) | Free tool — out of scope for this system |
| `/tools` | **B** | Free tools index |
| `/watch` | **B** | Free YouTube waitlist |
| `/mcp`, `/brain`, `/closerai`, `/artifacts`, `/pitch-roast` | **B** | Free tools (external sites; align over time) |

---

## Shared tokens (lock these everywhere)

```css
:root {
  /* Canonical palette — DO NOT redefine per-site */
  --paper: #F7F4ED;        /* warm cream — primary background */
  --paper-warm: #EFE9DC;   /* card background, secondary surface */
  --ink: #1A1A1A;          /* primary text + dark CTAs */
  --ink-soft: #2D2A26;     /* secondary text */
  --gray: #6B6557;         /* meta + eyebrow text */
  --gray-light: #A8A296;   /* disabled, borders */
  --line: #E5DFD0;         /* hairlines, dividers */

  --accent: #B33B15;       /* terracotta — primary action color */
  --accent-soft: #F4DDD2;  /* terracotta tint */
  --gold: #C9A961;         /* premium signal (Pro tier badges, etc.) */
  --shout: #F4D03F;        /* caution-yellow — launch/scarcity highlights */
  --success: #4A7C59;      /* positive state */
}
```

**Drift to purge:**
- `--paper: #F4F0E6` (on /reply + /objection) → fix to `#F7F4ED`
- `--ink: #0A0A0A` (on /reply + /objection) → fix to `#1A1A1A`
- Apex has no `:root` block → add one

## Fonts (loaded everywhere)

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter:wght@400;500;600;700;900&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">
```

- **Inter** — body text (400/500/600), bold display (900 on Tier B)
- **Instrument Serif** — Tier A display + italic accents anywhere
- **JetBrains Mono** — eyebrows, brackets, tabular data, micro-labels

## Spacing scale (every page)

```css
--space-1: 4px;   --space-2: 8px;   --space-3: 12px;  --space-4: 16px;
--space-5: 24px;  --space-6: 32px;  --space-7: 48px;  --space-8: 64px;
--space-9: 96px;
```

Section padding: `70px 0` desktop, `50px 0` mobile.
Container max-width: `880px` (Tier A) · `1180px` (Tier B).

---

## Tier A — Editorial Elegance (canonical: /toolkit)

### Hero pattern
```html
<header class="hero">
  <div class="eyebrow">● BY ELI HITZ · CLOSED $1.2M+ AT DEEL · CRITEO · HBO</div>
  <h1 class="hero-h">Six AI tools. One sales framework. <em>Built for UGC creators.</em></h1>
  <p class="hero-sub">...framework that hit <b>268% of quota</b>...</p>
  <div class="hero-cta-row">
    <a class="btn-primary">Grab Founding · $147 (25 spots) →</a>
    <a class="btn-secondary">Try the Skill · 3 free pitches</a>
  </div>
  <div class="hero-meta">For creators doing $500-$5K brand deals · 60-day refund</div>
</header>
```

### Component recipes
- **Headlines:** `font-family: 'Instrument Serif'; font-size: clamp(48px, 7.5vw, 88px); line-height: 0.96;` Italic `<em>` for emphasis (terracotta).
- **Buttons:** `border-radius: 100px` (pill). Primary: ink bg + paper text. Secondary: outline.
- **Nav:** Sticky, italic "The Closer Method" wordmark, refined link styles, pill CTA.
- **Receipts:** `<em>` italic serif numbers in terracotta, mono labels.

---

## Tier B — Streetwear Editorial (canonical: /reply)

### Hero pattern
```html
<a class="caution-strip" href="/toolkit#pricing">⚠ THE TOOLKIT LAUNCH · MAY 27 · FIRST 25 GET $147 FOUNDING →</a>
<nav class="top">
  <a class="nav-mark"><span class="nm-square">C</span>closer<span style="color:var(--accent)">method</span></a>
  <div class="nav-links">
    <a href="/" class="current">Brand Reply</a>
    <a class="nav-cta" href="/toolkit#pricing">Founding · $147 →</a>
  </div>
</nav>
<header class="hero">
  <div class="bracket-label">[ ● FREE TOOL / 001 · BY ELI AT CLOSERMETHOD ]</div>
  <h1>A brand "just" DM'd you. <span class="shout-w">Reply better.</span></h1>
  <p>Paste what the brand said. Get <b>3 sendable replies</b>...</p>
  <div class="hero-meta-pill">● ELI HITZ · 10 YR B2B · $1.2M+ CLOSED · 200+ CREATORS TRAINED</div>
</header>
```

### Component recipes
- **Headlines:** `font-family: 'Inter'; font-weight: 900; font-size: clamp(40px, 6vw, 72px); line-height: 1.0; letter-spacing: -0.025em;`
- **Shout box (.shout-w):** `background: var(--shout); color: var(--ink); padding: 1px 12px 4px; transform: skew(-5deg); border: 2px solid var(--ink);` — wraps the action verb in the headline.
- **Brackets eyebrow:** `font: 800 10.5px/1 'JetBrains Mono'; letter-spacing: 0.2em; text-transform: uppercase;`
- **Buttons:** `border-radius: 4px` (NOT pill). Background: terracotta. Bold mono text.
- **Nav:** Sticky, `[C]` square + mono `closer**method**` wordmark, accent-color CTA.
- **Hero meta pill:** Dark `--ink` background, paper text, mono font, full-width below sub.

---

## Shared elements (both tiers)

- **Caution-strip top bar:** Yellow `--shout` background, mono uppercase text, links to `/toolkit#pricing`. Lives above every nav.
- **60-day guarantee** mentioned at least once per page.
- **"Built by Eli Hitz · $1.2M+ at Deel, Criteo, HBO"** as proof signal (eyebrow on Tier A, hero-meta-pill on Tier B).
- **Footer** — minimum: byline, link to closermethod.com, link to @closermethod IG.

---

## Migration checklist (bring a page into compliance)

For any page that needs to match the system:

- [ ] `:root` block uses canonical tokens (paper, ink, accent, shout, gold, success)
- [ ] No `--bg` or `--text` legacy names (rename to `--paper` and `--ink`)
- [ ] No hardcoded hex outside `:root`
- [ ] Fonts: Instrument Serif + Inter + JetBrains Mono only (Bricolage, Fraunces, Georgia, ui-rounded → purge)
- [ ] Caution-strip top bar present
- [ ] Tier-correct nav present (italic Closer Method for A, [C]+mono for B)
- [ ] Hero matches tier pattern (editorial OR streetwear, not mixed)
- [ ] CTA buttons match tier shape (pill A, square B)
- [ ] 60-day refund mentioned
- [ ] `og:image:alt` declared
- [ ] Canonical + og:url point at `closermethod.com/[path]`

---

## Audit verdict (May 16, 2026)

**Two-tier proposal is DEFENSIBLE.** Reasoning:
- Tier A and Tier B already share ~80% of tokens (palette, fonts, spacing) — the right ratio
- Each tier serves a distinct job (premium purchase decision vs free tool delivery)
- Forcing one tier flattens brand identity — Tier B's punch is what makes the free tools feel valuable
- Two canonical references already exist in production (`/toolkit`, `/reply`)

**Risk:** drift. Without this document, future pages will invent a third style. With this document, every new page picks a tier and follows the recipe.

**3 system-level inconsistencies to fix:**
1. **Paper color drift** (`#F4F0E6` vs `#F7F4ED`) — unify to `#F7F4ED`
2. **Ink color drift** (`#0A0A0A` vs `#1A1A1A`) — unify to `#1A1A1A`
3. **Apex `/` has no `:root` block** — add canonical tokens, classify as Tier A

**Cross-tier boundary check:** When a user clicks "Founding · $147 →" on Tier B `/reply`, they land at Tier A `/toolkit`. The caution-strip is identical on both. The terracotta accent is identical. Fonts are identical. The handoff feels like one product — boundary works.
