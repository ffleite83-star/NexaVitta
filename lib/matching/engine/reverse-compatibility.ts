import type { PsychologistRecord } from '../schema/psychologist'
import type { PatientProfileRecord } from '../schema/patient'
import { checkLogisticFit, computeStyleScore, effectivePsychologistStyle, StyleScore } from './math-engine'

/**
 * Lado psicólogo do marketplace (pedido original, seção 23): dado um
 * psicólogo, quais perfis de paciente já registrados são compatíveis com
 * ele. Reusa exatamente a mesma regra de filtro duro e a mesma fórmula de
 * distância de estilo do Motor Matemático — só inverte quem é o "sujeito"
 * da pergunta. Isso é DADO, não produto: não vira promessa de volume de
 * pacientes para o profissional (pedido original, seção 23 — ressalva
 * explícita) nem UX de "marketplace reverso" nesta rodada.
 */
export interface CompatiblePatientResult extends StyleScore {
  case_id: string
  patient_id: string
}

export interface ReverseCompatibilityOutput {
  psychologist_id: string
  eligible_case_ids: string[]
  excluded: Array<{ case_id: string; reason: string }>
  scores: CompatiblePatientResult[]
  ranked_case_ids: string[]
}

export function findCompatiblePatientsForPsychologist(
  psychologist: PsychologistRecord,
  patientProfiles: PatientProfileRecord[]
): ReverseCompatibilityOutput {
  const eligible: string[] = []
  const excluded: Array<{ case_id: string; reason: string }> = []

  for (const profile of patientProfiles) {
    const { fits, reason } = checkLogisticFit(profile.constraints, psychologist.offer, psychologist.status)
    if (!fits) {
      excluded.push({ case_id: profile.case_id, reason: reason! })
      continue
    }
    eligible.push(profile.case_id)
  }

  const eligibleProfiles = patientProfiles.filter((p) => eligible.includes(p.case_id))
  const scores: CompatiblePatientResult[] = eligibleProfiles.map((profile) => {
    const score = computeStyleScore(profile.style, psychologist)
    return { ...score, case_id: profile.case_id, patient_id: profile.patient_id }
  })

  const ranked_case_ids = [...scores]
    .sort((a, b) => (b.compatibility ?? -Infinity) - (a.compatibility ?? -Infinity))
    .map((s) => s.case_id)

  return {
    psychologist_id: psychologist.id,
    eligible_case_ids: eligible,
    excluded,
    scores,
    ranked_case_ids,
  }
}

// Reexportado só para deixar explícito que o mesmo perfil "efetivo" (declared
// vs. observed) usado no sentido paciente->psicólogo vale aqui também.
export { effectivePsychologistStyle }
