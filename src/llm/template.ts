// Gerador GRATUITO e offline, sem IA: monta a mensagem a partir de templates.
// Útil quando não há LLM disponível e para testes.
import type { Place } from '../types.ts';
import { type Sender, signature } from './prompt.ts';
import type { Outreach } from './schema.ts';

/** Hash simples e determinístico, para variar as frases entre estabelecimentos. */
function pick<T>(options: readonly T[], seed: string): T {
  let hash = 0;
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return options[Math.abs(hash) % options.length] as T;
}

/** Celular brasileiro: 9 dígitos começando com 9 após o DDD. */
export function isMobile(phone: string | null): boolean {
  if (!phone) return false;
  const digits = phone.replace(/\D/g, '').replace(/^55/, '');
  return digits.length === 11 && digits[2] === '9';
}

export function suggestChannel(place: Place): Outreach['canal_sugerido'] {
  if (isMobile(place.telefone)) return 'whatsapp';
  if (place.instagram) return 'instagram';
  if (place.site) return 'email';
  if (place.telefone) return 'telefone';
  return 'visita';
}

/** "a", "a e b", "a, b e c" */
export function joinPt(items: string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} e ${items.at(-1)}`;
}

// Os textos evitam artigos antes do nome ("o/a", "do/da"), pois não sabemos o gênero do nome do estabelecimento.
export function generateFromTemplate(place: Place, sender: Sender): Outreach {
  const cozinha = place.categorias[0];
  const foco = cozinha ? `com ${cozinha}` : 'na região';

  const abertura = pick([`Olá, equipe ${place.nome}! Tudo bem?`, `${place.nome}, olá! Tudo certo por aí?`], place.id);

  const apresentacao = sender.name
    ? `Meu nome é ${sender.name}${sender.role ? `, sou ${sender.role}` : ''} na ${sender.company}, uma agência de marketing digital.`
    : `Somos a ${sender.company}, uma agência de marketing digital.`;

  // Só afirma o que os dados mostram: "sem site" é confiável; Instagram nenhuma fonte informa direito,
  // então ele aparece como algo a fortalecer, nunca como "vocês não têm".
  const oportunidades: string[] = [];
  if (!place.site) oportunidades.push('um site próprio com cardápio e pedidos online');
  if (place.qtdAvaliacao !== null && place.qtdAvaliacao < 50) oportunidades.push('mais avaliações positivas no Google');
  oportunidades.push(
    place.instagram ? 'conteúdo profissional para o Instagram de vocês' : 'redes sociais com fotos profissionais dos pratos',
  );
  if (place.site) oportunidades.push('anúncios segmentados levando mais gente ao site');
  const lista = joinPt(oportunidades);

  // Reputação usada como elogio, sem citar números
  const elogio =
    place.avaliacao !== null && place.qtdAvaliacao !== null && place.avaliacao >= 4.5 && place.qtdAvaliacao >= 100
      ? ' A reputação de vocês no Google já é excelente, e isso é uma ótima base para o próximo passo.'
      : '';

  const gancho = pick(
    [
      `Conhecemos o trabalho de vocês ${foco} e enxergamos espaço para atrair ainda mais clientes com ${lista}.`,
      `${place.nome} chamou nossa atenção ${foco}, e acreditamos que ${lista} podem aumentar bastante o movimento de vocês.`,
    ],
    place.nome,
  );

  const mensagem = [
    abertura,
    '',
    apresentacao,
    '',
    gancho + elogio,
    '',
    `Cuidamos de tudo o que envolve marketing digital: redes sociais, tráfego pago, Google Meu Negócio, sites, identidade visual e fotografia. Podemos conversar 15 minutos esta semana para mostrar algumas ideias pensadas especialmente para vocês?`,
    '',
    'Abraço,',
    signature(sender),
  ].join('\n');

  return {
    assunto: `${place.nome}: ideias para atrair mais clientes`.slice(0, 120),
    mensagem,
    canal_sugerido: suggestChannel(place),
  };
}
