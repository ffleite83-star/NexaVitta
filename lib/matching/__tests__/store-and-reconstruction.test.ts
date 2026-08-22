import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { LocalJsonStore } from '../store/local-json-store'
import { reconstructCase } from '../reconstruction/reconstruct-case'
import type { CaseEvent } from '../schema/events'

async function withTempStore(fn: (store: LocalJsonStore) => Promise<void>) {
  const dir = await mkdtemp(path.join(tmpdir(), 'nexavitta-store-'))
  try {
    await fn(new LocalJsonStore(dir))
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

test('LocalJsonStore: eventos são anexados (append-only) e recuperados na ordem', async () => {
  await withTempStore(async (store) => {
    const e1: CaseEvent = {
      case_id: 'case_1',
      event_id: 'ev1',
      recorded_at: '2026-08-22T10:00:00.000Z',
      type: 'conversation_started',
      patient_id: 'pat_1',
      channel: 'texto',
    }
    const e2: CaseEvent = {
      case_id: 'case_1',
      event_id: 'ev2',
      recorded_at: '2026-08-22T10:05:00.000Z',
      type: 'conversation_completed',
    }

    await store.appendEvent(e1)
    await store.appendEvent(e2)

    const events = await store.getEventsForCase('case_1')
    assert.equal(events.length, 2)
    assert.equal(events[0]!.type, 'conversation_started')
    assert.equal(events[1]!.type, 'conversation_completed')
  })
})

test('LocalJsonStore: caso abandonado no meio continua recuperável (não desaparece)', async () => {
  await withTempStore(async (store) => {
    await store.appendEvent({
      case_id: 'case_abandoned',
      event_id: 'ev1',
      recorded_at: '2026-08-22T10:00:00.000Z',
      type: 'conversation_started',
      patient_id: 'pat_2',
      channel: 'texto',
    })
    await store.appendEvent({
      case_id: 'case_abandoned',
      event_id: 'ev2',
      recorded_at: '2026-08-22T10:02:00.000Z',
      type: 'conversation_abandoned',
      stage: 'pergunta_3_de_8',
      reason: 'fechou a aba',
    })

    const caseIds = await store.listCaseIds()
    assert.ok(caseIds.includes('case_abandoned'))

    const trail = await reconstructCase(store, 'case_abandoned')
    assert.equal(trail.conversation.started, true)
    assert.equal(trail.conversation.completed, false)
    assert.equal(trail.conversation.abandoned_at_stage, 'pergunta_3_de_8')
  })
})

test('reconstructCase reconstrói a trilha completa de decisão a partir do log de eventos', async () => {
  await withTempStore(async (store) => {
    const events: CaseEvent[] = [
      {
        case_id: 'case_full',
        event_id: 'e1',
        recorded_at: '2026-08-22T09:00:00.000Z',
        type: 'conversation_started',
        patient_id: 'pat_3',
        channel: 'texto',
      },
      {
        case_id: 'case_full',
        event_id: 'e2',
        recorded_at: '2026-08-22T09:10:00.000Z',
        type: 'conversation_completed',
      },
      {
        case_id: 'case_full',
        event_id: 'e3',
        recorded_at: '2026-08-22T09:20:00.000Z',
        type: 'curator_independent_judgment',
        curator_id: 'cur_1',
        recommended_psychologist_id: 'psy_a',
        reasoning: 'x',
        saw_math_output: false,
        saw_ai_output: false,
      },
      {
        case_id: 'case_full',
        event_id: 'e4',
        recorded_at: '2026-08-22T09:21:00.000Z',
        type: 'ai_shadow_computed',
        model_version: 'manual-v1',
        prompt_version: 'ai-shadow-prompt/v1',
        hypothesis_profile: {},
        hypothesis_ranking: ['psy_a', 'psy_b'],
        confidence_note: 'x',
        contamination_check: {
          received_math_output: false,
          received_curator_output: false,
          received_patient_choice: false,
          received_outcome: false,
        },
      },
      {
        case_id: 'case_full',
        event_id: 'e5',
        recorded_at: '2026-08-22T09:22:00.000Z',
        type: 'math_engine_computed',
        engine_version: 'math-engine/v1',
        eligible_candidates: ['psy_a', 'psy_b'],
        excluded_candidates: [],
        scores: [],
        ranked: ['psy_a', 'psy_b'],
      },
      {
        case_id: 'case_full',
        event_id: 'e6',
        recorded_at: '2026-08-22T09:23:00.000Z',
        type: 'curator_final_decision',
        curator_id: 'cur_1',
        final_psychologist_id: 'psy_a',
        agreed_with_math: true,
        agreed_with_ai: true,
      },
      {
        case_id: 'case_full',
        event_id: 'e7',
        recorded_at: '2026-08-22T09:24:00.000Z',
        type: 'recommendation_presented',
        presented_psychologist_ids: ['psy_a', 'psy_b'],
        highlighted_psychologist_id: 'psy_a',
      },
      {
        case_id: 'case_full',
        event_id: 'e8',
        recorded_at: '2026-08-22T09:30:00.000Z',
        type: 'patient_response',
        response: 'aceitou_destaque',
        chosen_psychologist_id: 'psy_a',
      },
      {
        case_id: 'case_full',
        event_id: 'e9',
        recorded_at: '2026-08-25T09:00:00.000Z',
        type: 'session_completed',
        session_number: 1,
        psychologist_id: 'psy_a',
      },
      {
        case_id: 'case_full',
        event_id: 'e10',
        recorded_at: '2026-08-25T09:01:00.000Z',
        type: 'status_changed',
        status: 'ativo',
      },
    ]

    for (const ev of events) await store.appendEvent(ev)

    const trail = await reconstructCase(store, 'case_full')

    assert.equal(trail.event_count, 10)
    assert.equal(trail.conversation.started, true)
    assert.equal(trail.conversation.completed, true)
    assert.equal(trail.independent_readings.curator_recommended, 'psy_a')
    assert.equal(trail.independent_readings.ai_shadow_top, 'psy_a')
    assert.deepEqual(trail.math_engine.ranked, ['psy_a', 'psy_b'])
    assert.equal(trail.final_decision.final_psychologist_id, 'psy_a')
    assert.equal(trail.final_decision.agreed_with_math, true)
    assert.deepEqual(trail.presented_to_patient.presented_psychologist_ids, ['psy_a', 'psy_b'])
    assert.equal(trail.patient_response.response, 'aceitou_destaque')
    assert.equal(trail.outcome.sessions_completed, 1)
    assert.equal(trail.outcome.last_status, 'ativo')
    assert.equal(trail.timeline.length, 10)
  })
})
