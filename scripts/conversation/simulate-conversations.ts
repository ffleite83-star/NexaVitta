import { createDemoStore, DEMO_STORE_DIR } from '../../lib/matching/store/demo-store'
import { SYNTHETIC_CASES, runFixtureConversation } from '../../lib/conversation/fixtures'
import {
  recordCompletedConversation,
  recordAbandonedConversation,
  recordProfileConfirmation,
  recordProfileCorrections,
} from '../../lib/conversation/recorder'
import { extractForCheckpoint, summarizeForCheckpoint } from '../../lib/conversation/engine'
import { reconstructCase } from '../../lib/matching/reconstruction/reconstruct-case'

/**
 * V0.2 — roda a bateria sintética A–L inteira contra o Data Backbone:
 * conversa -> transcrição -> perfil -> (confirmação|correção|abandono) -> trail.
 *
 * Rodar: npx tsx scripts/conversation/simulate-conversations.ts
 */
async function main() {
  const store = createDemoStore()

  for (const fixture of SYNTHETIC_CASES) {
    const caseId = `case_${fixture.key}`
    const patientId = `pat_${fixture.key}`

    await store.savePatient({
      id: patientId,
      contact_ref: null,
      consent: { given_at: new Date().toISOString(), scope: ['perfil_matching'] },
      created_at: new Date().toISOString(),
    })

    const run = runFixtureConversation(fixture)

    if (!run.completed) {
      await recordAbandonedConversation(store, {
        case_id: caseId,
        patient_id: patientId,
        state: run.state,
        stage: `apos_resposta_${run.responses_used}`,
        reason: 'fixture sintética de abandono',
      })
      console.log(`\n### ${fixture.label} -> ABANDONADO após ${run.responses_used} resposta(s)`)
      continue
    }

    await recordCompletedConversation(store, {
      case_id: caseId,
      patient_id: patientId,
      state: run.state,
    })

    const extraction = extractForCheckpoint(run.state)
    const summary = summarizeForCheckpoint(extraction)

    if (fixture.key === 'caso_l_correcao') {
      // A pessoa discorda da leitura de diretividade e corrige.
      await recordProfileCorrections(store, caseId, [
        {
          dimension: 'directiveness',
          corrected_value: 2,
          correction_note: 'Na verdade, pensando melhor, eu quero decidir as coisas eu mesmo.',
        },
      ])
    } else {
      await recordProfileConfirmation(store, caseId)
    }

    const dims = extraction.style
    const compact = (['directiveness', 'emotional_intensity', 'temporal_focus', 'support_challenge'] as const)
      .map((d) => `${d}=${dims[d]?.value ?? 'null'}${dims[d]?.confidence ? `(${dims[d]!.confidence})` : ''}`)
      .join(' ')
    console.log(`\n### ${fixture.label}`)
    console.log(`    sinais: ${compact}`)
    console.log(`    checkpoint: ${summary.join(' | ')}`)
  }

  // Prova de reconstrução: um convertido com correção + o abandonado
  console.log('\n=== Decision trail: caso L (correção) ===')
  const trailL = await reconstructCase(store, 'case_caso_l_correcao')
  console.log(JSON.stringify({
    event_count: trailL.event_count,
    conversation: trailL.conversation,
    profile_review: trailL.profile_review,
  }, null, 2))

  console.log('\n=== Decision trail: caso K (abandono) ===')
  const trailK = await reconstructCase(store, 'case_caso_k_abandono')
  console.log(JSON.stringify({
    event_count: trailK.event_count,
    conversation: trailK.conversation,
  }, null, 2))

  // RAW preservado?
  const transcript = await store.getTranscript('case_caso_l_correcao')
  console.log(`\nRAW preservado (caso L): ${transcript?.turns.length} turnos, fluxo ${transcript?.flow_version}`)
  console.log(`\nDados salvos em: ${DEMO_STORE_DIR}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
