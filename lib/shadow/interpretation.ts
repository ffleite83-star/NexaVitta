import type { CaseStore } from '../matching/store/types'
import type { StyleProfile, DimensionValue } from '../matching/schema/common'
import type { ProfileExtracted } from '../matching/schema/events'
import { PROFILE_SCHEMA_VERSION } from '../matching/versions'

/**
 * V0.3 — registro de interpretações independentes sobre o MESMO RAW.
 *
 * Três fontes possíveis, todas usando o MESMO evento (profile_extracted) e o
 * MESMO modelo de perfil — nenhum modelo paralelo:
 *   - regra_deterministica (extrator, baseline técnico)
 *   - curador_humano (psicólogo)
 *   - ia_shadow (IA com prompt versionado)
 *
 * Anti-ancoragem estrutural: registerInterpretation não tem parâmetro por
 * onde outra interpretação entraria, e o independence_check é sempre
 * literal(false). O log é append-only: nada sobrescreve nada.
 *
 * Regra do julgamento travado: para comparação, vale SEMPRE a PRIMEIRA
 * interpretação de cada fonte (getFirstInterpretations). Registros
 * posteriores da mesma fonte ficam no log, mas não substituem o primeiro —
 * o palpite inicial é imutável por construção.
 */

export type InterpretationSource = 'regra_deterministica' | 'curador_humano' | 'ia_shadow'

let seq = 0
function eventId(prefix: string): string {
  seq += 1
  return `${prefix}_${Date.now()}_${seq}`
}

export interface RegisterInterpretationInput {
  case_id: string
  patient_id: string
  source: InterpretationSource
  interpreter_id: string // curator_id | identificador do modelo | versão do extrator
  style: StyleProfile
  engagement?: DimensionValue | null
  notes?: string | null
  model_version?: string | null // só IA
  prompt_version?: string | null // só IA
  now?: () => string
}

export async function registerInterpretation(
  store: CaseStore,
  input: RegisterInterpretationInput
): Promise<ProfileExtracted> {
  const at = (input.now ?? (() => new Date().toISOString()))()

  const event: ProfileExtracted = {
    case_id: input.case_id,
    event_id: eventId(`interp_${input.source}`),
    recorded_at: at,
    type: 'profile_extracted',
    profile: {
      case_id: input.case_id,
      patient_id: input.patient_id,
      profile_version: PROFILE_SCHEMA_VERSION,
      style: input.style,
      engagement_expectation: input.engagement ?? null,
      constraints: { modality: [], price_band: null, availability_windows: [] },
      recorded_at: at,
    },
    extracted_by: input.source,
    interpreter_id: input.interpreter_id,
    notes: input.notes ?? null,
    model_version: input.model_version ?? null,
    prompt_version: input.prompt_version ?? null,
    independence_check: {
      saw_rule_output: false,
      saw_curator_output: false,
      saw_ai_output: false,
      saw_patient_correction: false,
    },
  }

  await store.appendEvent(event)
  return event
}

export interface CaseInterpretations {
  regra: ProfileExtracted | null
  curador: ProfileExtracted | null
  ia: ProfileExtracted | null
  /** registros além do primeiro por fonte — ficam visíveis, mas nunca substituem */
  extra: ProfileExtracted[]
}

/** A PRIMEIRA interpretação de cada fonte é a que vale (julgamento travado). */
export async function getFirstInterpretations(store: CaseStore, caseId: string): Promise<CaseInterpretations> {
  const events = await store.getEventsForCase(caseId)
  const sorted = events
    .filter((e): e is ProfileExtracted => e.type === 'profile_extracted')
    .sort((a, b) => a.recorded_at.localeCompare(b.recorded_at))

  const result: CaseInterpretations = { regra: null, curador: null, ia: null, extra: [] }
  for (const ev of sorted) {
    if (ev.extracted_by === 'regra_deterministica') {
      if (result.regra == null) result.regra = ev
      else result.extra.push(ev)
    } else if (ev.extracted_by === 'curador_humano') {
      if (result.curador == null) result.curador = ev
      else result.extra.push(ev)
    } else if (ev.extracted_by === 'ia_shadow') {
      if (result.ia == null) result.ia = ev
      else result.extra.push(ev)
    }
  }
  return result
}
