import { readFileSync } from 'fs'
import path from 'path'
import { createDemoStore } from '../../lib/matching/store/demo-store'
import { registerInterpretation, getFirstInterpretations } from '../../lib/shadow/interpretation'
import { fileToStyleProfile, InterpretationFile } from './common'

/**
 * V0.3 — registra no demo store as interpretações do experimento:
 *   - IA (aplicação manual do prompt v0.1 — ver aviso de contaminação no JSON)
 *   - Curador SIMULADO (placeholder rotulado; substituir por psicólogo real)
 * A interpretação da REGRA já existe: é o profile_extracted gerado pelo
 * fluxo V0.2 (simulate-conversations.ts).
 *
 * Ordem de execução:
 *   1. npx tsx scripts/conversation/simulate-conversations.ts
 *   2. npx tsx scripts/shadow/run-demo-experiment.ts
 *   3. npx tsx scripts/shadow/compare.ts
 */
async function registerFromFile(store: ReturnType<typeof createDemoStore>, filePath: string) {
  const raw = JSON.parse(readFileSync(filePath, 'utf-8')) as { interpretations: InterpretationFile[] }
  for (const item of raw.interpretations) {
    const existing = await getFirstInterpretations(store, item.case_id)
    const slot = item.source === 'curador_humano' ? existing.curador : existing.ia
    if (slot) {
      console.log(`[pulado] ${item.case_id} já tem ${item.source} registrado (julgamento travado).`)
      continue
    }
    const at = new Date().toISOString()
    const { style, engagement } = fileToStyleProfile(item, at)
    await registerInterpretation(store, {
      case_id: item.case_id,
      patient_id: item.patient_id,
      source: item.source,
      interpreter_id: item.interpreter_id,
      style,
      engagement,
      notes: item.notes ?? null,
      model_version: item.model ?? null,
      prompt_version: item.prompt_version ?? null,
    })
    console.log(`[ok] ${item.case_id}: ${item.source} (${item.interpreter_id})`)
  }
}

async function main() {
  const store = createDemoStore()
  const base = path.join(process.cwd(), 'data', 'shadow')
  console.log('== Registrando interpretações da IA (prompt ai-shadow/v0.1) ==')
  await registerFromFile(store, path.join(base, 'ai-interpretations.v0_1.json'))
  console.log('\n== Registrando interpretações do curador SIMULADO (placeholder) ==')
  await registerFromFile(store, path.join(base, 'curator-interpretations.SIMULADO.json'))
  console.log('\nPronto. Rode agora: npx tsx scripts/shadow/compare.ts')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
