# Website

**Agency equivalent:** $3,000 to $7,000

Run this when the user wants a website (single deployable HTML file with hero, services, pricing, FAQ, testimonials).

---

## The prompt

```
act as a senior conversion-focused web designer. i run a [TYPE OF BUSINESS] called [NAME]. before you build a single line, ask me 3 quick questions: (1) my brand colors (or say "pick for me" and choose a modern, high-contrast palette that genuinely fits my business and my customer, do not default to any one stock look), (2) the ONE action i want every visitor to take (book / buy / subscribe / DM), (3) my customer in one sentence. then deliver my website as a single complete HTML file with all CSS and JS embedded, no external dependencies except google fonts. sections in order: hero (headline + subheadline + primary CTA), what i offer (3-5 services, one-line descriptions), who it's for ("this is for you if..." block), 3 clearly-labeled testimonial placeholders (use [CUSTOMER NAME] brackets and a realistic-sounding sample quote i will swap for a real one, never present them as real), pricing with 3 tiers named appealingly (not basic/standard/premium, like "Starter / Studio / Studio Pro" or industry-specific), about me (warm, builds trust without humble-bragging), 4-6 honest FAQ items, and a closing CTA section. tone: derive it from my answers and my customer, do not assume warm, corporate, or playful, match what actually fits my business. typography: ask me if i already have brand fonts, otherwise choose a clean modern pairing that fits the business (a strong sans like Inter or Geist for body, paired with whatever display face actually suits my brand), do not default to a decorative serif unless it genuinely fits. mobile-first with breakpoints at 640px + 1024px. semantic HTML5, alt text on every image, ARIA labels on interactive elements. one signature scroll animation only (subtle fade-up on section enter, no bounces, no parallax). use [BUSINESS NAME] and [SERVICE NAME] as find-and-replace placeholders so i can swap in my real content. if a section doesn't have enough info to fill meaningfully, leave a `` comment instead of padding with filler. CRITICAL: hero headline must be specific to the actual transformation my customer wants, never an industry cliché. NEVER write "find your stillness" for yoga, "unlock your potential" for coaching, "elevate your business" for consulting. lead with the specific outcome in plain words. after delivering, list: (a) 3 specific things i should customize before going live, (b) one preview tip: paste the code back at claude.ai and it auto-renders as a live artifact, preview, iterate via chat, then save the final version.
```

---

## Why this works

the 3 clarifying questions force Claude to start with YOUR context, not a generic template. the "pick for me" fallback chooses a palette that fits the business instead of stamping the same stock look on every site. the strict output spec (single file, embedded CSS, no externals) means it actually deploys to Netlify in 60 seconds. naming tiers "Starter / Studio / Studio Pro" instead of basic/standard/premium is the single highest-impact pricing edit you'll make. the "list 3 things to customize" closer turns Claude into your QA partner.

---

## After delivering

1. Output filename and where to deploy it (Netlify drag-and-drop unless specified otherwise)
2. One A/B test idea to run on it
3. One thing to monitor in week one
4. Offer the feedback loop: "Score this out of 100 across [3 dimensions]. Show the weakest 2. Rewrite them on your go."
