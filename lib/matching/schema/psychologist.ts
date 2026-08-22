import { z } from 'zod'
import { StyleProfile, Constraints } from './common'

/**
 * Distingue perfil declarado (autoavaliação, 1x no onboarding) de perfil
 * observado (média corrente das leituras pós-sessão). O observado nunca vira
 * "verdade" com poucas amostras (pedido original, seção 8; docs/13, seção 6).
 */
export const DeclaredProfile = z.object({
  style: StyleProfile,
  version: z.string(),
  recorded_at: z.string().datetime(),
})
export type DeclaredProfile = z.infer<typeof DeclaredProfile>

export const ObservedProfile = z.object({
  style: StyleProfile, // média corrente
  sample_size: z.number().int().min(0).default(0),
  last_updated_at: z.string().datetime().nullable().optional(),
})
export type ObservedProfile = z.infer<typeof ObservedProfile>

// Piso de amostra abaixo do qual observed_profile não influencia o score (docs/12, seção 5).
export const OBSERVED_PROFILE_MIN_SAMPLE_SIZE = 10

export const PsychologistStatus = z.enum(['ativo', 'pausado', 'inativo'])
export type PsychologistStatus = z.infer<typeof PsychologistStatus>

export const PsychologistRecord = z.object({
  id: z.string(),
  status: PsychologistStatus.default('ativo'),
  crp: z.string().nullable().optional(), // NECESSITA VALIDAÇÃO PROFISSIONAL/REGULATÓRIA: exigência de exibição/verificação de registro
  offer: Constraints, // o que o psicólogo oferece (contraponto às constraints que o paciente pede)
  declared_profile: DeclaredProfile,
  observed_profile: ObservedProfile,
  active_patient_count: z.number().int().min(0).default(0), // usado só para desempate por balanceamento de carga
  profile_version: z.string(),
})
export type PsychologistRecord = z.infer<typeof PsychologistRecord>

/** Confiança é sempre derivada do sample_size, nunca armazenada separadamente (docs/13, seção 6, simplificação registrada). */
export function observedProfileConfidence(sampleSize: number): 'baixa' | 'media' | 'alta' {
  if (sampleSize >= 15) return 'alta'
  if (sampleSize >= 5) return 'media'
  return 'baixa'
}
