# PostLens / Social Lens

YouTube video and Shorts analysis with public YouTube data, candidate video comparisons, and GPT-6 Luna.

Live app: https://postlens-social-analyser.omangagarwal.chatgpt.site

## Features

- Import a YouTube link: title, description, tags, duration, views, likes and up to 50 relevance-ranked public comments.
- Retrieve duration-matched search candidates and the channel’s recent uploads; inspect age, channel scale and engagement before comparing.
- Generate a structured report with GPT-6 Luna, medium reasoning, using supplied text and the target thumbnail.
- Apply versioned Shorts guidance with official source links, review dates and missing-evidence checks.
- Produce a next-upload plan with title/description drafts, tags, hashtags, opening script, thumbnail brief and a Gemini image prompt when justified.
- Stream progress updates, support cancellation, and return specific errors with diagnostic IDs.
- Export the analysis and comparison data as a text report.

## Stack

TypeScript, React, Vinext, Vite and Cloudflare Workers. This is the existing Sites app source, not a standard Next.js/Vercel deployment bundle.

## Run locally

Use Node.js 22.13 or later and the pnpm version declared in package.json.

```sh
corepack enable
pnpm install
cp .dev.vars.example .dev.vars
pnpm dev
```

On Windows, copy `.dev.vars.example` to `.dev.vars` using File Explorer or your shell. Enter your own YouTube Data API v3 key in `.dev.vars`. Use the URL printed by the dev command.

Enter an OpenAI API key in the page’s password field when generating an analysis. The application retains it only in the open page’s memory and forwards it over HTTPS to the server for the OpenAI request. It does not save it in application storage or the repository. OpenAI API billing is separate from ChatGPT subscriptions.

## Build and check

```sh
pnpm exec tsc --noEmit
pnpm build
```

`pnpm start` serves the built Worker locally through Wrangler. Starter runtime details are in [docs/STARTER.md](docs/STARTER.md).

## Configuration and deployment

- `YOUTUBE_API_KEY`: server-side Cloudflare/Sites secret; not included in this repository.
- OpenAI model: `gpt-6-luna`, configured in `lib/analysis-model.ts`.
- `.openai/hosting.json` identifies the existing Sites project and bindings; it contains no API credentials.
- The existing hosted app is deployed through Sites. Pushing this repository alone does not deploy or update that hosted app.
- For a separate hosting platform, adapt its Worker runtime and deployment configuration before deploying. The current routes import `cloudflare:workers`.

## Main source files

- `app/page.tsx`: link import, analytics entry, progress and report interface.
- `app/api/inspect/route.ts`: YouTube public data import.
- `app/api/compare/route.ts` and `lib/youtube-comparison.ts`: candidate discovery and comparisons.
- `app/api/analyse/route.ts`: analysis instructions and input validation.
- `lib/analysis-stream.ts` and `lib/read-analysis.ts`: OpenAI streaming, progress and error handling.
- `lib/shorts-rules.ts`: dated guidance and evidence checks.
- `components/upload-plan.tsx`: actionable drafts, experiments and Gemini prompt.

## Current limitations

The app does not download or watch full videos or listen to audio. The model sees metadata, the target thumbnail, sampled comments and any transcript/creator analytics supplied by the user. Competitor retention, watch time and CTR are not public. Search results are candidate comparisons, not a representative benchmark. Exact causal claims or guaranteed view increases are not supported. Posting-time recommendations need audience-activity evidence and a timezone.

Guidance is a manually reviewed snapshot, not an automatic update feed. A reminder appears once the rules are over 30 days old.

## Validation status

The production build and TypeScript checks passed for this source. Streaming success and failure cases were tested with simulated OpenAI responses. The hosted streaming path was checked with an intentionally invalid key. A successful paid GPT-6 Luna analysis still requires verification with a valid user-supplied key.
