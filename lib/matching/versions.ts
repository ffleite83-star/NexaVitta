/**
 * Toda saída que influencia uma recomendação carrega uma versão.
 * Nunca deve existir "a IA respondeu isso" sem saber qual versão respondeu.
 * (docs/13_MATCHING_ARCHITECTURE.md, docs/14_DATA_BACKBONE_V0.md, seção 19 do pedido original)
 */

export const PROFILE_SCHEMA_VERSION = 'profile-schema/v1'
export const MATH_ENGINE_VERSION = 'math-engine/v1'
export const MATCHING_LOGIC_VERSION = 'matching-logic/v1' // versão da lógica de matching como um todo (filtros + fórmula)

// A IA Shadow em V0 é manual (prompt versionado rodado por um humano — docs/13, seção 1).
// A versão do prompt vive como texto documentado, não como código executável ainda.
export const AI_SHADOW_PROMPT_VERSION = 'ai-shadow-prompt/v1'
