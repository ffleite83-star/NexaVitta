import { readFileSync } from 'fs'
import path from 'path'
import { createDemoStore } from '../../lib/matching/store/demo-store'
import { formatTranscriptOnly, requireTranscript } from './common'

/**
 * Ferramenta da IA SHADOW (V0.3): exporta SOMENTE prompt versionado + RAW,
 * para execução manual da IA fora do sistema. Por construção, nada além
 * disso entra no pacote — não há parâmetro por onde outra interpretação
 * passaria.
 *
 * Uso: npx tsx scripts/shadow/export-for-ai.ts <case_id>
 */
async function main() {
  const caseId = process.argv[2]
  if (!caseId) {
    console.error('Uso: npx tsx scripts/shadow/export-for-ai.ts <case_id>')
    process.exit(1)
  }
  const store = createDemoStore()
  const transcript = await requireTranscript(store, caseId)
  const prompt = readFileSync(path.join(process.cwd(), 'prompts', 'ai-shadow', 'v0.1.md'), 'utf-8')

  console.log(prompt)
  console.log('\n---\n## Transcrição bruta\n')
  console.log(formatTranscriptOnly(transcript))
}

main()
