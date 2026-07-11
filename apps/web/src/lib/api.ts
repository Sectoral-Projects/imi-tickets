const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

type ApiErrorBody = {
  error?: string;
  code?: string;
};

export class ApiError extends Error {
  readonly code: string | null;
  readonly status: number;

  constructor(message: string, status: number, code: string | null = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

export const api = {
  async get<T>(path: string): Promise<T> {
    return request<T>(path, { method: "GET" });
  },
  async post<T>(path: string, body?: unknown): Promise<T> {
    return request<T>(path, { method: "POST", body });
  },
  async patch<T>(path: string, body?: unknown): Promise<T> {
    return request<T>(path, { method: "PATCH", body });
  },
  async put<T>(path: string, body?: unknown): Promise<T> {
    return request<T>(path, { method: "PUT", body });
  },
  async delete<T>(path: string): Promise<T> {
    return request<T>(path, { method: "DELETE" });
  },
};

async function request<T>(
  path: string,
  init: { method: string; body?: unknown },
): Promise<T> {
  const res = await fetch(API_BASE + path, {
    method: init.method,
    credentials: "include",
    headers:
      init.body === undefined ? undefined : { "Content-Type": "application/json" },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });

  if (!res.ok) {
    throw await createApiError(res);
  }

  return res.json();
}

async function createApiError(res: Response) {
  const text = await res.text();

  if (!text) {
    return new ApiError(res.statusText, res.status);
  }

  try {
    const body = JSON.parse(text) as ApiErrorBody;
    return new ApiError(
      body.error ?? res.statusText,
      res.status,
      body.code ?? null,
    );
  } catch {
    return new ApiError(text, res.status);
  }
}