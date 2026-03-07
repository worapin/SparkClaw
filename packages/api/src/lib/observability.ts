import * as Sentry from "@sentry/bun";
import { PostHog } from "posthog-node";
import { Langfuse } from "langfuse";
import { getEnv } from "@sparkclaw/shared";

let _sentryInitialized = false;
let _posthog: PostHog | null = null;
let _langfuse: Langfuse | null = null;

// Initialize Sentry for error tracking
export function initSentry() {
  const env = getEnv();
  if (!env.SENTRY_DSN || _sentryInitialized) return;
  
  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.NODE_ENV,
    tracesSampleRate: env.NODE_ENV === "production" ? 0.1 : 1.0,
  });
  
  _sentryInitialized = true;
}

// Capture exception in Sentry
export function captureException(error: Error, context?: Record<string, unknown>) {
  if (!_sentryInitialized) return;
  
  Sentry.withScope((scope) => {
    if (context) {
      Object.entries(context).forEach(([key, value]) => {
        scope.setExtra(key, value);
      });
    }
    Sentry.captureException(error);
  });
}

// Capture message in Sentry
export function captureMessage(message: string, level: Sentry.SeverityLevel = "info") {
  if (!_sentryInitialized) return;
  Sentry.captureMessage(message, level);
}

// Get PostHog client for product analytics
export function getPostHog(): PostHog | null {
  const env = getEnv();
  if (!env.POSTHOG_API_KEY) return null;
  
  if (!_posthog) {
    _posthog = new PostHog(env.POSTHOG_API_KEY, {
      host: env.POSTHOG_HOST,
    });
  }
  
  return _posthog;
}

// Track event in PostHog
export function trackEvent(
  distinctId: string,
  event: string,
  properties?: Record<string, unknown>
) {
  const posthog = getPostHog();
  if (!posthog) return;
  
  posthog.capture({
    distinctId,
    event,
    properties: {
      environment: getEnv().NODE_ENV,
      ...properties,
    },
  });
}

// Identify user in PostHog
export function identifyUser(
  distinctId: string,
  properties?: Record<string, unknown>
) {
  const posthog = getPostHog();
  if (!posthog) return;
  
  posthog.identify({
    distinctId,
    properties,
  });
}

// Get Langfuse client for LLM observability
export function getLangfuse(): Langfuse | null {
  const env = getEnv();
  if (!env.LANGFUSE_PUBLIC_KEY || !env.LANGFUSE_SECRET_KEY) return null;
  
  if (!_langfuse) {
    _langfuse = new Langfuse({
      publicKey: env.LANGFUSE_PUBLIC_KEY,
      secretKey: env.LANGFUSE_SECRET_KEY,
      baseUrl: env.LANGFUSE_HOST,
    });
  }
  
  return _langfuse;
}

// Create a Langfuse trace for LLM operations
export function createTrace(name: string, metadata?: Record<string, unknown>) {
  const langfuse = getLangfuse();
  if (!langfuse) return null;
  
  return langfuse.trace({
    name,
    metadata: {
      environment: getEnv().NODE_ENV,
      ...metadata,
    },
  });
}

// Create a Langfuse span for LLM calls
export function createSpan(
  trace: ReturnType<Langfuse["trace"]>,
  name: string,
  input?: unknown
) {
  if (!trace) return null;
  
  return trace.span({
    name,
    input: input as Record<string, unknown>,
  });
}

// Flush all pending telemetry data
export async function flushTelemetry() {
  const promises = [];
  
  if (_posthog) {
    promises.push(_posthog.shutdown());
  }
  
  if (_langfuse) {
    promises.push(_langfuse.shutdownAsync());
  }
  
  await Promise.all(promises);
}
