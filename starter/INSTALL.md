# Install the AI Builder Setup

You downloaded 4 files:

- `SKILL.md` · the behavior engine. this is the brain.
- `brain-doc-template.md` · 5 questions about your business. fill it in once.
- `01-website.md` · one fully worked example workflow (a deployable website).
- `INSTALL.md` · this file.

It works in any AI tool that accepts custom instructions or reference files. Pick your tool, follow the steps, then start a new chat and ask it to build something.

The core move is the same everywhere: **`SKILL.md` becomes the system instructions, `brain-doc-template.md` (filled in) becomes reference knowledge.** Everything below is just how each tool wants that handed to it.

---

## Claude.ai (Pro, Max, Team, Enterprise) · native Skill

The native install. Claude triggers the Skill automatically when you ask it to build, ship, or deploy something.

A Claude Skill is a folder with `SKILL.md` inside it. You have a loose file, so make the folder:

1. Make a new folder named `ai-builder-setup`
2. Drop `SKILL.md` inside it (you can drop `01-website.md` in too, as reference)
3. Zip that `ai-builder-setup` folder
4. Claude.ai → Settings → Capabilities → Skills → Upload, drop the zip in, wait for "Skill installed"

Claude now auto-uses it when relevant. To force it: start a chat with "use the ai-builder-setup skill."

> Free Claude tier does not support custom Skills. If you are on free Claude, use the Claude Project setup below instead.

---

## Claude Code

Skills are filesystem-based. No zip needed.

1. Make a folder named `ai-builder-setup` and put `SKILL.md` inside it
2. Move that folder to either:
   - `~/.claude/skills/` (personal, available in every project)
   - `.claude/skills/` (project-specific)
3. Restart Claude Code
4. The Skill triggers automatically when you ask Claude to build something

---

## Claude Project (free + pro, no Skill upload)

Same behavior, no zip:

1. Create a new Claude Project
2. Open Project → Instructions, paste the **body** of `SKILL.md` (skip the YAML frontmatter at the top, paste everything from `# AI Builder Setup` down)
3. Add `brain-doc-template.md` (filled in) and `01-website.md` to Project knowledge
4. Start any chat in this project and describe what you want to build

---

## ChatGPT (Custom GPT)

1. ChatGPT → Explore GPTs → Create
2. Configure → Instructions, paste the body of `SKILL.md`
3. Knowledge → upload `brain-doc-template.md` (filled in) and `01-website.md`
4. Save. Start any chat in your custom GPT.

---

## Cursor

1. Save the body of `SKILL.md` as `.cursorrules` in your project root
2. Keep `brain-doc-template.md` and `01-website.md` in the project for reference
3. Cursor auto-loads `.cursorrules` for every chat in that project

---

## Codex CLI / Gemini CLI / other CLI tools

1. Use the body of `SKILL.md` as your system prompt
2. Reference `brain-doc-template.md` and `01-website.md` when you need them

---

## Any other AI

Open the chat. Paste the contents of `SKILL.md` as your first message. Add: "this is the system you operate under for the rest of this conversation." Then describe what you want to build.

---

## After install: fill in your brain doc

The Skill works without your brain doc, but the output gets sharper when your AI knows who you are.

1. Open `brain-doc-template.md`
2. Replace every `[BRACKETED ANSWER]` with your real answer (5 questions, about 10 minutes)
3. Save it
4. Upload it wherever your tool keeps reference knowledge (project knowledge, custom GPT knowledge, `.cursorrules`, or just paste it at the start of a chat)

Update it quarterly. Treat it like an asset.

---

## Then start building

Open a new chat in whatever AI you installed this in. Type one of these:

- "build me a thank-you page for a customer who just bought my course"
- "build me a 30-day content calendar for [your platform]"
- "build me a brand voice guide for my business"
- "build me an FAQ page for my $97 product"
- "build me a website for my business" (this one follows `01-website.md` step for step)

The Skill asks 3 to 5 clarifying questions, applies your brain doc, and ships a real file you can save and deploy. `01-website.md` is the worked example. The engine builds everything else the same way.
