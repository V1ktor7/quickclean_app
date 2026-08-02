export class AppError extends Error {
  status: number;
  code: string;

  constructor(message: string, status = 400, code = "APP_ERROR") {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.code = code;
  }
}

export class TimeoutError extends AppError {
  constructor(service: string) {
    super(`${service} request timed out`, 504, "TIMEOUT");
    this.name = "TimeoutError";
  }
}

export async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  timeoutMs = 15000,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new TimeoutError(url);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export function jsonError(error: unknown, fallback = "Unexpected error") {
  if (error instanceof AppError) {
    return Response.json(
      { error: error.message, code: error.code },
      { status: error.status },
    );
  }
  console.error(error);
  return Response.json({ error: fallback, code: "INTERNAL" }, { status: 500 });
}
