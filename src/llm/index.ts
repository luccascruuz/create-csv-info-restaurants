// Geradores de mensagem: template (grátis, offline), ollama (grátis, local),
// gemini (camada gratuita) e openai (pago). Todos via API compatível com OpenAI.
import OpenAI from 'openai';
import pRetry from 'p-retry';
import { z } from 'zod';
import type { Place } from '../types.ts';
import { buildInput, buildInstructions, type Sender } from './prompt.ts';
import { type Outreach, OutreachSchema } from './schema.ts';
import { generateFromTemplate } from './template.ts';

export const PROVIDERS = ['auto', 'template', 'ollama', 'gemini', 'openai'] as const;
export type Provider = (typeof PROVIDERS)[number];
export type ResolvedProvider = Exclude<Provider, 'auto'>;

interface ProviderPreset {
  baseURL?: string;
  apiKeyEnv?: string;
  defaultModel: string;
  /** Chamadas simultâneas recomendadas (LLM local é mais lento; camada grátis tem rate limit). */
  concurrency: number;
  free: boolean;
}

export const PRESETS: Record<ResolvedProvider, ProviderPreset> = {
  template: { defaultModel: 'template-v2', concurrency: 10, free: true },
  ollama: { baseURL: 'http://localhost:11434/v1', defaultModel: 'gemma3:4b', concurrency: 1, free: true },
  gemini: {
    baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
    apiKeyEnv: 'GEMINI_API_KEY',
    defaultModel: 'gemini-2.5-flash',
    concurrency: 1,
    free: true,
  },
  openai: { apiKeyEnv: 'OPENAI_API_KEY', defaultModel: 'gpt-5-mini', concurrency: 3, free: false },
};

export interface GeneratorOptions {
  provider: ResolvedProvider;
  model: string;
  sender: Sender;
  apiKey?: string;
  ollamaUrl?: string;
}

export interface MessageGenerator {
  /** Identifica provedor+modelo (usado como chave de cache). */
  id: string;
  generate(place: Place): Promise<Outreach>;
}

const JSON_SCHEMA = (() => {
  const { $schema: _ignored, ...schema } = z.toJSONSchema(OutreachSchema) as Record<string, unknown>;
  return schema;
})();

/** Extrai o JSON mesmo se o modelo envolver a resposta em ```json ... ``` */
export function parseOutreach(content: string | null | undefined): Outreach {
  if (!content) throw new Error('Resposta vazia do modelo');
  const match = content.match(/\{[\s\S]*\}/);
  if (!match) throw new Error(`Resposta sem JSON: ${content.slice(0, 200)}`);
  const result = OutreachSchema.safeParse(JSON.parse(match[0]));
  if (!result.success) throw new Error(`JSON fora do formato: ${z.prettifyError(result.error)}`);
  return { ...result.data, mensagem: result.data.mensagem.trim() };
}

/** Verifica se o Ollama está rodando localmente. */
export async function isOllamaRunning(baseURL = PRESETS.ollama.baseURL as string): Promise<boolean> {
  try {
    const res = await fetch(new URL('/api/version', baseURL), { signal: AbortSignal.timeout(1_500) });
    return res.ok;
  } catch {
    return false;
  }
}

export function createGenerator(options: GeneratorOptions): MessageGenerator {
  const { provider, model, sender } = options;
  const id = `${provider}:${model}`;

  if (provider === 'template') {
    return { id, generate: async (place) => generateFromTemplate(place, sender) };
  }

  const preset = PRESETS[provider];
  const client = new OpenAI({
    apiKey: options.apiKey ?? 'ollama',
    baseURL: provider === 'ollama' ? (options.ollamaUrl ?? preset.baseURL) : preset.baseURL,
    maxRetries: 3,
    timeout: 120_000,
  });
  const instructions = buildInstructions(sender);

  return {
    id,
    generate: (place) =>
      // Retry extra para respostas fora do formato (comum em modelos locais pequenos)
      pRetry(
        async () => {
          const completion = await client.chat.completions.create({
            model,
            messages: [
              { role: 'system', content: instructions },
              { role: 'user', content: buildInput(place) },
            ],
            response_format: {
              type: 'json_schema',
              json_schema: { name: 'outreach', strict: true, schema: JSON_SCHEMA },
            },
          });
          return parseOutreach(completion.choices[0]?.message.content);
        },
        {
          retries: 2,
          // Erros de autenticação / modelo inexistente não melhoram tentando de novo
          shouldRetry: ({ error }) => !(error instanceof OpenAI.APIError && error.status !== undefined && error.status < 500),
        },
      ),
  };
}
