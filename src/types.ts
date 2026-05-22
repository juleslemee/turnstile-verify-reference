/**
 * Types for Turnstile siteverify request + response.
 *
 * Mirrors Cloudflare's documented siteverify API:
 *   https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
 */

export interface Env {
	/** Turnstile secret key. Set via `wrangler secret put TURNSTILE_SECRET_KEY`. */
	TURNSTILE_SECRET_KEY: string;
	/** CORS allowed origin. Default "*" for dev; must be set explicitly for prod. */
	ALLOWED_ORIGIN: string;
	/** Default cdata to inject if the customer's widget didn't set one. */
	DEFAULT_CDATA: string;
}

/**
 * Input we accept from the customer's frontend.
 * Both form-encoded and JSON bodies are supported.
 */
export interface SiteverifyRequest {
	/** The Turnstile token from the widget. */
	token: string;
	/** Optional visitor IP. If omitted, we use CF-Connecting-IP. */
	remoteip?: string;
	/** Optional idempotency key for retries. */
	idempotency_key?: string;
}

/**
 * Cloudflare's siteverify response shape.
 * See: https://developers.cloudflare.com/turnstile/get-started/server-side-validation/#accepted-parameters
 */
export interface SiteverifyResponse {
	success: boolean;
	challenge_ts?: string;
	hostname?: string;
	action?: string;
	cdata?: string;
	'error-codes': ErrorCode[];
	/** Free-form metadata appended by this Worker. Not from upstream. */
	_worker?: WorkerMetadata;
}

export interface WorkerMetadata {
	/** Latency of the upstream siteverify call, milliseconds. */
	duration_ms: number;
	/** This Worker's version, from package.json. */
	worker_version: string;
}

/**
 * Documented error codes from Turnstile siteverify.
 * See: https://developers.cloudflare.com/turnstile/get-started/server-side-validation/#error-codes
 */
export type ErrorCode =
	| 'missing-input-secret'
	| 'invalid-input-secret'
	| 'missing-input-response'
	| 'invalid-input-response'
	| 'bad-request'
	| 'timeout-or-duplicate'
	| 'internal-error'
	// Worker-side codes (not from upstream)
	| 'missing-token'
	| 'invalid-content-type'
	| 'upstream-unreachable'
	| 'upstream-timeout';

/**
 * Structured log emitted per siteverify call.
 * These show up in Workers Observability.
 */
export interface SiteverifyLogEntry {
	level: 'info' | 'warn' | 'error';
	event: 'siteverify';
	outcome: 'ok' | 'fail' | 'error';
	duration_ms: number;
	upstream_status?: number;
	error_codes: ErrorCode[];
	cdata_present: boolean;
	cdata_value?: string;
	remoteip_present: boolean;
	idempotency_key_present: boolean;
	ts: string;
}
