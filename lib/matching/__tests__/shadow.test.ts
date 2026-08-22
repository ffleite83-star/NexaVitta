import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { LocalJsonStore } from '../store/local-json-store'
import { registerInterpretation, getFirstInterpretations } from '../../shadow/interpretation'
import { compareCase, computeMetrics, toBucket } from '../../shadow/comparison'
import { formatTranscriptOnly } from '../../../scripts/shadow/common'
import { runFixtureConversation, SYNTHETIC_CASES } from '../../conversation/fixtures'
import { recordCompletedConversation, recordProfileCorrections } from '../../conversation/recorder'
import type { StyleProfile } from '../schema/common'

async function withStore(fn: (store: LocalJsonStore) => Promise<void>) {
  const dir = await mkdtemp(path.join(tmpdir(), 'nexavitta-shadow-'))
  try {
    await fn(new LocalJsonStore(dir))
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

function style(dirValue: number | null, provenance: 'curador_inferido' | 'ia_inferido'): StyleProfile {
  return {
    directiveness:
      dirValue == null
        ? null
        : { value: dirValue, source: provenance, recorded_at: '2026-08-22T10:00:00.000Z', evidence: 'trecho', confidence: 'alta' },
    emotional_intensity: null,
    temporal_focus: null,
    support_challenge: null,
  }
}

test('buckets: null->sem_leitura, 1-3->baixo, 4->medio, 5-7->alto', () => {
  assert.equal(toBucket(null), 'sem_leitura')
  assert.equal(toBucket(1), 'baixo')
  assert.equal(toBucket(3), 'baixo')
  assert.equal(toBucket(4), 'medio')
  assert.equal(toBucket(5), 'alto')
  assert.equal(toBucket(7), 'alto')
})

test('cada interpretação carrega proveniência completa (source, version, timestamp, caso, independence_check)', async () => {
  await withStore(async (store) => {
    const ev = await registerInterpretation(store, {
      case_id: 'case_s1',
      patient_id: 'pat_s1',
      source: 'ia_shadow',
      interpreter_id: 'modelo-x',
      style: style(6, 'ia_inferido'),
      model_version: 'modelo-x/1',
      prompt_version: 'ai-shadow/v0.1',
      notes: 'justificativa',
    })
    assert.equal(ev.extracted_by, 'ia_shadow')
    assert.equal(ev.model_version, 'modelo-x/1')
    assert.equal(ev.prompt_version, 'ai-shadow/v0.1')
    assert.equal(ev.case_id, 'case_s1')
    assert.ok(ev.recorded_at)
    assert.deepEqual(ev.independence_check, {
      saw_rule_output: false,
      saw_curator_output: false,
      saw_ai_output: false,
      saw_patient_correction: false,
    })
  })
})

test('julgamento inicial é travado: segundo registro do curador NÃO substitui o primeiro', async () => {
  await withStore(async (store) => {
    await registerInterpretation(store, {
      case_id: 'case_s2', patient_id: 'pat_s2', source: 'curador_humano', interpreter_id: 'cur_1',
      style: style(6, 'curador_inferido'), now: () => '2026-08-22T10:00:00.000Z',
    })
    await registerInterpretation(store, {
      case_id: 'case_s2', patient_id: 'pat_s2', source: 'curador_humano', interpreter_id: 'cur_1',
      style: style(2, 'curador_inferido'), now: () => '2026-08-22T11:00:00.000Z',
    })
    const { curador, extra } = await getFirstInterpretations(store, 'case_s2')
    assert.equal(curador!.profile.style.directiveness!.value, 6) // o primeiro vale
    assert.equal(extra.length, 1) // o segundo fica no log, mas não substitui
    assert.equal(extra[0]!.profile.style.directiveness!.value, 2)
  })
})

test('gate de reveal: sem curador OU sem IA, compareCase devolve pendente e nenhuma linha', async () => {
  await withStore(async (store) => {
    let comp = await compareCase(store, 'case_s3')
    assert.equal(comp.ready, false)
    assert.deepEqual(comp.missing, ['curador_humano', 'ia_shadow'])
    assert.equal(comp.rows.length, 0)

    await registerInterpretation(store, {
      case_id: 'case_s3', patient_id: 'pat_s3', source: 'curador_humano', interpreter_id: 'cur_1',
      style: style(6, 'curador_inferido'),
    })
    comp = await compareCase(store, 'case_s3')
    assert.equal(comp.ready, false)
    assert.deepEqual(comp.missing, ['ia_shadow'])

    await registerInterpretation(store, {
      case_id: 'case_s3', patient_id: 'pat_s3', source: 'ia_shadow', interpreter_id: 'modelo-x',
      style: style(7, 'ia_inferido'),
    })
    comp = await compareCase(store, 'case_s3')
    assert.equal(comp.ready, true)
    assert.equal(comp.rows.length, 4)
    // 6 e 7 caem no mesmo bucket (alto): concordância, não erro por diferença numérica
    assert.equal(comp.rows.find((r) => r.dimension === 'directiveness')!.ia_igual_curador, true)
  })
})

test('pacote do curador/IA contém SÓ o RAW: nenhuma interpretação nem correção do paciente vaza', async () => {
  await withStore(async (store) => {
    const fixture = SYNTHETIC_CASES.find((c) => c.key === 'caso_l_correcao')!
    const run = runFixtureConversation(fixture)
    await recordCompletedConversation(store, { case_id: 'case_s4', patient_id: 'pat_s4', state: run.state })

    // paciente corrige (não pode contaminar a IA)
    await recordProfileCorrections(store, 'case_s4', [
      { dimension: 'directiveness', corrected_value: 2, correction_note: 'FRASE_DE_CORRECAO_SECRETA' },
    ])
    // curador registra com evidência marcada
    await registerInterpretation(store, {
      case_id: 'case_s4', patient_id: 'pat_s4', source: 'curador_humano', interpreter_id: 'cur_1',
      style: {
        directiveness: { value: 7, source: 'curador_inferido', recorded_at: '2026-08-22T10:00:00.000Z', evidence: 'EVIDENCIA_DO_CURADOR_SECRETA', confidence: 'alta' },
        emotional_intensity: null, temporal_focus: null, support_challenge: null,
      },
    })

    const transcript = await store.getTranscript('case_s4')
    const pacote = formatTranscriptOnly(transcript!)
    // por construção, o pacote vem só do TranscriptRecord:
    assert.ok(!pacote.includes('FRASE_DE_CORRECAO_SECRETA'))
    assert.ok(!pacote.includes('EVIDENCIA_DO_CURADOR_SECRETA'))
    assert.ok(!pacote.includes('regra_derivada'))
    assert.ok(pacote.includes('Preciso de orientação')) // o RAW de verdade está lá
  })
})

test('RAW original nunca é sobrescrito por interpretações nem correções', async () => {
  await withStore(async (store) => {
    const fixture = SYNTHETIC_CASES.find((c) => c.key === 'caso_a_diretividade')!
    const run = runFixtureConversation(fixture)
    await recordCompletedConversation(store, { case_id: 'case_s5', patient_id: 'pat_s5', state: run.state })

    const before = JSON.stringify(await store.getTranscript('case_s5'))

    await registerInterpretation(store, {
      case_id: 'case_s5', patient_id: 'pat_s5', source: 'curador_humano', interpreter_id: 'cur_1',
      style: style(6, 'curador_inferido'),
    })
    await registerInterpretation(store, {
      case_id: 'case_s5', patient_id: 'pat_s5', source: 'ia_shadow', interpreter_id: 'modelo-x',
      style: style(7, 'ia_inferido'),
    })
    await recordProfileCorrections(store, 'case_s5', [{ dimension: 'directiveness', corrected_value: 3 }])

    const after = JSON.stringify(await store.getTranscript('case_s5'))
    assert.equal(before, after)
  })
})

test('métricas descritivas: categorias da seção 12/17 calculadas', async () => {
  await withStore(async (store) => {
    // regra ausente de propósito (baseline opcional); IA=alto, curador=alto -> concordam; regra sem_leitura diverge
    await registerInterpretation(store, {
      case_id: 'case_s6', patient_id: 'pat_s6', source: 'curador_humano', interpreter_id: 'cur_1',
      style: style(6, 'curador_inferido'),
    })
    await registerInterpretation(store, {
      case_id: 'case_s6', patient_id: 'pat_s6', source: 'ia_shadow', interpreter_id: 'modelo-x',
      style: style(7, 'ia_inferido'),
    })
    const comp = await compareCase(store, 'case_s6')
    const metrics = computeMetrics([comp])
    assert.equal(metrics.cases_compared, 1)
    assert.equal(metrics.per_dimension.directiveness!.ia_x_curador, 1)
    assert.equal(metrics.ia_curador_concordam_regra_diverge, 1) // IA=Cur=alto, regra=sem_leitura
    // dimensões onde ambos ficaram sem leitura contam como ambos_incertos
    assert.equal(metrics.ambos_incertos, 3)
  })
})
