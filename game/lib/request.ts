import { serviceError, serviceFetch } from "./transport";

export const EXPERIMENT_ERROR =
  "The experiment could not finish. Check the backend and try again.";
export const QUANTUM_ERROR =
  "The quantum core did not answer. Check the backend and try again.";
/** Response decoding is shared; refusals and mission ownership stay with the caller. */
export async function requestJson<T>(
  path: string,
  init?: RequestInit,
  error: (response: Response) => Promise<Error> = (response) =>
    serviceError(response, EXPERIMENT_ERROR),
): Promise<T> {
  const response = await serviceFetch(path, init);
  if (!response.ok) throw await error(response);
  return response.json();
}
export function postJson<T>(
  path: string,
  body: unknown,
  options: {
    timeout?: number;
    error?: (response: Response) => Promise<Error>;
  } = {},
): Promise<T> {
  return requestJson(
    path,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      ...(options.timeout === undefined
        ? {}
        : { signal: AbortSignal.timeout(options.timeout) }),
    },
    options.error,
  );
}
/** Lab tools expose validation details in both delivery targets. */
export async function experimentError(response: Response): Promise<Error> {
  const data = await response.json();
  return new Error(
    typeof data.detail === "string" ? data.detail : EXPERIMENT_ERROR,
  );
}
