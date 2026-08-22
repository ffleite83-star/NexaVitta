import { OPEN_PROMPTS, PROBES, CONTEXTUAL_PROMPTS, CLOSING_TEXT, FlowPrompt } from './flow'
import { extractProfileSignals, hasSignal, ExtractionResult } from './extractor'
import { CONVERSATION_FLOW_VERSION } from '../matching/versions'
import type { TranscriptTurn } from '../matching/schema/transcript'
import type { StyleDimension } from '../matching/schema/common'

/**
 * Conversation Engine (V0.2) — máquina de estado pura, sem persistência,
 * sem IA. Recebe texto (de digitação OU de transcrição de voz — a origem
 * não importa aqui, ver input.ts), decide a próxima pergunta e, ao final,
 * produz a extração de sinais para o checkpoint de transparência.
 *
 * Adaptativo de forma simples e honesta: as sondagens só são feitas para
 * dimensões que ficaram SEM sinal depois das perguntas abertas
 * ("aprofundar somente quando necessário", pedido V0.2, seção 4).
 */

export type InputMode = 'texto' | 'voz'

export interface ConversationState {
  flow_version: string
  input_mode: InputMode
  turns: TranscriptTurn[]
  asked_prompt_ids: string[]
  patient_responses: Array<{ prompt_id: string; text: string; recorded_at: string }>
  phase: 'abertas' | 'sondagens' | 'contextual' | 'fechada'
}

export interface NextStep {
  state: ConversationState
  prompt: FlowPrompt | null // null = conversa terminou, hora do checkpoint
  closing_text: string | null
}

function nowIso(now?: () => string): string {
  return (now ?? (() => new Date().toISOString()))()
}

function pushNexaTurn(state: ConversationState, prompt: FlowPrompt, at: string): ConversationState {
  return {
    ...state,
    turns: [
      ...state.turns,
      { turn: state.turns.length, speaker: 'nexavitta', text: prompt.text, recorded_at: at, prompt_id: prompt.id },
    ],
    asked_prompt_ids: [...state.asked_prompt_ids, prompt.id],
  }
}

export function startConversation(inputMode: InputMode, now?: () => string): NextStep {
  const at = nowIso(now)
  let state: ConversationState = {
    flow_version: CONVERSATION_FLOW_VERSION,
    input_mode: inputMode,
    turns: [],
    asked_prompt_ids: [],
    patient_responses: [],
    phase: 'abertas',
  }
  const first = OPEN_PROMPTS[0]!
  state = pushNexaTurn(state, first, at)
  return { state, prompt: first, closing_text: null }
}

export function allPatientText(state: ConversationState): string {
  return state.patient_responses.map((r) => r.text).join('\n')
}

function nextPrompt(state: ConversationState): FlowPrompt | null {
  // 1) perguntas abertas restantes
  const openLeft = OPEN_PROMPTS.find((p) => !state.asked_prompt_ids.includes(p.id))
  if (openLeft) return openLeft

  // 2) sondagens só para dimensões sem sinal até aqui
  const { style } = extractProfileSignals(allPatientText(state), '1970-01-01T00:00:00.000Z')
  const probeLeft = PROBES.find(
    (p) => !state.asked_prompt_ids.includes(p.id) && p.targets !== 'engagement' && !hasSignal(style, p.targets as StyleDimension)
  )
  if (probeLeft) return probeLeft

  // 3) pergunta contextual de engajamento (sempre, uma vez — é contextual, não eixo)
  const contextualLeft = CONTEXTUAL_PROMPTS.find((p) => !state.asked_prompt_ids.includes(p.id))
  if (contextualLeft) return contextualLeft

  return null
}

/**
 * Registra a resposta do paciente ao último prompt e devolve o próximo passo.
 * prompt = null significa: conversa terminou, chame extractForCheckpoint().
 */
export function submitResponse(state: ConversationState, patientText: string, now?: () => string): NextStep {
  const at = nowIso(now)
  const lastPromptId = state.asked_prompt_ids[state.asked_prompt_ids.length - 1] ?? 'desconhecido'

  let next: ConversationState = {
    ...state,
    turns: [
      ...state.turns,
      { turn: state.turns.length, speaker: 'paciente', text: patientText, recorded_at: at, prompt_id: null },
    ],
    patient_responses: [...state.patient_responses, { prompt_id: lastPromptId, text: patientText, recorded_at: at }],
  }

  const prompt = nextPrompt(next)
  if (prompt == null) {
    next = { ...next, phase: 'fechada' }
    return { state: next, prompt: null, closing_text: CLOSING_TEXT }
  }

  const phase: ConversationState['phase'] = prompt.kind === 'aberta' ? 'abertas' : prompt.kind === 'sondagem' ? 'sondagens' : 'contextual'
  next = pushNexaTurn({ ...next, phase }, prompt, at)
  return { state: next, prompt, closing_text: null }
}

/** Extração final para o checkpoint de transparência e para o perfil. */
export function extractForCheckpoint(state: ConversationState, now?: () => string): ExtractionResult {
  return extractProfileSignals(allPatientText(state), nowIso(now))
}

/**
 * Resumo em linguagem natural para o checkpoint — sem números, sem escala,
 * sem jargão clínico. Só dimensões COM leitura entram; ausência de leitura
 * é dito abertamente, não maquiado.
 */
export function summarizeForCheckpoint(extraction: ExtractionResult): string[] {
  const lines: string[] = []
  const s = extraction.style

  const d = s.directiveness
  if (d?.value != null) {
    lines.push(
      d.value >= 5
        ? 'Parece que você prefere alguém que ajude ativamente a organizar os caminhos.'
        : d.value <= 3
          ? 'Parece que você prefere conduzir a conversa no seu próprio ritmo, com o profissional dando espaço.'
          : 'Sobre condução, você parece confortável com um meio-termo.'
    )
  }

  const e = s.emotional_intensity
  if (e?.value != null) {
    lines.push(
      e.value >= 5
        ? 'Falar do que você sente parece vir com naturalidade para você.'
        : e.value <= 3
          ? 'Você parece preferir ir com mais calma na parte emocional, num tom mais prático.'
          : 'Na parte emocional, você parece transitar entre abrir e conter.'
    )
  }

  const t = s.temporal_focus
  if (t?.value != null) {
    lines.push(
      t.value >= 5
        ? 'O que você quer entender parece estar bem ligado à sua história, ao que vem de mais longe.'
        : t.value <= 3
          ? 'Seu foco parece estar no que está acontecendo agora, no momento atual.'
          : 'Você parece se mover entre o agora e a sua história.'
    )
  }

  const sc = s.support_challenge
  if (sc?.value != null) {
    lines.push(
      sc.value >= 5
        ? 'Você parece valorizar acolhimento primeiro — um espaço seguro antes de qualquer coisa.'
        : sc.value <= 3
          ? 'Você parece preferir alguém direto, que te provoque a olhar por outros ângulos.'
          : 'Entre acolhimento e provocação, você parece valorizar um equilíbrio.'
    )
  }

  const conflicting = (['directiveness', 'emotional_intensity', 'temporal_focus', 'support_challenge'] as const).filter(
    (dim) => s[dim]?.value == null && s[dim]?.evidence != null
  )
  for (const dim of conflicting) {
    lines.push('Em alguns pontos você trouxe sinais em direções diferentes — e tudo bem, isso também é informação.')
    break
  }

  if (lines.length === 0) {
    lines.push('Ainda não consegui formar uma leitura clara das suas preferências — e prefiro não adivinhar.')
  }

  return lines
}
