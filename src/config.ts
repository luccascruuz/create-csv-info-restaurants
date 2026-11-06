// Junta opções da linha de comando + .env + padrões, e valida tudo com zod.
// Prioridade: CLI > variáveis de ambiente > padrão.
import { z } from 'zod';
import { type PRESETS, PROVIDERS } from './llm/index.ts';

const optionalString = z
  .string()
  .trim()
  .transform((v) => v || undefined)
  .optional();

export const ConfigSchema = z
  .object({
    source: z.enum(['osm', 'google']).default('osm'),
    city: optionalString,
    latitude: z.coerce.number().min(-90).max(90).optional(),
    longitude: z.coerce.number().min(-180).max(180).optional(),
    radius: z.coerce.number().int().positive().max(50_000).default(10_000),
    limit: z.coerce.number().int().positive().max(500).default(20),
    query: z.string().trim().min(1).default('restaurantes'),
    amenities: z
      .string()
      .default('restaurant')
      .transform((v) =>
        v
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      ),

    provider: z.enum(PROVIDERS).default('auto'),
    model: optionalString,
    concurrency: z.coerce.number().int().positive().max(20).optional(),

    googleMapsApiKey: optionalString,
    openaiApiKey: optionalString,
    geminiApiKey: optionalString,
    ollamaUrl: z.string().url().default('http://localhost:11434/v1'),
    ollamaModel: optionalString,

    company: z.string().trim().min(1).default('MagicMarketing'),
    senderName: z.string().trim().default(''),
    senderRole: z.string().trim().default(''),

    format: z.enum(['csv', 'xlsx', 'ambos']).default('ambos'),
    output: z.string().trim().min(1).default('output/restaurantes'),
    cache: z.boolean().default(true),
    cacheFile: z.string().default('.cache/mensagens.db'),
  })
  .superRefine((cfg, ctx) => {
    const hasCoords = cfg.latitude !== undefined && cfg.longitude !== undefined;
    if (!cfg.city && !hasCoords) {
      ctx.addIssue({ code: 'custom', message: 'Informe --cidade ou --lat e --lng', path: ['city'] });
    }
    if (cfg.source === 'google' && !cfg.googleMapsApiKey) {
      ctx.addIssue({ code: 'custom', message: 'A fonte "google" exige GOOGLE_MAPS_API_KEY', path: ['googleMapsApiKey'] });
    }
    if (cfg.source === 'google' && cfg.limit > 60) {
      ctx.addIssue({ code: 'custom', message: 'O Google retorna no máximo 60 resultados', path: ['limit'] });
    }
    if (cfg.provider === 'openai' && !cfg.openaiApiKey) {
      ctx.addIssue({ code: 'custom', message: 'O provedor "openai" exige OPENAI_API_KEY', path: ['openaiApiKey'] });
    }
    if (cfg.provider === 'gemini' && !cfg.geminiApiKey) {
      ctx.addIssue({ code: 'custom', message: 'O provedor "gemini" exige GEMINI_API_KEY', path: ['geminiApiKey'] });
    }
  });

export type Config = z.infer<typeof ConfigSchema>;

/** Opções vindas do commander (todas opcionais / string). */
export type CliOptions = Partial<Record<keyof Config, unknown>>;

/** Mapeia variáveis de ambiente para chaves de config. */
const ENV_MAP: Record<string, keyof Config> = {
  PLACES_SOURCE: 'source',
  SEARCH_CITY: 'city',
  SEARCH_LAT: 'latitude',
  SEARCH_LNG: 'longitude',
  SEARCH_RADIUS: 'radius',
  MAX_RESULTS: 'limit',
  SEARCH_QUERY: 'query',
  OSM_AMENITIES: 'amenities',
  LLM_PROVIDER: 'provider',
  LLM_MODEL: 'model',
  CONCURRENCY: 'concurrency',
  GOOGLE_MAPS_API_KEY: 'googleMapsApiKey',
  OPENAI_API_KEY: 'openaiApiKey',
  GEMINI_API_KEY: 'geminiApiKey',
  OLLAMA_URL: 'ollamaUrl',
  OLLAMA_MODEL: 'ollamaModel',
  COMPANY_NAME: 'company',
  SENDER_NAME: 'senderName',
  SENDER_ROLE: 'senderRole',
  OUTPUT_FORMAT: 'format',
  OUTPUT_FILE: 'output',
};

export function resolveConfig(cli: CliOptions, env: NodeJS.ProcessEnv = process.env): Config {
  const fromEnv: CliOptions = {};
  for (const [envName, key] of Object.entries(ENV_MAP)) {
    const value = env[envName];
    if (value !== undefined && value.trim() !== '') fromEnv[key] = value;
  }

  const definedCli = Object.fromEntries(Object.entries(cli).filter(([, v]) => v !== undefined));
  // Se a cidade veio pela CLI, ignora lat/lng do .env (e vice-versa)
  if (definedCli.city) {
    delete fromEnv.latitude;
    delete fromEnv.longitude;
  } else if (definedCli.latitude !== undefined || definedCli.longitude !== undefined) {
    delete fromEnv.city;
  }

  const result = ConfigSchema.safeParse({ ...fromEnv, ...definedCli });
  if (!result.success) {
    throw new Error(`Configuração inválida:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}

export function apiKeyFor(cfg: Config, provider: keyof typeof PRESETS): string | undefined {
  if (provider === 'openai') return cfg.openaiApiKey;
  if (provider === 'gemini') return cfg.geminiApiKey;
  return undefined;
}
