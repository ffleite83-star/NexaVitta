import type { CaseStore } from '../store/types'
import type { CaseEvent } from '../schema/events'

/**
 * Reconstrução de caso (pedido original, seção 12/14): dado um case_id,
 * responder "o que o paciente disse, o que a IA entendeu, o que o curador
 * entendeu, o que a matemática calculou, quem foi considerado/escolhido,
 * o paciente concordou, o que aconteceu depois" — sem precisar de UX,
 * só abrindo o log de eventos e andando em ordem.
 *
 * Isso não é um relatório bonito — é a prova de que a trilha de decisão
 * existe e pode ser reconstruída por completo a qualquer momento.
 */
export interface DecisionTrail {
  case_id: string
  event_count: number
  timeline: string[] // narrativa cronológica, uma linha por evento
  conversation: {
    started: boolean
    completed: boolean
    abandoned_at_stage: string | null
    response_turns: number
    transcript_ref: string | null
    flow_version: string | null
  }
  profile_review: {
    confirmed: boolean
    corrections: Array<{
      dimension: string
      previous_value: number | null
      corrected_value: number | null
      correction_note: string | null
    }>
  }
  independent_readings: {
    curator_recommended: string | null
    curator_reasoning: string | null
    ai_shadow_top: string | null
    ai_shadow_ranking: string[] | null
  }
  math_engine: {
    ranked: string[] | null
    eligible_candidates: string[] | null
    excluded_candidates: Array<{ psychologist_id: string; reason: string }> | null
  }
  final_decision: {
    curator_id: string | null
    final_psychologist_id: string | null
    agreed_with_math: boolean | null
    agreed_with_ai: boolean | null
    divergence_reason: string | null
  }
  presented_to_patient: {
    presented_psychologist_ids: string[] | null
    highlighted_psychologist_id: string | null
  }
  patient_response: {
    response: string | null
    chosen_psychologist_id: string | null
  }
  outcome: {
    sessions_completed: number
    last_status: string | null
  }
}

export async function reconstructCase(store: CaseStore, caseId: string): Promise<DecisionTrail> {
  const events = await store.getEventsForCase(caseId)
  const sorted = [...events].sort((a, b) => a.recorded_at.localeCompare(b.recorded_at))

  const trail: DecisionTrail = {
    case_id: caseId,
    event_count: sorted.length,
    timeline: [],
    conversation: { started: false, completed: false, abandoned_at_stage: null, response_turns: 0, transcript_ref: null, flow_version: null },
    profile_review: { confirmed: false, corrections: [] },
    independent_readings: {
      curator_recommended: null,
      curator_reasoning: null,
      ai_shadow_top: null,
      ai_shadow_ranking: null,
    },
    math_engine: { ranked: null, eligible_candidates: null, excluded_candidates: null },
    final_decision: {
      curator_id: null,
      final_psychologist_id: null,
      agreed_with_math: null,
      agreed_with_ai: null,
      divergence_reason: null,
    },
    presented_to_patient: { presented_psychologist_ids: null, highlighted_psychologist_id: null },
    patient_response: { response: null, chosen_psychologist_id: null },
    outcome: { sessions_completed: 0, last_status: null },
  }

  for (const ev of sorted) {
    trail.timeline.push(describeEvent(ev))

    switch (ev.type) {
      case 'conversation_started':
        trail.conversation.started = true
        break
      case 'conversation_response':
        trail.conversation.response_turns += 1
        break
      case 'conversation_completed':
        trail.conversation.completed = true
        break
      case 'transcription_created':
        trail.conversation.transcript_ref = ev.transcript_ref
        trail.conversation.flow_version = ev.flow_version
        break
      case 'profile_confirmed':
        trail.profile_review.confirmed = true
        break
      case 'profile_corrected':
        trail.profile_review.corrections.push({
          dimension: ev.dimension,
          previous_value: ev.previous_value,
          corrected_value: ev.corrected_value,
          correction_note: ev.correction_note ?? null,
        })
        break
      case 'conversation_abandoned':
        trail.conversation.abandoned_at_stage = ev.stage
        break
      case 'curator_independent_judgment':
        trail.independent_readings.curator_recommended = ev.recommended_psychologist_id
        trail.independent_readings.curator_reasoning = ev.reasoning
        break
      case 'ai_shadow_computed':
        trail.independent_readings.ai_shadow_top = ev.hypothesis_ranking[0] ?? null
        trail.independent_readings.ai_shadow_ranking = ev.hypothesis_ranking
        break
      case 'math_engine_computed':
        trail.math_engine.ranked = ev.ranked
        trail.math_engine.eligible_candidates = ev.eligible_candidates
        trail.math_engine.excluded_candidates = ev.excluded_candidates
        break
      case 'curator_final_decision':
        trail.final_decision.curator_id = ev.curator_id
        trail.final_decision.final_psychologist_id = ev.final_psychologist_id
        trail.final_decision.agreed_with_math = ev.agreed_with_math
        trail.final_decision.agreed_with_ai = ev.agreed_with_ai
        trail.final_decision.divergence_reason = ev.divergence_reason ?? null
        break
      case 'recommendation_presented':
        trail.presented_to_patient.presented_psychologist_ids = ev.presented_psychologist_ids
        trail.presented_to_patient.highlighted_psychologist_id = ev.highlighted_psychologist_id
        break
      case 'patient_response':
        trail.patient_response.response = ev.response
        trail.patient_response.chosen_psychologist_id = ev.chosen_psychologist_id ?? null
        break
      case 'session_completed':
        trail.outcome.sessions_completed += 1
        break
      case 'status_changed':
        trail.outcome.last_status = ev.status
        break
      default:
        break
    }
  }

  return trail
}

function describeEvent(ev: CaseEvent): string {
  const ts = ev.recorded_at
  switch (ev.type) {
    case 'conversation_started':
      return `[${ts}] Conversa iniciada (paciente=${ev.patient_id}, canal=${ev.channel})`
    case 'conversation_response':
      return `[${ts}] Resposta do paciente no turno ${ev.turn} (prompt=${ev.prompt_id}, modo=${ev.input_mode})`
    case 'conversation_completed':
      return `[${ts}] Conversa concluída`
    case 'transcription_created':
      return `[${ts}] Transcrição registrada (${ev.turn_count} turnos, fluxo ${ev.flow_version})`
    case 'profile_confirmed':
      return `[${ts}] Paciente confirmou a leitura do perfil`
    case 'profile_corrected':
      return `[${ts}] Paciente corrigiu "${ev.dimension}": ${ev.previous_value} -> ${ev.corrected_value}`
    case 'conversation_abandoned':
      return `[${ts}] Conversa abandonada no estágio "${ev.stage}"${ev.reason ? ` (motivo: ${ev.reason})` : ''}`
    case 'profile_extracted':
      return `[${ts}] Perfil extraído por ${ev.extracted_by}`
    case 'math_engine_computed':
      return `[${ts}] Motor matemático (${ev.engine_version}) rankeou: ${ev.ranked.join(' > ') || '(vazio)'}`
    case 'ai_shadow_computed':
      return `[${ts}] IA Shadow (modelo ${ev.model_version}) hipótese: ${ev.hypothesis_ranking.join(' > ') || '(vazio)'}`
    case 'curator_independent_judgment':
      return `[${ts}] Curador ${ev.curator_id} — julgamento independente: ${ev.recommended_psychologist_id}`
    case 'curator_final_decision':
      return `[${ts}] Curador ${ev.curator_id} — decisão final: ${ev.final_psychologist_id} (concordou c/ matemática=${ev.agreed_with_math}, c/ IA=${ev.agreed_with_ai})`
    case 'recommendation_presented':
      return `[${ts}] Apresentado ao paciente: [${ev.presented_psychologist_ids.join(', ')}]${ev.highlighted_psychologist_id ? `, destaque=${ev.highlighted_psychologist_id}` : ''}`
    case 'patient_response':
      return `[${ts}] Resposta do paciente: ${ev.response}${ev.chosen_psychologist_id ? ` (${ev.chosen_psychologist_id})` : ''}`
    case 'session_completed':
      return `[${ts}] Sessão #${ev.session_number} concluída com ${ev.psychologist_id}`
    case 'status_changed':
      return `[${ts}] Status do caso mudou para "${ev.status}"${ev.reason ? ` (${ev.reason})` : ''}`
    default:
      return `[${ts}] Evento desconhecido`
  }
}
