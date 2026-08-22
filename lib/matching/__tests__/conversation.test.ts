import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { LocalJsonStore } from '../store/local-json-store'
import { reconstructCase } from '../reconstruction/reconstruct-case'
import { SYNTHETIC_CASES, runFixtureConversation } from '../../conversation/fixtures'
import { extractForCheckpoint, startConversation, submitResponse, summarizeForCheckpoint } from '../../conversation/engine'
import { extractProfileSignals } from '../../conversation/extractor'
import {
  recordCompletedConversation,
  recordAbandonedConversation,
  recordProfileConfirmation,
  recordProfileCorrections,
} from '../../conversation/recorder'

function fixture(key: string) {
  const f = SYNTHETIC_CASES.find((c) => c.key === key)
  assert.ok(f, `fixture ${key} não encontrada`)
  return f!
}

async function withStore(fn: (store: LocalJsonStore) => Promise<void>) {
  const dir = await mkdtemp(path.join(tmpdir(), 'nexavitta-conv-'))
  try {
    await fn(new LocalJsonStore(dir))
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

// ---------- extrator: unitários ----------

test('extrator: sem evidência -> value null (não inventa certeza)', () => {
  const r = extractProfileSignals('Não sei bem o que dizer sobre isso.', '2026-08-22T00:00:00.000Z')
  assert.equal(r.style.directiveness, null)
  assert.equal(r.style.emotional_intensity, null)
  assert.equal(r.style.temporal_focus, null)
  assert.equal(r.style.support_challenge, null)
  assert.equal(r.engagement, null)
})

test('extrator: sinais conflitantes -> value null, evidência dos dois lados preservada', () => {
  const r = extractProfileSignals(
    'Quero um plano com passos claros, mas não gosto que me digam o que fazer.',
    '2026-08-22T00:00:00.000Z'
  )
  const d = r.style.directiveness
  assert.ok(d != null)
  assert.equal(d!.value, null)
  assert.equal(d!.confidence, 'baixa')
  assert.match(d!.evidence!, /sinais conflitantes/)
})

test('extrator: toda leitura carrega a fala original como evidência (RAW preservado)', () => {
  const r = extractProfileSignals('Eu preciso de acolhimento, de alguém que me escute.', '2026-08-22T00:00:00.000Z')
  const sc = r.style.support_challenge
  assert.ok(sc?.value != null && sc.value >= 5)
  assert.match(sc!.evidence!, /acolhimento/)
  assert.equal(sc!.source, 'regra_derivada')
})

test('extrator: casos A-H produzem sinal na dimensão esperada, na direção esperada', () => {
  const expectations: Array<[string, 'directiveness' | 'emotional_intensity' | 'temporal_focus' | 'support_challenge', 'alto' | 'baixo']> = [
    ['caso_a_diretividade', 'directiveness', 'alto'],
    ['caso_b_autonomia', 'directiveness', 'baixo'],
    ['caso_c_emocional', 'emotional_intensity', 'alto'],
    ['caso_d_contido', 'emotional_intensity', 'baixo'],
    ['caso_e_passado', 'temporal_focus', 'alto'],
    ['caso_f_presente', 'temporal_focus', 'baixo'],
    ['caso_g_suporte', 'support_challenge', 'alto'],
    ['caso_h_desafio', 'support_challenge', 'baixo'],
  ]
  for (const [key, dim, direction] of expectations) {
    const run = runFixtureConversation(fixture(key))
    assert.equal(run.completed, true, `${key} deveria completar`)
    const extraction = extractForCheckpoint(run.state)
    const v = extraction.style[dim]?.value
    assert.ok(v != null, `${key}: ${dim} deveria ter valor`)
    if (direction === 'alto') assert.ok(v! >= 5, `${key}: ${dim}=${v} deveria ser >=5`)
    else assert.ok(v! <= 3, `${key}: ${dim}=${v} deveria ser <=3`)
  }
})

test('engine: sondagens só são feitas para dimensões sem sinal (conversa curta quando sinal vem cedo)', () => {
  // Caso C dá sinal emocional já nas abertas -> sondagem emocional não deve ser feita
  const run = runFixtureConversation(fixture('caso_c_emocional'))
  assert.ok(!run.state.asked_prompt_ids.includes('sondagem_emocional'))
  // Caso I não dá sinal nenhum -> todas as 4 sondagens devem ter sido feitas
  const runI = runFixtureConversation(fixture('caso_i_ambiguo'))
  assert.ok(runI.state.asked_prompt_ids.includes('sondagem_diretividade'))
  assert.ok(runI.state.asked_prompt_ids.includes('sondagem_emocional'))
  assert.ok(runI.state.asked_prompt_ids.includes('sondagem_tempo'))
  assert.ok(runI.state.asked_prompt_ids.includes('sondagem_suporte_desafio'))
})

test('checkpoint: sem leitura clara, o resumo admite em vez de adivinhar', () => {
  const run = runFixtureConversation(fixture('caso_i_ambiguo'))
  const summary = summarizeForCheckpoint(extractForCheckpoint(run.state))
  assert.equal(summary.length, 1)
  assert.match(summary[0]!, /prefiro não adivinhar/)
})

// ---------- fluxo 1: START -> CONVERSA -> TRANSCRIÇÃO -> PERFIL -> CONFIRMAÇÃO -> CASE ----------

test('fluxo completo: conversa -> transcrição -> perfil -> confirmação -> trail reconstruível', async () => {
  await withStore(async (store) => {
    const run = runFixtureConversation(fixture('caso_a_diretividade'))
    assert.equal(run.completed, true)

    await recordCompletedConversation(store, {
      case_id: 'case_t1',
      patient_id: 'pat_t1',
      state: run.state,
    })
    await recordProfileConfirmation(store, 'case_t1')

    const trail = await reconstructCase(store, 'case_t1')
    assert.equal(trail.conversation.started, true)
    assert.equal(trail.conversation.completed, true)
    assert.ok(trail.conversation.response_turns >= 2)
    assert.equal(trail.conversation.transcript_ref, 'case_t1')
    assert.equal(trail.conversation.flow_version, 'conversation-flow/v1')
    assert.equal(trail.profile_review.confirmed, true)

    // RAW acessível pelo ponteiro
    const transcript = await store.getTranscript('case_t1')
    assert.ok(transcript != null)
    assert.ok(transcript!.turns.some((t) => t.speaker === 'paciente'))

    // Perfil no modelo EXISTENTE do projeto (nenhum modelo paralelo)
    const profile = await store.getPatientProfile('case_t1')
    assert.ok(profile != null)
    assert.ok(profile!.style.directiveness?.value != null)
    assert.equal(profile!.style.directiveness!.source, 'regra_derivada')
    assert.ok(profile!.style.directiveness!.evidence != null)
  })
})

// ---------- fluxo 2: START -> CONVERSA -> ABANDONO -> CASE INCOMPLETO ----------

test('fluxo de abandono: caso incompleto registrado, com RAW parcial, sem perfil', async () => {
  await withStore(async (store) => {
    const run = runFixtureConversation(fixture('caso_k_abandono'))
    assert.equal(run.completed, false)

    await recordAbandonedConversation(store, {
      case_id: 'case_t2',
      patient_id: 'pat_t2',
      state: run.state,
      stage: 'apos_resposta_1',
    })

    const trail = await reconstructCase(store, 'case_t2')
    assert.equal(trail.conversation.started, true)
    assert.equal(trail.conversation.completed, false)
    assert.equal(trail.conversation.abandoned_at_stage, 'apos_resposta_1')
    assert.equal(trail.conversation.response_turns, 1)

    // RAW parcial preservado; nenhum perfil inventado
    assert.ok((await store.getTranscript('case_t2')) != null)
    assert.equal(await store.getPatientProfile('case_t2'), null)
  })
})

// ---------- fluxo 3: correção com versão original preservada ----------

test('fluxo de correção: original preservado no trail, correção registrada com proveniência paciente_declarado', async () => {
  await withStore(async (store) => {
    const run = runFixtureConversation(fixture('caso_l_correcao'))
    const { profile: original } = await recordCompletedConversation(store, {
      case_id: 'case_t3',
      patient_id: 'pat_t3',
      state: run.state,
    })
    const originalValue = original.style.directiveness?.value
    assert.ok(originalValue != null && originalValue >= 5)

    const updated = await recordProfileCorrections(store, 'case_t3', [
      { dimension: 'directiveness', corrected_value: 2, correction_note: 'Quero decidir eu mesmo.' },
    ])

    // perfil atual reflete a correção, com proveniência honesta
    assert.equal(updated!.style.directiveness!.value, 2)
    assert.equal(updated!.style.directiveness!.source, 'paciente_declarado')

    // a interpretação ORIGINAL continua no event trail, intacta
    const events = await store.getEventsForCase('case_t3')
    const extractedEvent = events.find((e) => e.type === 'profile_extracted')
    assert.ok(extractedEvent != null && extractedEvent.type === 'profile_extracted')
    assert.equal(extractedEvent.profile.style.directiveness!.value, originalValue)
    assert.equal(extractedEvent.profile.style.directiveness!.source, 'regra_derivada')

    // e o trail mostra a correção
    const trail = await reconstructCase(store, 'case_t3')
    assert.equal(trail.profile_review.confirmed, false)
    assert.equal(trail.profile_review.corrections.length, 1)
    assert.equal(trail.profile_review.corrections[0]!.previous_value, originalValue)
    assert.equal(trail.profile_review.corrections[0]!.corrected_value, 2)
  })
})

// ---------- conversa longa vs. curta ----------

test('conversa longa (caso I, 7 respostas) e curta (sinais cedo) ambas completam', () => {
  const longRun = runFixtureConversation(fixture('caso_i_ambiguo'))
  assert.equal(longRun.completed, true)
  assert.equal(longRun.responses_used, 7)

  const shortRun = runFixtureConversation(fixture('caso_c_emocional'))
  assert.equal(shortRun.completed, true)
  assert.ok(shortRun.responses_used < 7)
})

test('engine é puro: mesma entrada, mesma saída (determinismo p/ reprocessar caso com outra versão depois)', () => {
  const clock = () => '2026-08-22T12:00:00.000Z'
  const a = runFixtureConversation(fixture('caso_a_diretividade'), 'texto', clock)
  const b = runFixtureConversation(fixture('caso_a_diretividade'), 'texto', clock)
  assert.deepEqual(a.state, b.state)
  assert.deepEqual(extractForCheckpoint(a.state, clock), extractForCheckpoint(b.state, clock))
})
