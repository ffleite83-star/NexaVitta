import { createDemoStore, DEMO_STORE_DIR } from '../../lib/matching/store/demo-store'
import { seedPsychologists } from './seed-psychologists'
import { runMathEngine, styleFloorWarning } from '../../lib/matching/engine/math-engine'
import {
  recordCuratorIndependentJudgment,
  recordAIShadowHypothesis,
  revealAndDecide,
} from '../../lib/matching/curation/anti-anchoring'
import { reconstructCase } from '../../lib/matching/reconstruction/reconstruct-case'
import type { PatientProfileRecord } from '../../lib/matching/schema/patient'
import type { CaseEvent } from '../../lib/matching/schema/events'
import { PROFILE_SCHEMA_VERSION } from '../../lib/matching/versions'

function dim(value: number, source: 'curador_inferido' | 'paciente_declarado' = 'curador_inferido') {
  return { value, source, recorded_at: new Date().toISOString() }
}

function eventId(prefix: string, n: number) {
  return `${prefix}_${n}`
}

/**
 * Simula DOIS casos de paciente, de ponta a ponta:
 *
 *  1. `case_demo_convertido` — passa pela jornada inteira (conversa -> perfil
 *     -> julgamento independente do curador -> IA Shadow manual -> motor
 *     matemático -> reveal + decisão do curador -> apresentação -> resposta
 *     do paciente -> sessão -> status). Isso sozinho já satisfaz o critério
 *     de conclusão da rodada (pedido original, seção 24).
 *
 *  2. `case_demo_abandonado` — conversa começa e é abandonada no meio. Prova
 *     que um não-convertido fica registrado no dataset, não desaparece
 *     (pedido original, seção 13).
 *
 * Rodar: npx tsx scripts/matching/simulate-patient-case.ts
 */
async function main() {
  const store = createDemoStore()
  await seedPsychologists(store)

  // ---------- Caso 1: jornada completa, convertido ----------
  const caseId = 'case_demo_convertido'
  const patientId = 'pat_demo_1'
  let n = 0

  await store.savePatient({
    id: patientId,
    contact_ref: null, // V0: sem dado real de contato, sintético
    consent: {
      given_at: new Date().toISOString(),
      scope: ['perfil_matching', 'shadow_ia_pesquisa'],
    },
    created_at: new Date().toISOString(),
  })

  const events: CaseEvent[] = []

  events.push({
    case_id: caseId,
    event_id: eventId('e', ++n),
    recorded_at: new Date().toISOString(),
    type: 'conversation_started',
    patient_id: patientId,
    channel: 'texto',
    conducted_by: 'curador_demo',
  })

  events.push({
    case_id: caseId,
    event_id: eventId('e', ++n),
    recorded_at: new Date().toISOString(),
    type: 'conversation_completed',
    transcript_ref: 'fixtures/transcripts/case_demo_convertido.txt (não incluído — dado sintético só na simulação)',
  })

  // Conversa hipotética (resumida): paciente diz preferir alguém que vá direto
  // ao ponto, que dê tarefas práticas, focado no presente, tolerando confronto.
  const patientProfile: PatientProfileRecord = {
    case_id: caseId,
    patient_id: patientId,
    profile_version: PROFILE_SCHEMA_VERSION,
    style: {
      directiveness: dim(6),
      emotional_intensity: dim(3),
      temporal_focus: dim(2),
      support_challenge: dim(3),
    },
    engagement_expectation: dim(5),
    constraints: { modality: ['video', 'audio'], price_band: 'padrao', availability_windows: ['seg-manha'] },
    recorded_at: new Date().toISOString(),
  }
  await store.savePatientProfile(patientProfile)

  events.push({
    case_id: caseId,
    event_id: eventId('e', ++n),
    recorded_at: new Date().toISOString(),
    type: 'profile_extracted',
    profile: patientProfile,
    extracted_by: 'curador_humano',
  })

  const floorWarning = styleFloorWarning(patientProfile)
  if (floorWarning) console.warn('[aviso motor matemático]', floorWarning)

  // --- Anti-ancoragem: curador registra palpite ANTES de ver matemática/IA ---
  const curatorJudgment = recordCuratorIndependentJudgment({
    case_id: caseId,
    curator_id: 'cur_demo',
    recommended_psychologist_id: 'psy_ana',
    reasoning:
      'Paciente pediu objetividade e tarefas práticas várias vezes na conversa. Ana costuma ser bem diretiva.',
  })
  events.push(curatorJudgment)

  // --- IA Shadow (manual, V0): humano aplica prompt versionado à transcrição bruta,
  // sem ver o julgamento do curador nem a matemática. ---
  const aiShadow = recordAIShadowHypothesis({
    case_id: caseId,
    model_version: 'human-applied-prompt/v1',
    hypothesis_profile: patientProfile.style,
    hypothesis_ranking: ['psy_ana', 'psy_carla', 'psy_bruno'],
    confidence_note: 'Conversa curta, mas sinais de diretividade e foco em presente são consistentes.',
  })
  events.push(aiShadow)

  // --- Motor Matemático: só agora, e só com filtro duro + estilo, sem ver as duas hipóteses acima ---
  const psychologists = await store.listPsychologists()
  const mathOutput = runMathEngine(patientProfile, psychologists)
  events.push({
    case_id: caseId,
    event_id: eventId('e', ++n),
    recorded_at: new Date().toISOString(),
    type: 'math_engine_computed',
    ...mathOutput,
  })

  // --- Reveal: curador vê as 3 hipóteses lado a lado e decide de fato ---
  const finalDecision = revealAndDecide({
    case_id: caseId,
    curator_id: 'cur_demo',
    independent_judgment: curatorJudgment,
    math_output: mathOutput,
    ai_shadow: aiShadow,
    final_psychologist_id: mathOutput.ranked[0] ?? curatorJudgment.recommended_psychologist_id,
  })
  events.push(finalDecision)

  events.push({
    case_id: caseId,
    event_id: eventId('e', ++n),
    recorded_at: new Date().toISOString(),
    type: 'recommendation_presented',
    presented_psychologist_ids: mathOutput.eligible_candidates,
    highlighted_psychologist_id: finalDecision.final_psychologist_id,
  })

  events.push({
    case_id: caseId,
    event_id: eventId('e', ++n),
    recorded_at: new Date().toISOString(),
    type: 'patient_response',
    response: 'aceitou_destaque',
    chosen_psychologist_id: finalDecision.final_psychologist_id,
  })

  events.push({
    case_id: caseId,
    event_id: eventId('e', ++n),
    recorded_at: new Date().toISOString(),
    type: 'session_completed',
    session_number: 1,
    psychologist_id: finalDecision.final_psychologist_id,
    checkin: {
      q1_falou_o_que_precisava: 5,
      q2_sentiu_ouvido: 4,
      q3_sentiu_compreendido: 5,
      q4_sentiu_confianca: 4,
      q5_profissional_entendeu_momento: 5,
      q6_gostaria_continuar: 5,
      q7_marcaria_nova_conversa: 5,
      q8_compatibilidade_de_estilo: 5,
    },
  })

  events.push({
    case_id: caseId,
    event_id: eventId('e', ++n),
    recorded_at: new Date().toISOString(),
    type: 'status_changed',
    status: 'ativo',
  })

  for (const ev of events) await store.appendEvent(ev)

  // ---------- Caso 2: abandonado no meio (não-convertido, mas não desaparece) ----------
  const abandonedCaseId = 'case_demo_abandonado'
  const abandonedPatientId = 'pat_demo_2'

  await store.savePatient({
    id: abandonedPatientId,
    contact_ref: null,
    consent: { given_at: new Date().toISOString(), scope: ['perfil_matching'] },
    created_at: new Date().toISOString(),
  })

  await store.appendEvent({
    case_id: abandonedCaseId,
    event_id: 'ab_e1',
    recorded_at: new Date().toISOString(),
    type: 'conversation_started',
    patient_id: abandonedPatientId,
    channel: 'texto',
    conducted_by: null,
  })
  await store.appendEvent({
    case_id: abandonedCaseId,
    event_id: 'ab_e2',
    recorded_at: new Date().toISOString(),
    type: 'conversation_abandoned',
    stage: 'apos_pergunta_sobre_expectativa_de_frequencia',
    reason: 'paciente parou de responder',
  })

  console.log('\n=== Caso convertido: decision trail ===\n')
  console.log(JSON.stringify(await reconstructCase(store, caseId), null, 2))

  console.log('\n=== Caso abandonado (não-convertido): decision trail ===\n')
  console.log(JSON.stringify(await reconstructCase(store, abandonedCaseId), null, 2))

  console.log(`\nDados salvos em: ${DEMO_STORE_DIR}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
