import { createDemoStore } from '../../lib/matching/store/demo-store'
import { getFirstInterpretations } from '../../lib/shadow/interpretation'
import { formatTranscriptOnly, requireTranscript } from './common'

/**
 * Ferramenta do CURADOR (V0.3): abre um caso e mostra SOMENTE o RAW.
 * Por construção, esta ferramenta não imprime nenhuma interpretação —
 * nem da regra, nem da IA, nem correção do paciente.
 *
 * Uso: npx tsx scripts/shadow/open-case-for-curator.ts <case_id>
 */
async function main() {
  const caseId = process.argv[2]
  if (!caseId) {
    console.error('Uso: npx tsx scripts/shadow/open-case-for-curator.ts <case_id>')
    process.exit(1)
  }
  const store = createDemoStore()
  const transcript = await requireTranscript(store, caseId)

  const existing = await getFirstInterpretations(store, caseId)
  if (existing.curador) {
    console.error(
      `ATENÇÃO: já existe interpretação de curador registrada para ${caseId} ` +
        `(por ${existing.curador.interpreter_id ?? 'desconhecido'}, em ${existing.curador.recorded_at}).\n` +
        `O julgamento inicial é travado: um novo registro NÃO substitui o primeiro na comparação.`
    )
  }

  console.log('='.repeat(72))
  console.log('CONVERSA BRUTA — leia e registre sua interpretação de forma independente.')
  console.log('Não consulte nenhuma outra leitura deste caso antes de registrar.')
  console.log('='.repeat(72))
  console.log('')
  console.log(formatTranscriptOnly(transcript))
  console.log('')
  console.log('='.repeat(72))
  console.log('Para registrar: preencha um JSON no formato de scripts/shadow/exemplo-interpretacao.json')
  console.log('e rode: npx tsx scripts/shadow/register-interpretation.ts <arquivo.json>')
}

main()
