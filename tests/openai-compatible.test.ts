// Testa o gerador via API compatível com OpenAI (mesmo caminho de ollama/gemini/openai)
// contra um servidor HTTP local, sem rede externa nem chave.
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createGenerator, isOllamaRunning } from '../src/llm/index.ts';
import { makePlace } from './fixtures.ts';

let server: Server;
let baseURL: string;
const requests: Record<string, unknown>[] = [];
let replies: string[] = [];

beforeAll(async () => {
  server = createServer((req, res) => {
    if (req.url === '/api/version') {
      res.end(JSON.stringify({ version: 'test' }));
      return;
    }
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      requests.push(JSON.parse(body));
      const content = replies.shift() ?? '';
      res.setHeader('Content-Type', 'application/json');
      res.end(
        JSON.stringify({
          id: 'x',
          object: 'chat.completion',
          created: 0,
          model: 'test',
          choices: [{ index: 0, finish_reason: 'stop', message: { role: 'assistant', content } }],
        }),
      );
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseURL = `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1`;
});

afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

describe('gerador compatível com OpenAI', () => {
  const sender = { company: 'MagicMarketing', name: 'Ana', role: 'consultora' };
  const good = JSON.stringify({ assunto: 'Oi', mensagem: 'Mensagem personalizada para o restaurante.', canal_sugerido: 'visita' });

  it('envia prompt + JSON schema estrito e valida a resposta', async () => {
    replies = [good];
    const generator = createGenerator({ provider: 'ollama', model: 'gemma3:4b', sender, ollamaUrl: baseURL });

    const out = await generator.generate(makePlace());

    expect(out.canal_sugerido).toBe('visita');
    const req = requests.at(-1) as {
      model: string;
      messages: { content: string }[];
      response_format: { type: string; json_schema: { strict: boolean; schema: { required: string[] } } };
    };
    expect(req.model).toBe('gemma3:4b');
    expect(req.messages[0]?.content).toContain('Ana, consultora da MagicMarketing');
    expect(req.messages[1]?.content).toContain('Bistrô do Acarajé');
    expect(req.response_format.type).toBe('json_schema');
    expect(req.response_format.json_schema.strict).toBe(true);
    expect(req.response_format.json_schema.schema.required).toEqual(['assunto', 'mensagem', 'canal_sugerido']);
  });

  it('tenta de novo quando o modelo responde fora do formato', async () => {
    replies = ['desculpe, não entendi', good];
    const generator = createGenerator({ provider: 'ollama', model: 'gemma3:4b', sender, ollamaUrl: baseURL });
    await expect(generator.generate(makePlace())).resolves.toHaveProperty('assunto', 'Oi');
  });

  it('detecta se o Ollama está rodando', async () => {
    expect(await isOllamaRunning(baseURL)).toBe(true);
    expect(await isOllamaRunning('http://127.0.0.1:1/v1')).toBe(false);
  });
});
