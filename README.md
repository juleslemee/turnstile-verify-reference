# Magic Turnstile — Reference Worker

> Open-source, production-ready reference implementation of Cloudflare Turnstile server-side validation, built entirely on Workers.

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/cloudflare/turnstile-verify-reference)

This Worker is the canonical "Turnstile siteverify done right" example. It's safe to deploy as-is into any Cloudflare account; the only thing you need to set after deploy is the `TURNSTILE_SECRET_KEY` secret. It powers the **Magic Turnstile** activation experience: customers either click Deploy above to one-click-install it, or have an AI agent install it as part of a wider Turnstile setup. Both paths produce the same correctly-wired result.

If you just want the widget+verify pattern, this is the smallest correct production example. If you're working on the Magic Turnstile project, see the [mini-PRD](../wit-onboarding/11-magic-turnstile-mini-prd.md) and [functional spec](../wit-onboarding/12-magic-turnstile-fspec.md) for context.

## What this gives you

- A Cloudflare Worker that accepts a Turnstile token (form-encoded *or* JSON) and validates it against [`/turnstile/v0/siteverify`](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/) with your secret key
- CORS handling, with `ALLOWED_ORIGIN` env-var configuration
- Both `application/x-www-form-urlencoded` and `application/json` request bodies
- Per-request structured logs into Workers Observability (latency, success/fail, error codes, cdata presence)
- Built-in support for [Cloudflare's documented test sitekeys](https://developers.cloudflare.com/turnstile/troubleshooting/testing/) so you can verify the integration without touching production secrets
- An [OpenAPI 3.1 spec](./openapi.yaml) for the verify endpoint
- 5-second upstream timeout + one retry on transient failures
- `_worker` metadata in every response (latency, version) so customers can see what's going on

## Quick start

### Option A — Deploy to Cloudflare (one click)

Click the badge at the top. You'll be guided through:

1. Cloning the repo into your Cloudflare account
2. Setting `TURNSTILE_SECRET_KEY` as a secret (paste from your Turnstile widget config)
3. First deploy to `<your-subdomain>.workers.dev`

After it deploys, set `ALLOWED_ORIGIN` to your real customer-facing domain (not `*`) by editing `wrangler.toml` and redeploying. See [Production hardening](#production-hardening) below.

### Option B — Clone + deploy manually

```sh
git clone https://github.com/cloudflare/turnstile-verify-reference
cd turnstile-verify-reference
npm install
cp .dev.vars.example .dev.vars  # for local dev with test secret
npm run dev                      # http://localhost:8787
```

To deploy to your Cloudflare account:

```sh
npx wrangler secret put TURNSTILE_SECRET_KEY
# paste your secret when prompted
npm run deploy
```

### Option C — Use Magic Turnstile AI skill (recommended for new customers)

If you're starting from a customer site that doesn't yet have Turnstile, install the [Magic Turnstile skill](https://github.com/cloudflare/turnstile-deploy-skill) into your AI agent (Claude Code, OpenCode, Cursor, etc.) and ask it to deploy Turnstile. The skill will scaffold both the frontend widget and a copy of this Worker, parameterized for your domain.

## Calling the Worker from your frontend

```js
const res = await fetch('https://your-worker.workers.dev/', {
	method: 'POST',
	headers: { 'Content-Type': 'application/json' },
	body: JSON.stringify({
		token: turnstileToken, // from window.turnstile.getResponse() or form field
	}),
});
const data = await res.json();
if (data.success) {
	// Proceed with the protected action (login, form submit, etc.)
} else {
	// Show user a "verification failed" message; data['error-codes'] tells you why.
}
```

You can also POST a form body (this is the default when a `<form>` is submitted directly to the Worker):

```html
<form action="https://your-worker.workers.dev/" method="POST">
	<div class="cf-turnstile" data-sitekey="YOUR_SITEKEY" data-cdata="ai_deployed_v1"></div>
	<button type="submit">Submit</button>
</form>
```

Both endpoints `/` and `/siteverify` work identically. `/siteverify` exists for compatibility with the [reference page at juleslemee.com/turnstile-test.html](https://juleslemee.com/turnstile-test.html).

## Production hardening

After the first deploy, do these before pointing real traffic at it:

| Step | Why |
|---|---|
| Set `ALLOWED_ORIGIN` to your actual customer domain in `wrangler.toml`, redeploy | Locks down CORS so other sites can't proxy through your Worker |
| Set up Workers Observability alerts on error rate > 1% | Catches upstream siteverify outages or secret-misconfig events |
| Rotate `TURNSTILE_SECRET_KEY` periodically via `wrangler secret put` | Standard secret hygiene |
| If your traffic patterns warrant it, add a [Worker rate limit](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/) | Defends the Worker itself from abuse |

## The `cdata` convention

Magic Turnstile uses the `cdata` field on widgets to mark deployments that went through the AI skill or the Deploy-to-Cloudflare button. The convention is:

```
cdata=ai_deployed_v1
```

…set in the widget HTML via `data-cdata="ai_deployed_v1"`. When the token is validated, the `cdata` field shows up in the siteverify response and in Cloudflare's internal analytics. This lets us measure how AI-deployed Turnstile compares to manually-deployed Turnstile on metrics like activation rate, siteverify call rate, and customer pain (CUSTESC volume).

If you're deploying this Worker as part of an AI-driven flow, make sure your frontend widget includes `data-cdata="ai_deployed_v1"`.

## Testing

```sh
npm test                   # unit tests, mocks fetch
npm run test:integration   # hits real siteverify with test secrets (15s)
npm run typecheck
npm run openapi:lint
```

Cloudflare's documented test secrets:

| Secret | What it does |
|---|---|
| `1x0000000000000000000000000000000AA` | Always succeeds |
| `2x0000000000000000000000000000000AA` | Always fails |
| `3x0000000000000000000000000000000AA` | Returns `timeout-or-duplicate` (simulates a spent token) |

## Project layout

```
src/
├── index.ts          # Fetch handler, routing, CORS, body parsing
├── validate.ts       # siteverify call with retry + timeout
├── observability.ts  # Structured log emission
├── errors.ts         # SiteverifyError + response shaping
└── types.ts          # Request/response types, error codes
test/
├── unit.test.ts          # Mocked siteverify; tests parsing, errors, CORS, routing
└── integration.test.ts   # Real network; uses test secrets
examples/
└── curl.sh           # curl examples against a deployed Worker
openapi.yaml          # OpenAPI 3.1 spec for the verify endpoint
wrangler.toml         # Worker config; defines ALLOWED_ORIGIN var + requires TURNSTILE_SECRET_KEY secret
```

## Contributing

PRs welcome. Two rules:

1. Keep the request/response contract stable. Customers will deploy this Worker as-is.
2. Don't add features that require additional secrets or external services. The point is "drop in, set one secret, you're done."

## License

MIT. See [LICENSE](./LICENSE).

## Related

- [Cloudflare Turnstile docs](https://developers.cloudflare.com/turnstile/)
- [Server-side validation reference](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/)
- [Deploy buttons for Workers](https://developers.cloudflare.com/workers/platform/deploy-buttons/)
- [The HTML Rewriter example](https://developers.cloudflare.com/workers/examples/turnstile-html-rewriter/) — frontend-focused companion to this Worker
- [Pages plugin for Turnstile](https://developers.cloudflare.com/pages/functions/plugins/turnstile/) — if your site is on Pages, use this instead
