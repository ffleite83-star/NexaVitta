import { STYLE_DIMENSIONS, StyleDimension, StyleProfile, Constraints } from '../schema/common'
import { PatientProfileRecord, countFilledStyleDimensions } from '../schema/patient'
import { PsychologistRecord, OBSERVED_PROFILE_MIN_SAMPLE_SIZE } from '../schema/psychologist'
import { MATH_ENGINE_VERSION } from '../versions'

/**
 * Motor Matemático — determinístico, explicável, versionado.
 * Nada de ML aqui (pedido original, seção 1: "não construa modelo preditivo agora").
 *
 * Princípio inegociável (docs/12 seção 4; pedido original seção 9):
 * FILTROS DUROS (logística: modalidade, faixa de preço, disponibilidade) e
 * COMPATIBILIDADE SUAVE (estilo) nunca se misturam na mesma conta. Um psicólogo
 * logisticamente incompatível é EXCLUÍDO antes de qualquer nota de estilo ser
 * calculada — nunca penalizado dentro do score.
 */

// Piso mínimo de dimensões de estilo preenchidas para o score ser considerado
// confiável (docs/12, seção 4). Abaixo disso, ainda calculamos, mas marcamos.
export const MIN_FILLED_DIMENSIONS_FOR_RELIABLE_SCORE = 2

export interface EligibilityResult {
  eligible: string[]
  excluded: Array<{ psychologist_id: string; reason: string }>
}

/**
 * Checagem par-a-par de logística — o núcleo do filtro duro, reutilizado nos
 * dois sentidos do marketplace: paciente->psicólogo (applyHardFilters) e
 * psicólogo->paciente (findCompatiblePatientsForPsychologist, em
 * reverse-compatibility.ts). Mesma regra, direção que muda é só quem chama.
 */
export function checkLogisticFit(
  patientConstraints: Constraints,
  psychologistOffer: Constraints,
  psychologistStatus: PsychologistRecord['status']
): { fits: boolean; reason: string | null } {
  if (psychologistStatus !== 'ativo') {
    return { fits: false, reason: `status=${psychologistStatus}` }
  }

  const wantsModality = patientConstraints.modality
  if (wantsModality.length > 0) {
    const overlap = wantsModality.some((m) => psychologistOffer.modality.includes(m))
    if (!overlap) {
      return {
        fits: false,
        reason: `modalidade incompatível: paciente quer [${wantsModality.join(', ')}], profissional oferece [${psychologistOffer.modality.join(', ')}]`,
      }
    }
  }

  if (patientConstraints.price_band && psychologistOffer.price_band) {
    if (patientConstraints.price_band !== psychologistOffer.price_band) {
      return {
        fits: false,
        reason: `faixa de preço incompatível: paciente=${patientConstraints.price_band}, profissional=${psychologistOffer.price_band}`,
      }
    }
  }

  const wantsWindows = patientConstraints.availability_windows
  if (wantsWindows.length > 0 && psychologistOffer.availability_windows.length > 0) {
    const overlap = wantsWindows.some((w) => psychologistOffer.availability_windows.includes(w))
    if (!overlap) {
      return {
        fits: false,
        reason: `sem sobreposição de disponibilidade: paciente quer [${wantsWindows.join(', ')}], profissional oferece [${psychologistOffer.availability_windows.join(', ')}]`,
      }
    }
  }

  return { fits: true, reason: null }
}

/** Filtro duro: só logística. Nunca olha estilo. */
export function applyHardFilters(
  patientConstraints: Constraints,
  psychologists: PsychologistRecord[]
): EligibilityResult {
  const eligible: string[] = []
  const excluded: Array<{ psychologist_id: string; reason: string }> = []

  for (const psy of psychologists) {
    const { fits, reason } = checkLogisticFit(patientConstraints, psy.offer, psy.status)
    if (!fits) {
      excluded.push({ psychologist_id: psy.id, reason: reason! })
      continue
    }
    eligible.push(psy.id)
  }

  return { eligible, excluded }
}

export interface StyleScore {
  psychologist_id: string
  distance: number | null
  compatibility: number | null
  per_dimension: Record<string, number | null>
  reliable: boolean // false se menos de MIN_FILLED_DIMENSIONS_FOR_RELIABLE_SCORE dimensões comparáveis
}

/**
 * Perfil de estilo "efetivo" do psicólogo: usa observed_profile só quando a
 * amostra já é grande o suficiente para valer mais que a autoavaliação
 * declarada (docs/12 seção 5; docs/13 seção 6). Caso contrário, usa declared.
 */
export function effectivePsychologistStyle(psy: PsychologistRecord): StyleProfile {
  if (psy.observed_profile.sample_size >= OBSERVED_PROFILE_MIN_SAMPLE_SIZE) {
    return psy.observed_profile.style
  }
  return psy.declared_profile.style
}

/** Distância L1 normalizada -> compatibilidade, só nas dimensões preenchidas em ambos os lados. */
export function computeStyleScore(
  patientStyle: StyleProfile,
  psy: PsychologistRecord
): StyleScore {
  const psyStyle = effectivePsychologistStyle(psy)
  const perDimension: Record<string, number | null> = {}
  let sumAbsDiff = 0
  let comparedDimensions = 0

  for (const dim of STYLE_DIMENSIONS as readonly StyleDimension[]) {
    const pVal = patientStyle[dim]?.value ?? null
    const sVal = psyStyle[dim]?.value ?? null
    if (pVal == null || sVal == null) {
      perDimension[dim] = null
      continue
    }
    const diff = Math.abs(pVal - sVal)
    perDimension[dim] = diff
    sumAbsDiff += diff
    comparedDimensions += 1
  }

  if (comparedDimensions === 0) {
    return {
      psychologist_id: psy.id,
      distance: null,
      compatibility: null,
      per_dimension: perDimension,
      reliable: false,
    }
  }

  // Normaliza pela distância máxima possível nas dimensões efetivamente comparadas
  // (6 = 7 - 1, a maior diferença possível numa escala 1-7).
  const maxPossibleDistance = comparedDimensions * 6
  const compatibility = 1 - sumAbsDiff / maxPossibleDistance

  return {
    psychologist_id: psy.id,
    distance: sumAbsDiff,
    compatibility,
    per_dimension: perDimension,
    reliable: comparedDimensions >= MIN_FILLED_DIMENSIONS_FOR_RELIABLE_SCORE,
  }
}

export interface MathEngineOutput {
  engine_version: string
  eligible_candidates: string[]
  excluded_candidates: Array<{ psychologist_id: string; reason: string }>
  scores: StyleScore[]
  ranked: string[]
}

/**
 * Ponto de entrada único do Motor Matemático.
 * Ordem: 1) filtro duro, 2) score de estilo só nos elegíveis, 3) ranking.
 * Empate de compatibilidade é resolvido por active_patient_count crescente
 * (balanceamento de carga) — nunca por critério de estilo escondido.
 */
export function runMathEngine(
  patientProfile: PatientProfileRecord,
  psychologists: PsychologistRecord[]
): MathEngineOutput {
  const { eligible, excluded } = applyHardFilters(patientProfile.constraints, psychologists)
  const eligiblePsychologists = psychologists.filter((p) => eligible.includes(p.id))

  const scores = eligiblePsychologists.map((psy) => computeStyleScore(patientProfile.style, psy))

  const byId = new Map(eligiblePsychologists.map((p) => [p.id, p]))
  const ranked = [...scores]
    .sort((a, b) => {
      const aComp = a.compatibility ?? -Infinity
      const bComp = b.compatibility ?? -Infinity
      if (aComp !== bComp) return bComp - aComp
      const aLoad = byId.get(a.psychologist_id)?.active_patient_count ?? 0
      const bLoad = byId.get(b.psychologist_id)?.active_patient_count ?? 0
      return aLoad - bLoad
    })
    .map((s) => s.psychologist_id)

  return {
    engine_version: MATH_ENGINE_VERSION,
    eligible_candidates: eligible,
    excluded_candidates: excluded,
    scores,
    ranked,
  }
}

export function styleFloorWarning(patientProfile: PatientProfileRecord): string | null {
  const filled = countFilledStyleDimensions(patientProfile.style)
  if (filled < MIN_FILLED_DIMENSIONS_FOR_RELIABLE_SCORE) {
    return `Perfil de estilo com apenas ${filled}/4 dimensões preenchidas — abaixo do piso mínimo de ${MIN_FILLED_DIMENSIONS_FOR_RELIABLE_SCORE}. Score calculado é pouco confiável; use com cautela na curadoria.`
  }
  return null
}
