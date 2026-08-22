import { z } from 'zod'

/**
 * De onde veio um valor de dimensão de perfil — nunca perdemos essa proveniência.
 * (pedido original, seção 7)
 */
export const ProfileSource = z.enum([
  'paciente_declarado',
  'curador_inferido',
  'ia_inferido',
  'observado_pos_sessao',
  'regra_derivada',
])
export type ProfileSource = z.infer<typeof ProfileSource>

// Escala 1-7, consistente com o C-NIP adotado na Sprint 2 (docs/11).
export const DimensionValue = z.object({
  value: z.number().min(1).max(7).nullable(),
  source: ProfileSource,
  recorded_at: z.string().datetime(),
  // V0.2 (Patient Voice Discovery): a fala original que sustenta o valor.
  // Nunca perder o RAW — a interpretação não substitui o que a pessoa disse.
  evidence: z.string().nullable().optional(),
  confidence: z.enum(['baixa', 'media', 'alta']).nullable().optional(),
})
export type DimensionValue = z.infer<typeof DimensionValue>

/**
 * As 4 dimensões de ESTILO usadas no cálculo de compatibilidade (docs/12, seção 4).
 * `engagement_expectation` fica fora desta estrutura de propósito — é contextual,
 * não entra na fórmula de distância (docs/12, seção 4; docs/13 reforça).
 */
export const StyleProfile = z.object({
  directiveness: DimensionValue.nullable().optional(),
  emotional_intensity: DimensionValue.nullable().optional(),
  temporal_focus: DimensionValue.nullable().optional(), // 1 = presente, 7 = passado
  support_challenge: DimensionValue.nullable().optional(), // 1 = desafio, 7 = suporte
})
export type StyleProfile = z.infer<typeof StyleProfile>

export const STYLE_DIMENSIONS = [
  'directiveness',
  'emotional_intensity',
  'temporal_focus',
  'support_challenge',
] as const
export type StyleDimension = (typeof STYLE_DIMENSIONS)[number]

// Restrições logísticas — filtro obrigatório, nunca misturado com compatibilidade de estilo
// (docs/12 seção 4; pedido original seção 9: "não misture indisponibilidade com incompatibilidade psicológica").
export const Modality = z.enum(['video', 'audio', 'texto'])
export type Modality = z.infer<typeof Modality>

export const Constraints = z.object({
  modality: z.array(Modality).default([]),
  price_band: z.string().nullable().optional(),
  availability_windows: z.array(z.string()).default([]), // ex.: "seg-manha", "qua-noite" — simplificado para V0
})
export type Constraints = z.infer<typeof Constraints>
