import { getEnv } from "@sparkclaw/shared";
import { captureException } from "./observability.js";

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEntry {
  level: LogLevel;
  msg: string;
  timestamp: string;
  environment: string;
  service: string;
  [key: string]: unknown;
}

let _betterstackEndpoint: string | null = null;

// Initialize BetterStack logging
function getBetterstackEndpoint(): string | null {
  if (_betterstackEndpoint) return _betterstackEndpoint;
  
  const env = getEnv();
  if (!env.BETTERSTACK_SOURCE_TOKEN) return null;
  
  _betterstackEndpoint = `${env.BETTERSTACK_HOST}/logs`;
  return _betterstackEndpoint;
}

// Send log to BetterStack
async function sendToBetterstack(entry: LogEntry): Promise<void> {
  const endpoint = getBetterstackEndpoint();
  if (!endpoint) return;
  
  try {
    const env = getEnv();
    await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${env.BETTERSTACK_SOURCE_TOKEN}`,
      },
      body: JSON.stringify(entry),
    });
  } catch {
    // Silently fail - don't block on logging
  }
}

function log(level: LogLevel, msg: string, data?: Record<string, unknown>): void {
  const env = getEnv();
  const entry: LogEntry = {
    level,
    msg,
    timestamp: new Date().toISOString(),
    environment: env.NODE_ENV,
    service: "sparkclaw-api",
    ...data,
  };

  const output = JSON.stringify(entry);

  // Console output
  if (level === "error") {
    console.error(output);
  } else if (level === "warn") {
    console.warn(output);
  } else {
    console.log(output);
  }

  // Send to BetterStack (async, fire-and-forget)
  sendToBetterstack(entry);

  // Send errors to Sentry
  if (level === "error" && data?.error instanceof Error) {
    captureException(data.error, { message: msg, ...data });
  }
}

export const logger = {
  debug: (msg: string, data?: Record<string, unknown>) => log("debug", msg, data),
  info: (msg: string, data?: Record<string, unknown>) => log("info", msg, data),
  warn: (msg: string, data?: Record<string, unknown>) => log("warn", msg, data),
  error: (msg: string, data?: Record<string, unknown>) => log("error", msg, data),
};
