import { z } from 'zod'
import { StyleProfile, Constraints, DimensionValue } from './common'
import { PROFILE_SCHEMA_VERSION } from '../versions'

/**
 * Identidade e consentimento ficam separados do perfil comportamental.
 * Minimização de dado (pedido original, seção 6): a informação de contato
 * não vive dentro do registro de perfil/caso — só uma referência a ela.
 * NECESSITA VALIDAÇÃO PROFISSIONAL/REGULATÓRIA: base legal e escopo exato
 * de consentimento sob a LGPD antes de operar com paciente real.
 */
export const ConsentRecord = z.object({
  given_at: z.string().datetime(),
  scope: z.array(z.string()).min(1), // ex.: ["perfil_matching", "shadow_ia_pesquisa"]
})
export type ConsentRecord = z.infer<typeof ConsentRecord>

export const PatientRecord = z.object({
  id: z.string(), // identificador pseudônimo — nunca o nome real como chave primária
  contact_ref: z.string().nullable().optional(), // ponteiro para dado de contato, armazenado à parte
  consent: ConsentRecord,
  created_at: z.string().datetime(),
})
export type PatientRecord = z.infer<typeof PatientRecord>

export const PatientProfileRecord = z.object({
  case_id: z.string(),
  patient_id: z.string(),
  profile_version: z.string().default(PROFILE_SCHEMA_VERSION),
  style: StyleProfile,
  engagement_expectation: DimensionValue.nullable().optional(), // contextual, fora do score (docs/12 seção 4)
  constraints: Constraints,
  recorded_at: z.string().datetime(),
})
export type PatientProfileRecord = z.infer<typeof PatientProfileRecord>

/** Conta quantas das 4 dimensões de estilo têm valor não-nulo — usado para o piso mínimo de 2/4 (docs/12, seção 4). */
export function countFilledStyleDimensions(style: StyleProfile): number {
  return (['directiveness', 'emotional_intensity', 'temporal_focus', 'support_challenge'] as const).filter(
    (dim) => style[dim]?.value != null
  ).length
}
