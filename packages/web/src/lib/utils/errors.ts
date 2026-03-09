/**
 * Format error messages with actionable guidance
 */

export interface ErrorGuidance {
  title: string;
  message: string;
  action?: string;
  actionLink?: string;
}

const ERROR_PATTERNS: Array<{
  pattern: RegExp;
  guidance: ErrorGuidance;
}> = [
  {
    pattern: /Failed to fetch|NetworkError|ECONNREFUSED/i,
    guidance: {
      title: "Connection Error",
      message: "Unable to connect to the server. Please check your internet connection.",
      action: "Retry",
    },
  },
  {
    pattern: /401|Unauthorized|Not authenticated/i,
    guidance: {
      title: "Session Expired",
      message: "Your session has expired. Please sign in again.",
      action: "Sign in",
      actionLink: "/auth",
    },
  },
  {
    pattern: /403|Forbidden|UPGRADE_REQUIRED/i,
    guidance: {
      title: "Upgrade Required",
      message: "You've reached your plan limit. Upgrade to continue.",
      action: "Upgrade plan",
      actionLink: "/pricing",
    },
  },
  {
    pattern: /404|Not found/i,
    guidance: {
      title: "Not Found",
      message: "The requested resource was not found.",
    },
  },
  {
    pattern: /429|Too many requests|Rate limit/i,
    guidance: {
      title: "Too Many Requests",
      message: "You're doing that too fast. Please wait a moment and try again.",
    },
  },
  {
    pattern: /500|Internal server error/i,
    guidance: {
      title: "Server Error",
      message: "Something went wrong on our end. Our team has been notified.",
    },
  },
  {
    pattern: /502|Bad Gateway|Failed to connect to instance/i,
    guidance: {
      title: "Instance Unavailable",
      message: "Your instance is starting up or unavailable. Please wait a moment.",
      action: "Retry",
    },
  },
  {
    pattern: /Instance.*failed|provisioning failed/i,
    guidance: {
      title: "Provisioning Failed",
      message: "Failed to create your instance. Please contact support if this persists.",
      action: "Contact support",
      actionLink: "mailto:support@sparkclaw.io",
    },
  },
];

export function formatError(error: unknown): ErrorGuidance {
  const message = error instanceof Error ? error.message : String(error);

  for (const { pattern, guidance } of ERROR_PATTERNS) {
    if (pattern.test(message)) {
      return guidance;
    }
  }

  // Default error
  return {
    title: "Error",
    message: message || "An unexpected error occurred. Please try again.",
  };
}

export function getErrorMessage(error: unknown): string {
  return formatError(error).message;
}
