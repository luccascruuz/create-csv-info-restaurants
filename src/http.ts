import pRetry, { AbortError } from 'p-retry';

/** Política de uso do Nominatim/Overpass exige um User-Agent que identifique a aplicação. */
export const USER_AGENT = 'create-csv-info-restaurants/2.0 (+https://github.com/luccascruuz/create-csv-info-restaurants)';

export class HttpError extends Error {
  readonly status: number;
  readonly body: string;

  constructor(status: number, body: string, url: string) {
    super(`HTTP ${status} em ${new URL(url).host}: ${body.slice(0, 500)}`);
    this.status = status;
    this.body = body;
  }
}

/** Status que valem nova tentativa (rate limit e falhas temporárias do servidor). */
const RETRYABLE = new Set([408, 425, 429, 500, 502, 503, 504]);

/**
 * fetch + JSON com retry exponencial para falhas temporárias.
 * Erros 4xx "definitivos" (ex.: chave inválida) não são repetidos.
 */
export async function fetchJson<T>(
  url: string,
  init: RequestInit = {},
  { retries = 3, minTimeout = 1_000 }: { retries?: number; minTimeout?: number } = {},
): Promise<T> {
  return pRetry(
    async () => {
      let response: Response;
      try {
        response = await fetch(url, {
          ...init,
          headers: { 'User-Agent': USER_AGENT, ...init.headers },
          signal: AbortSignal.timeout(60_000),
        });
      } catch (err) {
        // "fetch failed" não diz nada: expõe a causa real (ENOTFOUND, ECONNRESET, timeout...)
        const cause = (err as { cause?: { code?: string; message?: string } }).cause;
        const reason = cause?.code ?? cause?.message ?? (err as Error).message;
        throw new Error(`Falha de rede ao acessar ${new URL(url).host} (${reason}). Verifique sua conexão.`);
      }

      if (!response.ok) {
        const error = new HttpError(response.status, await response.text(), url);
        throw RETRYABLE.has(response.status) ? error : new AbortError(error);
      }

      return (await response.json()) as T;
    },
    { retries, minTimeout },
  );
}
