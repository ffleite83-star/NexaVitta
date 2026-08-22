import { z } from 'zod'
import { StyleProfile } from './common'
import { PatientProfileRecord } from './patient'

/**
 * A "memória da NexaVitta" é um log de eventos por caso, append-only.
 * Um caso que abandona no meio simplesmente tem menos eventos — nunca some
 * (pedido original, seção 13: "esse caso NÃO pode desaparecer").
 */

const base = {
  case_id: z.string(),
  event_id: z.string(),
  recorded_at: z.string().datetime(),
}

export const ConversationStarted = z.object({
  ...base,
  type: z.literal('conversation_started'),
  patient_id: z.string(),
  channel: z.enum(['texto', 'voz']),
  conducted_by: z.string().nullable().optional(), // humano que conduziu, quando aplicável
})
export type ConversationStarted = z.infer<typeof ConversationStarted>

export const ConversationCompleted = z.object({
  ...base,
  type: z.literal('conversation_completed'),
  transcript_ref: z.string().nullable().optional(), // referência/ponteiro — nunca o texto bruto solto no evento
})
export type ConversationCompleted = z.infer<typeof ConversationCompleted>

/**
 * V0.2 — eventos do Patient Voice Discovery.
 * conversation_response NÃO carrega o texto bruto — só metadado do turno.
 * O RAW mora no TranscriptRecord (ver schema/transcript.ts), referenciado
 * por transcription_created.
 */
export const ConversationResponse = z.object({
  ...base,
  type: z.literal('conversation_response'),
  turn: z.number().int().min(0),
  prompt_id: z.string(),
  input_mode: z.enum(['texto', 'voz']),
  response_length: z.number().int().min(0),
})

export const TranscriptionCreated = z.object({
  ...base,
  type: z.literal('transcription_created'),
  transcript_ref: z.string(), // chave do TranscriptRecord no store (= case_id em V0.2)
  turn_count: z.number().int().min(0),
  flow_version: z.string(),
})

export const ProfileConfirmed = z.object({
  ...base,
  type: z.literal('profile_confirmed'),
  confirmed_by: z.literal('paciente'),
})

export const ProfileCorrected = z.object({
  ...base,
  type: z.literal('profile_corrected'),
  corrected_by: z.literal('paciente'),
  dimension: z.string(),
  previous_value: z.number().nullable(),
  corrected_value: z.number().nullable(),
  correction_note: z.string().nullable().optional(), // fala da pessoa ao corrigir, quando houver
})

export const ConversationAbandoned = z.object({
  ...base,
  type: z.literal('conversation_abandoned'),
  stage: z.string(), // em que ponto parou
  reason: z.string().nullable().optional(),
})
export type ConversationAbandoned = z.infer<typeof ConversationAbandoned>

export const ProfileExtracted = z.object({
  ...base,
  type: z.literal('profile_extracted'),
  profile: PatientProfileRecord,
  // V0.2: 'regra_deterministica' = extrator heurístico do Conversation Engine
  // (não é IA nem curador — proveniência honesta, nunca mascarada).
  extracted_by: z.enum(['curador_humano', 'ia_shadow', 'regra_deterministica']),
  // V0.3 (IA Shadow vs. Curador) — campos opcionais, aditivos:
  interpreter_id: z.string().nullable().optional(), // quem interpretou (curator_id, modelo da IA, versão do extrator)
  notes: z.string().nullable().optional(), // observação qualitativa (curador) ou justificativa curta (IA)
  model_version: z.string().nullable().optional(), // só IA
  prompt_version: z.string().nullable().optional(), // só IA
  // Prova estrutural de anti-ancoragem: a interpretação foi produzida SEM ver
  // as outras. Sempre literal(false) — não há como registrar "true".
  independence_check: z
    .object({
      saw_rule_output: z.literal(false),
      saw_curator_output: z.literal(false),
      saw_ai_output: z.literal(false),
      saw_patient_correction: z.literal(false),
    })
    .nullable()
    .optional(),
})
export type ProfileExtracted = z.infer<typeof ProfileExtracted>

export const MathEngineComputed = z.object({
  ...base,
  type: z.literal('math_engine_computed'),
  engine_version: z.string(),
  eligible_candidates: z.array(z.string()),
  excluded_candidates: z.array(z.object({ psychologist_id: z.string(), reason: z.string() })),
  scores: z.array(
    z.object({
      psychologist_id: z.string(),
      distance: z.number().nullable(),
      compatibility: z.number().nullable(),
      per_dimension: z.record(z.string(), z.number().nullable()),
    })
  ),
  ranked: z.array(z.string()),
})
export type MathEngineComputed = z.infer<typeof MathEngineComputed>

export const AIShadowComputed = z.object({
  ...base,
  type: z.literal('ai_shadow_computed'),
  model_version: z.string(),
  prompt_version: z.string(),
  hypothesis_profile: StyleProfile,
  hypothesis_ranking: z.array(z.string()),
  confidence_note: z.string(),
  // Prova, dentro do próprio dado, que a regra de não-contaminação foi seguida (seção 3/20 do pedido).
  contamination_check: z.object({
    received_math_output: z.literal(false),
    received_curator_output: z.literal(false),
    received_patient_choice: z.literal(false),
    received_outcome: z.literal(false),
  }),
})
export type AIShadowComputed = z.infer<typeof AIShadowComputed>

export const CuratorIndependentJudgment = z.object({
  ...base,
  type: z.literal('curator_independent_judgment'),
  curator_id: z.string(),
  recommended_psychologist_id: z.string(),
  reasoning: z.string(),
  // Prova estrutural de que isso aconteceu antes do reveal (seção 11 do pedido).
  saw_math_output: z.literal(false),
  saw_ai_output: z.literal(false),
})
export type CuratorIndependentJudgment = z.infer<typeof CuratorIndependentJudgment>

export const CuratorFinalDecision = z.object({
  ...base,
  type: z.literal('curator_final_decision'),
  curator_id: z.string(),
  final_psychologist_id: z.string(),
  agreed_with_math: z.boolean(),
  agreed_with_ai: z.boolean(),
  divergence_reason: z.string().nullable().optional(),
})
export type CuratorFinalDecision = z.infer<typeof CuratorFinalDecision>

export const RecommendationPresented = z.object({
  ...base,
  type: z.literal('recommendation_presented'),
  presented_psychologist_ids: z.array(z.string()), // no V0/V1, todos os elegíveis — nunca só 1 (docs/12, seção 9)
  highlighted_psychologist_id: z.string().nullable(),
})
export type RecommendationPresented = z.infer<typeof RecommendationPresented>

export const PatientResponse = z.object({
  ...base,
  type: z.literal('patient_response'),
  response: z.enum(['aceitou_destaque', 'escolheu_outro', 'rejeitou_todos', 'sem_resposta']),
  chosen_psychologist_id: z.string().nullable().optional(),
  reason: z.string().nullable().optional(),
})
export type PatientResponse = z.infer<typeof PatientResponse>

export const SessionCompleted = z.object({
  ...base,
  type: z.literal('session_completed'),
  session_number: z.number().int().min(1),
  psychologist_id: z.string(),
  checkin: z
    .object({
      q1_falou_o_que_precisava: z.number().min(1).max(5).nullable(),
      q2_sentiu_ouvido: z.number().min(1).max(5).nullable(),
      q3_sentiu_compreendido: z.number().min(1).max(5).nullable(),
      q4_sentiu_confianca: z.number().min(1).max(5).nullable(),
      q5_profissional_entendeu_momento: z.number().min(1).max(5).nullable(),
      q6_gostaria_continuar: z.number().min(1).max(5).nullable(),
      q7_marcaria_nova_conversa: z.number().min(1).max(5).nullable(),
      q8_compatibilidade_de_estilo: z.number().min(1).max(5).nullable(), // pergunta nova de docs/12 seção 10
    })
    .partial()
    .nullable()
    .optional(),
})
export type SessionCompleted = z.infer<typeof SessionCompleted>

export const StatusChanged = z.object({
  ...base,
  type: z.literal('status_changed'),
  status: z.enum(['ativo', 'pausado', 'encerrado_alta', 'encerrado_abandono', 'trocou_profissional']),
  reason: z.string().nullable().optional(),
  new_case_id_if_switched: z.string().nullable().optional(),
})
export type StatusChanged = z.infer<typeof StatusChanged>

export type ConversationResponse = z.infer<typeof ConversationResponse>
export type TranscriptionCreated = z.infer<typeof TranscriptionCreated>
export type ProfileConfirmed = z.infer<typeof ProfileConfirmed>
export type ProfileCorrected = z.infer<typeof ProfileCorrected>

export const CaseEvent = z.discriminatedUnion('type', [
  ConversationStarted,
  ConversationResponse,
  ConversationCompleted,
  ConversationAbandoned,
  TranscriptionCreated,
  ProfileConfirmed,
  ProfileCorrected,
  ProfileExtracted,
  MathEngineComputed,
  AIShadowComputed,
  CuratorIndependentJudgment,
  CuratorFinalDecision,
  RecommendationPresented,
  PatientResponse,
  SessionCompleted,
  StatusChanged,
])
export type CaseEvent = z.infer<typeof CaseEvent>
export type CaseEventType = CaseEvent['type']
