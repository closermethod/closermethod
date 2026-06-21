# sitemap addition · /blog · staged 2026-06-11

Append these 6 URLs to the apex sitemap (and llms.txt if articles should be listed there). All pages are indexable (no noindex), canonical-tagged, with Article JSON-LD (author Elisabeth Hitz, datePublished 2026-06-11).

```
https://closermethod.com/blog/
https://closermethod.com/blog/set-up-claude-for-a-small-business/
https://closermethod.com/blog/why-your-ai-is-not-working/
https://closermethod.com/blog/claude-skills-explained/
https://closermethod.com/blog/claude-code-metering-june-15/
https://closermethod.com/blog/hire-someone-to-set-up-claude/
```

Sitemap XML snippet (append-ready):

```xml
<url><loc>https://closermethod.com/blog/</loc><lastmod>2026-06-11</lastmod></url>
<url><loc>https://closermethod.com/blog/set-up-claude-for-a-small-business/</loc><lastmod>2026-06-11</lastmod></url>
<url><loc>https://closermethod.com/blog/why-your-ai-is-not-working/</loc><lastmod>2026-06-11</lastmod></url>
<url><loc>https://closermethod.com/blog/claude-skills-explained/</loc><lastmod>2026-06-11</lastmod></url>
<url><loc>https://closermethod.com/blog/claude-code-metering-june-15/</loc><lastmod>2026-06-11</lastmod></url>
<url><loc>https://closermethod.com/blog/hire-someone-to-set-up-claude/</loc><lastmod>2026-06-11</lastmod></url>
```

Notes for the deploying session:
- No _redirects changes needed: apex serves local folders, and `_redirects` was checked 2026-06-11 for `/blog` conflicts (none; no catch-alls shadow it).
- CTA targets used: /hire ($500 diagnostic, proxied to magnificent-madeleine), /build ($147), /brain-builder (free). All verified present in current routing.
- STAGE ONLY: deploy from inside the folder per standing rule, then curl + screenshot verify at 1280px and 375px.
