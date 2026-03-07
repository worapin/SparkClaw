import { Elysia } from "elysia";

export const csrfMiddleware = new Elysia({ name: "csrf" })
  .onBeforeHandle(({ request, set, path }) => {
    if (path.startsWith("/api/webhook/")) return;
    if (request.method === "GET" || request.method === "HEAD" || request.method === "OPTIONS") return;

    const origin = request.headers.get("origin");
    const allowedOrigin = process.env.WEB_URL || "http://localhost:5173";

    if (!origin || origin !== allowedOrigin) {
      set.status = 403;
      return { error: "CSRF validation failed" };
    }
  });
