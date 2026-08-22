import { readFileSync } from 'fs'
import { createDemoStore } from '../../lib/matching/store/demo-store'
import { registerInterpretation } from '../../lib/shadow/interpretation'
import { fileToStyleProfile, InterpretationFile } from './common'

/**
 * Registra uma interpretação (curador ou IA) a partir de um arquivo JSON.
 * Uso: npx tsx scripts/shadow/register-interpretation.ts <arquivo.json>
 */
async function main() {
  const file = process.argv[2]
  if (!file) {
    console.error('Uso: npx tsx scripts/shadow/register-interpretation.ts <arquivo.json>')
    process.exit(1)
  }
  const data = JSON.parse(readFileSync(file, 'utf-8')) as InterpretationFile
  const at = new Date().toISOString()
  const { style, engagement } = fileToStyleProfile(data, at)

  const store = createDemoStore()
  const event = await registerInterpretation(store, {
    case_id: data.case_id,
    patient_id: data.patient_id,
    source: data.source,
    interpreter_id: data.interpreter_id,
    style,
    engagement,
    notes: data.notes ?? null,
    model_version: data.model ?? null,
    prompt_version: data.prompt_version ?? null,
  })
  console.log(`Registrado: ${event.event_id} (${data.source} por ${data.interpreter_id}) no caso ${data.case_id}`)
}

main()
