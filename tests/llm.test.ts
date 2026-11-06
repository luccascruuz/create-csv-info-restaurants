import { describe, expect, it } from 'vitest';
import { createGenerator, parseOutreach } from '../src/llm/index.ts';
import { buildInput } from '../src/llm/prompt.ts';
import { OutreachSchema } from '../src/llm/schema.ts';
import { generateFromTemplate, isMobile, joinPt, suggestChannel } from '../src/llm/template.ts';
import { makePlace } from './fixtures.ts';

const sender = { company: 'MagicMarketing', name: '', role: '' };

describe('parseOutreach', () => {
  const valid = { assunto: 'Olá', mensagem: 'Uma mensagem com tamanho suficiente.', canal_sugerido: 'whatsapp' };

  it('aceita JSON puro e JSON dentro de bloco markdown', () => {
    expect(parseOutreach(JSON.stringify(valid))).toEqual(valid);
    expect(parseOutreach(`\`\`\`json\n${JSON.stringify(valid)}\n\`\`\``)).toEqual(valid);
  });

  it('rejeita resposta vazia, sem JSON ou fora do schema', () => {
    expect(() => parseOutreach('')).toThrow(/vazia/);
    expect(() => parseOutreach('não sei')).toThrow(/sem JSON/);
    expect(() => parseOutreach(JSON.stringify({ ...valid, canal_sugerido: 'pombo' }))).toThrow(/fora do formato/);
  });
});

describe('template', () => {
  it('detecta celular brasileiro', () => {
    expect(isMobile('(79) 98854-0097')).toBe(true);
    expect(isMobile('+55 79 98854-0097')).toBe(true);
    expect(isMobile('(79) 3631-1234')).toBe(false);
    expect(isMobile(null)).toBe(false);
  });

  it('sugere o canal pela informação disponível', () => {
    expect(suggestChannel(makePlace({ telefone: '(79) 98854-0097' }))).toBe('whatsapp');
    expect(suggestChannel(makePlace({ instagram: 'https://instagram.com/x' }))).toBe('instagram');
    expect(suggestChannel(makePlace({ site: 'https://x.com' }))).toBe('email');
    expect(suggestChannel(makePlace({ telefone: '(79) 3631-1234' }))).toBe('telefone');
    expect(suggestChannel(makePlace())).toBe('visita');
  });

  it('junta listas em português', () => {
    expect(joinPt(['a'])).toBe('a');
    expect(joinPt(['a', 'b'])).toBe('a e b');
    expect(joinPt(['a', 'b', 'c'])).toBe('a, b e c');
  });

  it('gera mensagem válida, citando o nome e assinando pela equipe', () => {
    const out = generateFromTemplate(makePlace(), sender);
    expect(OutreachSchema.parse(out)).toEqual(out);
    expect(out.mensagem.split('\n')[0]).toContain('Bistrô do Acarajé');
    expect(out.mensagem).toContain('Equipe MagicMarketing');
    expect(out.mensagem).toContain('um site próprio');
    expect(out.mensagem).not.toMatch(/Instagram ativo|não têm Instagram/);
    expect(out.mensagem).not.toContain('reputação');
  });

  it('elogia a reputação só com nota alta e muitas avaliações', () => {
    expect(generateFromTemplate(makePlace({ avaliacao: 4.7, qtdAvaliacao: 800 }), sender).mensagem).toContain('reputação');
    expect(generateFromTemplate(makePlace({ avaliacao: 4.7, qtdAvaliacao: 20 }), sender).mensagem).not.toContain('reputação');
    expect(generateFromTemplate(makePlace({ avaliacao: 3.9, qtdAvaliacao: 800 }), sender).mensagem).not.toContain('reputação');
  });

  it('assina com o nome e cargo quando configurados', () => {
    const out = generateFromTemplate(makePlace(), { company: 'MagicMarketing', name: 'Ana Souza', role: 'consultora' });
    expect(out.mensagem).toContain('Meu nome é Ana Souza, sou consultora na MagicMarketing');
    expect(out.mensagem).toContain('Ana Souza, consultora da MagicMarketing');
  });

  it('é determinístico (mesma entrada, mesma mensagem)', () => {
    expect(generateFromTemplate(makePlace(), sender)).toEqual(generateFromTemplate(makePlace(), sender));
  });

  it('createGenerator("template") funciona sem rede nem chave', async () => {
    const generator = createGenerator({ provider: 'template', model: 'template-v2', sender });
    expect(generator.id).toBe('template:template-v2');
    await expect(generator.generate(makePlace())).resolves.toHaveProperty('canal_sugerido', 'visita');
  });
});

describe('buildInput', () => {
  it('só envia nota/avaliações quando existem (Google)', () => {
    expect(buildInput(makePlace())).not.toContain('Nota');
    expect(buildInput(makePlace({ avaliacao: 4.5, qtdAvaliacao: 10 }))).toContain('Nota no Google Maps (0 a 5): 4.5');
  });
});
