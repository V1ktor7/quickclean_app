import { AppError, fetchWithTimeout, TimeoutError } from "@/lib/errors";

const JOBBER_URL = "https://api.getjobber.com/api/graphql";
const JOBBER_VERSION = "2025-04-16";

type GraphQLResponse<T> = {
  data?: T;
  errors?: Array<{ message: string }>;
};

export async function jobberGraphQL<T>(
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  const token = process.env.JOBBER_ACCESS_TOKEN;
  if (!token) {
    throw new AppError(
      "Jobber is not configured (missing JOBBER_ACCESS_TOKEN)",
      503,
      "JOBBER_UNCONFIGURED",
    );
  }

  let res: Response;
  try {
    res = await fetchWithTimeout(
      JOBBER_URL,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "X-JOBBER-GRAPHQL-VERSION": JOBBER_VERSION,
        },
        body: JSON.stringify({ query, variables }),
      },
      20000,
    );
  } catch (err) {
    if (err instanceof TimeoutError) {
      throw new TimeoutError("Jobber");
    }
    throw err;
  }

  if (!res.ok) {
    throw new AppError(
      `Jobber API error (${res.status})`,
      502,
      "JOBBER_HTTP_ERROR",
    );
  }

  const json = (await res.json()) as GraphQLResponse<T>;
  if (json.errors?.length) {
    throw new AppError(
      json.errors.map((e) => e.message).join("; "),
      502,
      "JOBBER_GRAPHQL_ERROR",
    );
  }
  if (!json.data) {
    throw new AppError("Empty Jobber response", 502, "JOBBER_EMPTY");
  }
  return json.data;
}
