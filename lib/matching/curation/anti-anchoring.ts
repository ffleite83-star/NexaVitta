import { StyleProfile } from '../schema/common'
import { MathEngineOutput } from '../engine/math-engine'
import { AI_SHADOW_PROMPT_VERSION } from '../versions'
import type {
  CuratorIndependentJudgment,
  CuratorFinalDecision,
  AIShadowComputed,
} from '../schema/events'

/**
 * Fluxo anti-ancoragem (pedido original, seção 11; docs/13, seção 5).
 *
 * A ordem é imposta PELA ASSINATURA DAS FUNÇÕES, não por convenção verbal:
 * `recordCuratorIndependentJudgment` e `recordAIShadowHypothesis` não recebem
 * (e não podem receber) o resultado do motor matemático nem um do outro —
 * essas funções simplesmente não têm parâmetro por onde esse dado entraria.
 * Só depois de ter os DOIS registros independentes em mãos é possível chamar
 * `revealAndDecide`, que é o único ponto do sistema que já viu tudo.
 */

let seq = 0
function eventId(prefix: string): string {
  seq += 1
  return `${prefix}_${Date.now()}_${seq}`
}

export interface RecordCuratorJudgmentInput {
  case_id: string
  curator_id: string
  recommended_psychologist_id: string
  reasoning: string
  now?: () => string
}

/**
 * Curador registra seu palpite ANTES de ver matemática ou IA.
 * saw_math_output e saw_ai_output são sempre `false` — são provas estruturais,
 * não flags que alguém preenche.
 */
export function recordCuratorIndependentJudgment(
  input: RecordCuratorJudgmentInput
): CuratorIndependentJudgment {
  const now = (input.now ?? (() => new Date().toISOString()))()
  return {
    case_id: input.case_id,
    event_id: eventId('curator_judgment'),
    recorded_at: now,
    type: 'curator_independent_judgment',
    curator_id: input.curator_id,
    recommended_psychologist_id: input.recommended_psychologist_id,
    reasoning: input.reasoning,
    saw_math_output: false,
    saw_ai_output: false,
  }
}

export interface RecordAIShadowInput {
  case_id: string
  model_version: string
  hypothesis_profile: StyleProfile
  hypothesis_ranking: string[]
  confidence_note: string
  now?: () => string
}

/**
 * IA Shadow em V0 é MANUAL: um humano aplica o prompt versionado à conversa
 * bruta e registra o resultado aqui. Reforça a regra de não-contaminação
 * (pedido original, seção 3/20): esta função não aceita nem output do motor
 * matemático, nem decisão do curador, nem escolha do paciente, nem resultado —
 * a lista de contaminação abaixo é sempre `false` porque não há por onde
 * esses dados entrarem.
 */
export function recordAIShadowHypothesis(input: RecordAIShadowInput): AIShadowComputed {
  const now = (input.now ?? (() => new Date().toISOString()))()
  return {
    case_id: input.case_id,
    event_id: eventId('ai_shadow'),
    recorded_at: now,
    type: 'ai_shadow_computed',
    model_version: input.model_version,
    prompt_version: AI_SHADOW_PROMPT_VERSION,
    hypothesis_profile: input.hypothesis_profile,
    hypothesis_ranking: input.hypothesis_ranking,
    confidence_note: input.confidence_note,
    contamination_check: {
      received_math_output: false,
      received_curator_output: false,
      received_patient_choice: false,
      received_outcome: false,
    },
  }
}

export interface RevealAndDecideInput {
  case_id: string
  curator_id: string
  independent_judgment: CuratorIndependentJudgment
  math_output: MathEngineOutput
  ai_shadow: AIShadowComputed
  final_psychologist_id: string
  divergence_reason?: string | null
  now?: () => string
}

/**
 * Só aqui, DEPOIS dos dois registros independentes existirem, o curador vê
 * matemática e IA lado a lado e decide de fato. `final_psychologist_id` não
 * precisa coincidir com `independent_judgment` — divergência é dado, não erro
 * (docs/13, seção 5: divergência sistemática é sinal de aprendizado).
 */
export function revealAndDecide(input: RevealAndDecideInput): CuratorFinalDecision {
  const now = (input.now ?? (() => new Date().toISOString()))()
  const mathTop = input.math_output.ranked[0] ?? null
  const aiTop = input.ai_shadow.hypothesis_ranking[0] ?? null

  return {
    case_id: input.case_id,
    event_id: eventId('curator_decision'),
    recorded_at: now,
    type: 'curator_final_decision',
    curator_id: input.curator_id,
    final_psychologist_id: input.final_psychologist_id,
    agreed_with_math: mathTop != null && mathTop === input.final_psychologist_id,
    agreed_with_ai: aiTop != null && aiTop === input.final_psychologist_id,
    divergence_reason: input.divergence_reason ?? null,
  }
}

/** Comparação de concordância entre as 3 hipóteses — só para leitura/analytics, nunca decide nada. */
export function compareHypotheses(
  independentJudgment: CuratorIndependentJudgment,
  mathOutput: MathEngineOutput,
  aiShadow: AIShadowComputed
) {
  const mathTop = mathOutput.ranked[0] ?? null
  const aiTop = aiShadow.hypothesis_ranking[0] ?? null
  const curatorTop = independentJudgment.recommended_psychologist_id
  return {
    curator_top: curatorTop,
    math_top: mathTop,
    ai_top: aiTop,
    curator_agrees_with_math: mathTop != null && mathTop === curatorTop,
    curator_agrees_with_ai: aiTop != null && aiTop === curatorTop,
    math_agrees_with_ai: mathTop != null && aiTop != null && mathTop === aiTop,
    all_three_agree: curatorTop === mathTop && mathTop === aiTop,
  }
}
