import { z } from 'zod'

/**
 * Transcrição bruta da conversa (V0.2 — Patient Voice Discovery).
 * O RAW mora aqui, no store, referenciado por eventos via transcript_ref —
 * nunca solto dentro do log de eventos (princípio de ponteiro, docs/14).
 * A conversa por voz e por texto convergem para o mesmo formato: turnos.
 */
export const TranscriptTurn = z.object({
  turn: z.number().int().min(0),
  speaker: z.enum(['nexavitta', 'paciente']),
  text: z.string(),
  recorded_at: z.string().datetime(),
  prompt_id: z.string().nullable().optional(), // qual prompt do fluxo gerou este turno (lado nexavitta)
})
export type TranscriptTurn = z.infer<typeof TranscriptTurn>

export const TranscriptRecord = z.object({
  case_id: z.string(),
  input_mode: z.enum(['texto', 'voz']),
  flow_version: z.string(),
  turns: z.array(TranscriptTurn),
  created_at: z.string().datetime(),
})
export type TranscriptRecord = z.infer<typeof TranscriptRecord>
