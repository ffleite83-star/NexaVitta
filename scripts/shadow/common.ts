import type { CaseStore } from '../../lib/matching/store/types'
import type { TranscriptRecord } from '../../lib/matching/schema/transcript'
import type { StyleProfile, DimensionValue, ProfileSource } from '../../lib/matching/schema/common'
import type { InterpretationSource } from '../../lib/shadow/interpretation'

/**
 * Utilidades das ferramentas de linha de comando do experimento V0.3.
 * Anti-ancoragem por construção: formatTranscriptOnly recebe SÓ o
 * TranscriptRecord — não tem como vazar interpretação por aqui.
 */

export function formatTranscriptOnly(transcript: TranscriptRecord): string {
  const lines = [
    `# Caso ${transcript.case_id}`,
    `# Fluxo: ${transcript.flow_version} | modo: ${transcript.input_mode} | turnos: ${transcript.turns.length}`,
    '',
  ]
  for (const t of transcript.turns) {
    const who = t.speaker === 'nexavitta' ? 'NexaVitta' : 'Paciente '
    lines.push(`${who}: ${t.text}`)
  }
  return lines.join('\n')
}

/** Formato do arquivo JSON de registro (mesmo shape da saída pedida no prompt v0.1). */
export interface InterpretationFile {
  source: InterpretationSource
  interpreter_id: string
  case_id: string
  patient_id: string
  dimensions: Record<string, { value: number | null; confidence: 'baixa' | 'media' | 'alta' | null; evidence: string | null }>
  engagement?: { value: number | null; confidence: 'baixa' | 'media' | 'alta' | null; evidence: string | null } | null
  notes?: string | null
  model?: string | null
  prompt_version?: string | null
}

const SOURCE_TO_PROVENANCE: Record<InterpretationSource, ProfileSource> = {
  regra_deterministica: 'regra_derivada',
  curador_humano: 'curador_inferido',
  ia_shadow: 'ia_inferido',
}

export function fileToStyleProfile(file: InterpretationFile, at: string): { style: StyleProfile; engagement: DimensionValue | null } {
  const provenance = SOURCE_TO_PROVENANCE[file.source]
  const style: StyleProfile = {}
  for (const dim of ['directiveness', 'emotional_intensity', 'temporal_focus', 'support_challenge'] as const) {
    const d = file.dimensions[dim]
    if (!d || (d.value == null && d.evidence == null)) {
      style[dim] = null
      continue
    }
    style[dim] = { value: d.value, source: provenance, recorded_at: at, evidence: d.evidence, confidence: d.confidence }
  }
  const e = file.engagement
  const engagement: DimensionValue | null =
    e && (e.value != null || e.evidence != null)
      ? { value: e.value, source: provenance, recorded_at: at, evidence: e.evidence, confidence: e.confidence }
      : null
  return { style, engagement }
}

export async function requireTranscript(store: CaseStore, caseId: string): Promise<TranscriptRecord> {
  const t = await store.getTranscript(caseId)
  if (!t) {
    console.error(`Caso ${caseId} não tem transcrição no store. Rode as simulações primeiro.`)
    process.exit(1)
  }
  return t
}
