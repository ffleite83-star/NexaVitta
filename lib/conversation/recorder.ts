import type { CaseStore } from '../matching/store/types'
import type { ConversationState } from './engine'
import { extractForCheckpoint } from './engine'
import type { PatientProfileRecord } from '../matching/schema/patient'
import type { StyleDimension, Constraints } from '../matching/schema/common'
import { PROFILE_SCHEMA_VERSION } from '../matching/versions'

/**
 * Recorder (V0.2): a ÚNICA ponte entre a conversa e o Data Backbone.
 * Engine não conhece store; store não conhece engine. Tudo que acontece
 * vira evento no trail + registros no CaseStore existente — nenhum modelo
 * paralelo foi criado (pedido V0.2, seção 7).
 */

let seq = 0
function eventId(prefix: string): string {
  seq += 1
  return `${prefix}_${Date.now()}_${seq}`
}

function nowIso(now?: () => string): string {
  return (now ?? (() => new Date().toISOString()))()
}

export interface CompleteConversationInput {
  case_id: string
  patient_id: string
  state: ConversationState
  constraints?: Constraints // logística coletada fora da conversa de estilo (V0.2 não coleta na conversa)
  now?: () => string
}

export interface CompleteConversationOutput {
  profile: PatientProfileRecord
}

/**
 * Registra uma conversa CONCLUÍDA: eventos de início/respostas/conclusão,
 * transcrição (RAW), extração de sinais e perfil estruturado.
 * O perfil embutido no evento profile_extracted é a interpretação ORIGINAL —
 * correções posteriores nunca a sobrescrevem (ver recordProfileCorrections).
 */
export async function recordCompletedConversation(
  store: CaseStore,
  input: CompleteConversationInput
): Promise<CompleteConversationOutput> {
  const { case_id, patient_id, state } = input
  const at = nowIso(input.now)

  const startedAt = state.turns[0]?.recorded_at ?? at
  await store.appendEvent({
    case_id,
    event_id: eventId('conv_start'),
    recorded_at: startedAt,
    type: 'conversation_started',
    patient_id,
    channel: state.input_mode,
    conducted_by: null, // conduzida pelo fluxo guiado, não por um humano
  })

  for (const [i, resp] of state.patient_responses.entries()) {
    await store.appendEvent({
      case_id,
      event_id: eventId('conv_resp'),
      recorded_at: resp.recorded_at,
      type: 'conversation_response',
      turn: i,
      prompt_id: resp.prompt_id,
      input_mode: state.input_mode,
      response_length: resp.text.length,
    })
  }

  await store.appendEvent({
    case_id,
    event_id: eventId('conv_done'),
    recorded_at: at,
    type: 'conversation_completed',
    transcript_ref: case_id,
  })

  await store.saveTranscript({
    case_id,
    input_mode: state.input_mode,
    flow_version: state.flow_version,
    turns: state.turns,
    created_at: at,
  })

  await store.appendEvent({
    case_id,
    event_id: eventId('transcript'),
    recorded_at: at,
    type: 'transcription_created',
    transcript_ref: case_id,
    turn_count: state.turns.length,
    flow_version: state.flow_version,
  })

  const extraction = extractForCheckpoint(state, input.now)
  const profile: PatientProfileRecord = {
    case_id,
    patient_id,
    profile_version: PROFILE_SCHEMA_VERSION,
    style: extraction.style,
    engagement_expectation: extraction.engagement,
    constraints: input.constraints ?? { modality: [], price_band: null, availability_windows: [] },
    recorded_at: at,
  }
  await store.savePatientProfile(profile)

  await store.appendEvent({
    case_id,
    event_id: eventId('profile'),
    recorded_at: at,
    type: 'profile_extracted',
    profile,
    // Proveniência honesta: não é IA, não é curador — é o extrator
    // heurístico determinístico do Conversation Engine.
    extracted_by: 'regra_deterministica',
  })

  return { profile }
}

export interface AbandonInput {
  case_id: string
  patient_id: string
  state: ConversationState
  stage: string
  reason?: string | null
  now?: () => string
}

/** Conversa abandonada: caso incompleto fica registrado, com o RAW parcial preservado. */
export async function recordAbandonedConversation(store: CaseStore, input: AbandonInput): Promise<void> {
  const at = nowIso(input.now)
  const startedAt = input.state.turns[0]?.recorded_at ?? at

  await store.appendEvent({
    case_id: input.case_id,
    event_id: eventId('conv_start'),
    recorded_at: startedAt,
    type: 'conversation_started',
    patient_id: input.patient_id,
    channel: input.state.input_mode,
    conducted_by: null,
  })

  for (const [i, resp] of input.state.patient_responses.entries()) {
    await store.appendEvent({
      case_id: input.case_id,
      event_id: eventId('conv_resp'),
      recorded_at: resp.recorded_at,
      type: 'conversation_response',
      turn: i,
      prompt_id: resp.prompt_id,
      input_mode: input.state.input_mode,
      response_length: resp.text.length,
    })
  }

  // RAW parcial também é dado — transcrição salva mesmo sem conclusão.
  if (input.state.turns.length > 0) {
    await store.saveTranscript({
      case_id: input.case_id,
      input_mode: input.state.input_mode,
      flow_version: input.state.flow_version,
      turns: input.state.turns,
      created_at: at,
    })
    await store.appendEvent({
      case_id: input.case_id,
      event_id: eventId('transcript'),
      recorded_at: at,
      type: 'transcription_created',
      transcript_ref: input.case_id,
      turn_count: input.state.turns.length,
      flow_version: input.state.flow_version,
    })
  }

  await store.appendEvent({
    case_id: input.case_id,
    event_id: eventId('conv_abandon'),
    recorded_at: at,
    type: 'conversation_abandoned',
    stage: input.stage,
    reason: input.reason ?? null,
  })
}

/** Paciente confirmou a leitura no checkpoint. */
export async function recordProfileConfirmation(store: CaseStore, caseId: string, now?: () => string): Promise<void> {
  await store.appendEvent({
    case_id: caseId,
    event_id: eventId('confirm'),
    recorded_at: nowIso(now),
    type: 'profile_confirmed',
    confirmed_by: 'paciente',
  })
}

export interface ProfileCorrection {
  dimension: StyleDimension
  corrected_value: number | null
  correction_note?: string | null
}

/**
 * Paciente corrigiu a leitura no checkpoint.
 * A interpretação ORIGINAL nunca é sobrescrita: ela vive no evento
 * profile_extracted. Aqui geramos eventos profile_corrected (um por
 * dimensão) e salvamos um NOVO registro de perfil onde o valor corrigido
 * entra com source='paciente_declarado' — proveniência honesta.
 */
export async function recordProfileCorrections(
  store: CaseStore,
  caseId: string,
  corrections: ProfileCorrection[],
  now?: () => string
): Promise<PatientProfileRecord | null> {
  const at = nowIso(now)
  const current = await store.getPatientProfile(caseId)
  if (!current) return null

  const updatedStyle = { ...current.style }

  for (const corr of corrections) {
    const previous = current.style[corr.dimension]?.value ?? null

    await store.appendEvent({
      case_id: caseId,
      event_id: eventId('correct'),
      recorded_at: at,
      type: 'profile_corrected',
      corrected_by: 'paciente',
      dimension: corr.dimension,
      previous_value: previous,
      corrected_value: corr.corrected_value,
      correction_note: corr.correction_note ?? null,
    })

    updatedStyle[corr.dimension] = {
      value: corr.corrected_value,
      source: 'paciente_declarado',
      recorded_at: at,
      evidence: corr.correction_note ?? null,
      confidence: 'alta', // a própria pessoa disse — maior confiança possível neste sistema
    }
  }

  const updated: PatientProfileRecord = { ...current, style: updatedStyle, recorded_at: at }
  await store.savePatientProfile(updated)
  return updated
}
