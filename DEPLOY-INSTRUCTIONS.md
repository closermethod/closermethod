# Deploy Instructions — REBUILT-FUNNEL to Netlify
**Date:** March 16, 2026
**IMPORTANT: Do NOT deploy without reviewing these notes first.**

---

## What Changed (Ready to Deploy)

1. **index.html** — Meta Pixel added + Lead event on email capture
2. **oto.html** — Meta Pixel added + InitiateCheckout event on buy click + "No thanks" link now goes to vsl.html instead of rate calculator
3. **vsl.html** (NEW) — Full VSL page with video placeholder, Meta Pixel with ViewContent + InitiateCheckout events

## What You Need to Do Before Deploying

### Step 1: Clean Up Junk Files
The REBUILT-FUNNEL folder has some files that shouldn't be deployed. DELETE these from the folder first:

- `deploy-*.zip` (10 files) — old deploy backups, now emptied. Delete them entirely.
- `.DS_Store` — macOS junk file
- `DEPLOY_LOG.md` — internal notes, not needed on live site
- `ACTION-CHECKLIST.md` — internal notes
- `vsl-script.md` — your VSL script (keep this somewhere else, don't deploy it)

**DO NOT DELETE these — they're all essential:**
- `index.html` (homepage)
- `oto.html` (one-time offer)
- `vsl.html` (video sales letter — NEW)
- `thank-you.html`
- `thank-you-rate-system.html`
- `links.html`
- `bundle-access.html`
- `closer-kit-oto.html`
- `pitch-vault.html`
- `closer-score-quiz.html`
- `quiz-brand-deal-calculator.html`
- `first-1k-kit.html`
- `the-authenticity-premium.html`
- `tool1-rate-calculator.html` through `tool8-closer-community.html`
- `AUTHENTICITY-PREMIUM-EMAIL-SEQUENCE.html`
- `CASH-SPIKE-EMAIL-SEQUENCES.html`
- `sitemap.xml`
- `robots.txt`
- `_headers`
- `_redirects`
- `assets/` folder (product mockups)
- `.netlify/` folder (state file)

### Step 2: Deploy to Netlify

**Option A: Drag and Drop (Easiest)**
1. Go to https://app.netlify.com
2. Find your site: ugc-closer-suite
3. Go to Deploys tab
4. Drag the entire REBUILT-FUNNEL folder onto the deploy area
5. Wait for deploy to complete
6. Visit ugc-closer-suite.netlify.app to verify

**Option B: Netlify CLI**
1. Open Terminal
2. `cd ~/Desktop/UGC-Business/REBUILT-FUNNEL`
3. `netlify deploy --prod`

### Step 3: Verify After Deploy

Check these pages:
- [ ] ugc-closer-suite.netlify.app — homepage loads, email form works
- [ ] ugc-closer-suite.netlify.app/oto.html — OTO page loads, timer works, "No thanks" goes to vsl.html
- [ ] ugc-closer-suite.netlify.app/vsl.html — VSL page loads, CTA buttons link to Stan Store

Check Meta Pixel:
- [ ] Install "Meta Pixel Helper" Chrome extension
- [ ] Visit each page and verify the pixel fires (green icon = working)
- [ ] Test the email form — should fire a "Lead" event
- [ ] Test OTO buy button — should fire "InitiateCheckout"

### Step 4: VSL Video (When Ready)

Once you've recorded your VSL video (~4 min, script in vsl-script.md):
1. Upload to YouTube (unlisted) or Loom
2. Get the embed URL
3. Open vsl.html in a text editor
4. Find the video placeholder section (around line 145)
5. Replace the placeholder with your embed code
6. Re-deploy using Step 2 above
