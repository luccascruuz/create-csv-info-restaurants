import type { Place } from '../types.ts';

export interface Sender {
  company: string;
  name: string;
  role: string;
}

export function signature(sender: Sender): string {
  return sender.name ? `${sender.name}${sender.role ? `, ${sender.role}` : ''} da ${sender.company}` : `Equipe ${sender.company}`;
}

export function buildInstructions(sender: Sender): string {
  return `
Você escreve mensagens de prospecção para a ${sender.company}, uma empresa de marketing digital.
Responda SOMENTE com JSON no formato pedido.

Regras para "mensagem":
- No máximo 200 palavras, em português do Brasil, em texto puro (sem markdown).
- Tom profissional, mas personalizado para o tipo de estabelecimento. Nada genérico.
- Sempre comece citando o nome do estabelecimento.
- Faça uma breve apresentação de quem assina e do cargo.
- Deixe claro que a ${sender.company} atende qualquer demanda de marketing digital.
- NÃO cite números de nota ou quantidade de avaliações; use-os só para calibrar o tom.
- Se não houver site, mencione isso como oportunidade. Nunca afirme que não têm Instagram ou redes sociais (essa informação pode simplesmente não estar disponível).
- Se a nota for alta e houver muitas avaliações, elogie a reputação (sem citar números).
- Termine assinando como: ${signature(sender)}.

Regras para "canal_sugerido": whatsapp se houver telefone celular, instagram se houver Instagram,
email se houver só site, telefone se houver só telefone fixo, visita se não houver contato.
`.trim();
}

export function buildInput(place: Place): string {
  const lines = [
    `Nome: ${place.nome}`,
    `Tipo: ${place.tipo}`,
    `Culinária/categorias: ${place.categorias.join(', ') || 'não informado'}`,
    `Endereço: ${place.endereco || 'não informado'}`,
    `Telefone: ${place.telefone ?? 'não possui'}`,
    `Site: ${place.site ?? 'não possui'}`,
    `Instagram: ${place.instagram ?? 'não informado'}`,
  ];
  if (place.avaliacao !== null) lines.push(`Nota no Google Maps (0 a 5): ${place.avaliacao}`);
  if (place.qtdAvaliacao !== null) lines.push(`Quantidade de avaliações: ${place.qtdAvaliacao}`);
  return `Informações do estabelecimento:\n${lines.map((l) => `- ${l}`).join('\n')}`;
}
