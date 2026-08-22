import type { CaseStore } from '../matching/store/types'
import { STYLE_DIMENSIONS, StyleDimension } from '../matching/schema/common'
import { getFirstInterpretations } from './interpretation'

/**
 * V0.3 — REVEAL e comparação das três leituras sobre o mesmo RAW.
 *
 * Decisão de métrica (documentada, não silenciosa): a comparação usa BUCKETS,
 * não igualdade exata na escala 1-7. Exigir 6 === 7 chamaria de "discordância"
 * duas leituras que dizem a mesma coisa. Buckets:
 *   null -> sem_leitura | 1-3 -> baixo | 4 -> medio | 5-7 -> alto
 * Os valores brutos e as evidências ficam preservados lado a lado — a
 * diferença numérica NÃO é tratada como erro (pedido V0.3, seção 13).
 */

export type Bucket = 'sem_leitura' | 'baixo' | 'medio' | 'alto'

export function toBucket(value: number | null | undefined): Bucket {
  if (value == null) return 'sem_leitura'
  if (value <= 3) return 'baixo'
  if (value === 4) return 'medio'
  return 'alto'
}

export interface DimensionComparison {
  case_id: string
  dimension: StyleDimension
  regra: { value: number | null; bucket: Bucket; confidence: string | null; evidence: string | null }
  curador: { value: number | null; bucket: Bucket; confidence: string | null; evidence: string | null }
  ia: { value: number | null; bucket: Bucket; confidence: string | null; evidence: string | null }
  ia_igual_curador: boolean
  regra_igual_curador: boolean
  regra_igual_ia: boolean
  ambos_incertos: boolean // IA e curador sem leitura
  todos_divergem: boolean
}

export interface CaseComparison {
  case_id: string
  ready: boolean // reveal só acontece com curador E ia registrados
  missing: string[]
  rows: DimensionComparison[]
  curator_notes: string | null
  ia_notes: string | null
}

/**
 * REVEAL com gate: se curador ou IA ainda não registraram, não há comparação —
 * devolve ready=false e a lista do que falta. A regra determinística é
 * opcional (baseline pode estar ausente sem travar o experimento).
 */
export async function compareCase(store: CaseStore, caseId: string): Promise<CaseComparison> {
  const { regra, curador, ia } = await getFirstInterpretations(store, caseId)

  const missing: string[] = []
  if (!curador) missing.push('curador_humano')
  if (!ia) missing.push('ia_shadow')

  if (missing.length > 0) {
    return { case_id: caseId, ready: false, missing, rows: [], curator_notes: null, ia_notes: null }
  }

  const rows: DimensionComparison[] = STYLE_DIMENSIONS.map((dim) => {
    const pick = (ev: typeof regra) => {
      const d = ev?.profile.style[dim] ?? null
      return {
        value: d?.value ?? null,
        bucket: toBucket(d?.value ?? null),
        confidence: d?.confidence ?? null,
        evidence: d?.evidence ?? null,
      }
    }
    const r = pick(regra)
    const c = pick(curador!)
    const i = pick(ia!)

    const ia_igual_curador = i.bucket === c.bucket
    const regra_igual_curador = r.bucket === c.bucket
    const regra_igual_ia = r.bucket === i.bucket

    return {
      case_id: caseId,
      dimension: dim,
      regra: r,
      curador: c,
      ia: i,
      ia_igual_curador,
      regra_igual_curador,
      regra_igual_ia,
      ambos_incertos: i.bucket === 'sem_leitura' && c.bucket === 'sem_leitura',
      todos_divergem: !ia_igual_curador && !regra_igual_curador && !regra_igual_ia,
    }
  })

  return {
    case_id: caseId,
    ready: true,
    missing: [],
    rows,
    curator_notes: curador!.notes ?? null,
    ia_notes: ia!.notes ?? null,
  }
}

export interface ExperimentMetrics {
  cases_compared: number
  per_dimension: Record<
    string,
    {
      ia_x_curador: number
      regra_x_curador: number
      regra_x_ia: number
      total: number
    }
  >
  nulls: { regra: number; curador: number; ia: number }
  ia_curador_concordam_regra_diverge: number
  regra_ia_concordam_curador_diverge: number
  todos_divergem: number
  ambos_incertos: number
  divergencias_com_evidencia: Array<{
    case_id: string
    dimension: string
    curador: { value: number | null; evidence: string | null }
    ia: { value: number | null; evidence: string | null }
  }>
}

/** Métricas descritivas (V0.3, seção 17) — nada de estatística sofisticada para 12 casos. */
export function computeMetrics(comparisons: CaseComparison[]): ExperimentMetrics {
  const ready = comparisons.filter((c) => c.ready)
  const metrics: ExperimentMetrics = {
    cases_compared: ready.length,
    per_dimension: {},
    nulls: { regra: 0, curador: 0, ia: 0 },
    ia_curador_concordam_regra_diverge: 0,
    regra_ia_concordam_curador_diverge: 0,
    todos_divergem: 0,
    ambos_incertos: 0,
    divergencias_com_evidencia: [],
  }

  for (const dim of STYLE_DIMENSIONS) {
    metrics.per_dimension[dim] = { ia_x_curador: 0, regra_x_curador: 0, regra_x_ia: 0, total: 0 }
  }

  for (const comp of ready) {
    for (const row of comp.rows) {
      const d = metrics.per_dimension[row.dimension]!
      d.total += 1
      if (row.ia_igual_curador) d.ia_x_curador += 1
      if (row.regra_igual_curador) d.regra_x_curador += 1
      if (row.regra_igual_ia) d.regra_x_ia += 1

      if (row.regra.value == null) metrics.nulls.regra += 1
      if (row.curador.value == null) metrics.nulls.curador += 1
      if (row.ia.value == null) metrics.nulls.ia += 1

      if (row.ia_igual_curador && !row.regra_igual_ia) metrics.ia_curador_concordam_regra_diverge += 1
      if (row.regra_igual_ia && !row.ia_igual_curador) metrics.regra_ia_concordam_curador_diverge += 1
      if (row.todos_divergem) metrics.todos_divergem += 1
      if (row.ambos_incertos) metrics.ambos_incertos += 1

      if (!row.ia_igual_curador) {
        metrics.divergencias_com_evidencia.push({
          case_id: row.case_id,
          dimension: row.dimension,
          curador: { value: row.curador.value, evidence: row.curador.evidence },
          ia: { value: row.ia.value, evidence: row.ia.evidence },
        })
      }
    }
  }

  return metrics
}
