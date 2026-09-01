# Project screenshots

Drop screenshots for the profile README's Featured Projects cards **in this folder**.

## How to add one

1. Take a screenshot of the project.
2. Name it exactly `<slug>.png`, where `<slug>` is the `slug` field from
   [`projects.json`](../../projects.json).
3. Put it in this folder and commit.

That's it — the card picks it up automatically. Nothing else to edit.

## Current slugs

| Project | Expected filename |
| :--- | :--- |
| Document Generator | `document-generator.png` |
| Egyptian Red Crescent — Operations Dashboard | `egyptian-red-crescent-frontend.png` |
| AI Proposal Assistant | `ai-proposal-assistant-frontend.png` |
| Portfolio CMS | `portfolio-cms.png` |
| Invento AI | `invento-ai.png` |

## Image guidance

| | |
| :--- | :--- |
| **Format** | PNG (JPEG works too — just keep the `.png` name or update the script) |
| **Size** | 1280 × 720 is ideal. Anything 16:9 looks right; the card scales to fit. |
| **Weight** | Keep under ~400 KB each so the profile stays fast. |
| **Content** | Capture the most representative screen — a populated dashboard beats an empty login page. |

## How the image for a card is chosen

First match wins:

1. **`assets/projects/<slug>.png` exists** → that file is used. Your screenshot always wins.
2. **The project has a `live` URL in `projects.json`** → CI screenshots it into this folder
   automatically on the next run.
3. **Neither** → the card renders as text only. No broken image.

So a private project with no public deployment simply shows a clean text card until you drop a
screenshot here.

## Regenerating

```bash
npm run cards          # rebuild cards from projects.json + whatever images are in this folder
npm run cards:shots    # also re-screenshot every project that has a `live` URL (needs Playwright)
```

The `Build project cards` workflow runs the same thing on push to `projects.json`, on this folder
changing, monthly, or on manual dispatch.
