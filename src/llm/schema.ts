import { z } from 'zod';

export const CHANNELS = ['whatsapp', 'email', 'instagram', 'telefone', 'visita'] as const;

/** Formato que toda geração de mensagem deve devolver (validado com zod). */
export const OutreachSchema = z.strictObject({
  assunto: z.string().min(1).max(120).describe('Assunto curto, para e-mail ou primeira linha'),
  mensagem: z.string().min(20).describe('Mensagem de prospecção completa, em texto puro'),
  canal_sugerido: z.enum(CHANNELS).describe('Melhor canal de contato com base nos dados disponíveis'),
});

export type Outreach = z.infer<typeof OutreachSchema>;
