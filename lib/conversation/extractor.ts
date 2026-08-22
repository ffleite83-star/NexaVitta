import type { StyleDimension, DimensionValue, StyleProfile } from '../matching/schema/common'
import { SIGNAL_EXTRACTOR_VERSION } from '../matching/versions'

/**
 * Extrator determinístico de sinais (V0.2). NÃO É IA.
 *
 * Heurística de palavras/expressões em pt-BR, explicável e versionada
 * (SIGNAL_EXTRACTOR_VERSION). O papel dele é encanamento: dar ao checkpoint
 * de transparência algo para mostrar, e ao dataset um baseline barato.
 * A qualidade da interpretação é exatamente o que IA Shadow vs. Curador vai
 * medir na próxima etapa — este extrator é deliberadamente cru e nunca deve
 * ser tratado como "a leitura da NexaVitta".
 *
 * Regras inegociáveis:
 * - sem evidência -> value = null (não inventar certeza; pedido V0.2, seção 8);
 * - sinais conflitantes -> value = null, evidência dos DOIS lados preservada;
 * - toda leitura carrega a fala original que a sustenta (evidence).
 */

interface DimensionLexicon {
  // expressões que puxam para o lado ALTO da escala (7)
  high: string[]
  // expressões que puxam para o lado BAIXO da escala (1)
  low: string[]
}

/**
 * Semântica das escalas (fixada em docs/12 e schema/common.ts):
 * directiveness:       1 = quer conduzir sozinho   7 = quer condução ativa
 * emotional_intensity: 1 = contido/racional         7 = expressão emocional aberta
 * temporal_focus:      1 = presente                 7 = passado/história
 * support_challenge:   1 = desafio/confronto        7 = suporte/acolhimento
 */
const LEXICON: Record<StyleDimension, DimensionLexicon> = {
  directiveness: {
    high: [
      'organizar os caminhos', 'me guie', 'me guiar', 'direção', 'me diga o que fazer',
      'orientação', 'passos claros', 'tarefas', 'estruturado', 'objetivo e prático',
      'conduza', 'que me conduza', 'um norte', 'plano',
    ],
    low: [
      'conduzir a própria fala', 'conduzir a conversa', 'meu ritmo', 'no meu tempo',
      'espaço para eu', 'espaço pra eu', 'eu mesmo chegar', 'eu mesma chegar',
      'não gosto que me digam', 'não gosto quando alguém fica me dizendo',
      'sem me dizer o que fazer', 'liberdade',
    ],
  },
  emotional_intensity: {
    high: [
      'chorar', 'desabafar', 'emoção', 'emoções', 'o que eu sinto', 'sentimentos',
      'me abrir', 'coração', 'sentir tudo',
    ],
    low: [
      'racional', 'lógica', 'prático e direto', 'não gosto de me abrir',
      'ir com calma nessa parte', 'mais contido', 'mais contida', 'sem drama',
      'devagar com essa parte', 'não sou de falar de sentimento',
    ],
  },
  temporal_focus: {
    high: [
      'infância', 'minha história', 'passado', 'de onde vem', 'origem',
      'quando eu era', 'minha família sempre', 'coisas antigas', 'lá atrás',
    ],
    low: [
      'agora', 'situação atual', 'hoje em dia', 'este momento', 'esse momento',
      'resolver isso logo', 'o problema atual', 'o que está acontecendo',
    ],
  },
  support_challenge: {
    high: [
      'acolhimento', 'acolher', 'acolhida', 'que me escute', 'apoio', 'paciência',
      'gentileza', 'um lugar seguro', 'carinho',
    ],
    low: [
      'me provoque', 'me provocar', 'direto comigo', 'sem rodeios', 'me confronte',
      'verdade na cara', 'me desafie', 'franco comigo', 'franca comigo',
      'outro ângulo', 'me tire da zona de conforto',
    ],
  },
}

const ENGAGEMENT_LEXICON: DimensionLexicon = {
  high: ['dia a dia', 'praticar', 'exercícios', 'tarefas', 'aplicar', 'levar comigo', 'entre as sessões'],
  low: ['dentro das sessões', 'só nas conversas', 'durante a sessão', 'não gosto de dever de casa'],
}

export interface ExtractedSignal {
  value: number | null
  confidence: 'baixa' | 'media' | 'alta' | null
  evidence: string | null
  conflicting: boolean
}

function findMatches(text: string, expressions: string[]): string[] {
  const lower = text.toLowerCase()
  return expressions.filter((e) => lower.includes(e))
}

/** Retorna a(s) frase(s) da fala original que contêm as expressões encontradas. */
function evidenceSentences(text: string, matched: string[]): string {
  const sentences = text.split(/(?<=[.!?])\s+|\n+/)
  const hits = sentences.filter((s) => matched.some((m) => s.toLowerCase().includes(m)))
  return hits.length > 0 ? hits.join(' ').trim() : text.trim()
}

export function extractSignal(patientText: string, lexicon: DimensionLexicon): ExtractedSignal {
  const highMatches = findMatches(patientText, lexicon.high)
  const lowMatches = findMatches(patientText, lexicon.low)

  if (highMatches.length === 0 && lowMatches.length === 0) {
    return { value: null, confidence: null, evidence: null, conflicting: false }
  }

  if (highMatches.length > 0 && lowMatches.length > 0) {
    // Sinais conflitantes: não inventar certeza. Preservar evidência dos dois lados.
    const evidence = evidenceSentences(patientText, [...highMatches, ...lowMatches])
    return { value: null, confidence: 'baixa', evidence: `[sinais conflitantes] ${evidence}`, conflicting: true }
  }

  const matches = highMatches.length > 0 ? highMatches : lowMatches
  const direction = highMatches.length > 0 ? 1 : -1
  const strength = matches.length

  // 1 expressão -> desloca 1.5 do centro; 2+ -> desloca 2.5. Escala 1-7, centro 4.
  const shift = strength >= 2 ? 2.5 : 1.5
  const value = Math.round(Math.min(7, Math.max(1, 4 + direction * shift)))
  const confidence: 'media' | 'alta' = strength >= 2 ? 'alta' : 'media'

  return {
    value,
    confidence,
    evidence: evidenceSentences(patientText, matches),
    conflicting: false,
  }
}

export interface ExtractionResult {
  style: StyleProfile
  engagement: DimensionValue | null
  extractor_version: string
}

/** Roda o extrator sobre TODO o texto do paciente acumulado (todas as respostas). */
export function extractProfileSignals(allPatientText: string, recordedAt: string): ExtractionResult {
  const style: StyleProfile = {}
  for (const dim of Object.keys(LEXICON) as StyleDimension[]) {
    const signal = extractSignal(allPatientText, LEXICON[dim])
    if (signal.value == null && signal.evidence == null) {
      // sem evidência nenhuma: dimensão fica ausente (null no perfil)
      style[dim] = null
      continue
    }
    style[dim] = {
      value: signal.value,
      source: 'regra_derivada',
      recorded_at: recordedAt,
      evidence: signal.evidence,
      confidence: signal.confidence,
    }
  }

  const engagementSignal = extractSignal(allPatientText, ENGAGEMENT_LEXICON)
  const engagement: DimensionValue | null =
    engagementSignal.value == null && engagementSignal.evidence == null
      ? null
      : {
          value: engagementSignal.value,
          source: 'regra_derivada',
          recorded_at: recordedAt,
          evidence: engagementSignal.evidence,
          confidence: engagementSignal.confidence,
        }

  return { style, engagement, extractor_version: SIGNAL_EXTRACTOR_VERSION }
}

/** Uma dimensão "tem sinal" se o extrator achou valor OU evidência conflitante. */
export function hasSignal(style: StyleProfile, dim: StyleDimension): boolean {
  const d = style[dim]
  return d != null && (d.value != null || d.evidence != null)
}
