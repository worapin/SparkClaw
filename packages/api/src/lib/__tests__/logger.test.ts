import { describe, expect, test, mock, beforeEach } from "bun:test";
import { logger } from "../logger.js";
import { validateEnv } from "@sparkclaw/shared";

describe("logger", () => {
  let logSpy: ReturnType<typeof mock>;
  let warnSpy: ReturnType<typeof mock>;
  let errorSpy: ReturnType<typeof mock>;

  beforeEach(() => {
    process.env.NODE_ENV = "test";
    process.env.WEB_URL = "http://localhost:5173";
    validateEnv();

    logSpy = mock(() => {});
    warnSpy = mock(() => {});
    errorSpy = mock(() => {});
    console.log = logSpy;
    console.warn = warnSpy;
    console.error = errorSpy;
  });

  test("info logs to console.log with JSON", () => {
    logger.info("test message");
    expect(logSpy).toHaveBeenCalledTimes(1);
    const output = JSON.parse(logSpy.mock.calls[0][0]);
    expect(output.level).toBe("info");
    expect(output.msg).toBe("test message");
    expect(output.timestamp).toBeDefined();
  });

  test("warn logs to console.warn with JSON", () => {
    logger.warn("warning message");
    expect(warnSpy).toHaveBeenCalledTimes(1);
    const output = JSON.parse(warnSpy.mock.calls[0][0]);
    expect(output.level).toBe("warn");
    expect(output.msg).toBe("warning message");
  });

  test("error logs to console.error with JSON", () => {
    logger.error("error message");
    expect(errorSpy).toHaveBeenCalledTimes(1);
    const output = JSON.parse(errorSpy.mock.calls[0][0]);
    expect(output.level).toBe("error");
    expect(output.msg).toBe("error message");
  });

  test("includes extra data in log entry", () => {
    logger.info("with data", { userId: "123", action: "login" });
    const output = JSON.parse(logSpy.mock.calls[0][0]);
    expect(output.userId).toBe("123");
    expect(output.action).toBe("login");
  });
});
