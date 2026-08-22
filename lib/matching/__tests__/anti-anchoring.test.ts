import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  recordCuratorIndependentJudgment,
  recordAIShadowHypothesis,
  revealAndDecide,
  compareHypotheses,
} from '../curation/anti-anchoring'
import type { MathEngineOutput } from '../engine/math-engine'

test('julgamento independente do curador sempre marca saw_math_output e saw_ai_output como false', () => {
  const judgment = recordCuratorIndependentJudgment({
    case_id: 'case_1',
    curator_id: 'cur_1',
    recommended_psychologist_id: 'psy_a',
    reasoning: 'Paciente parece querer alguém mais diretivo.',
  })

  assert.equal(judgment.saw_math_output, false)
  assert.equal(judgment.saw_ai_output, false)
  assert.equal(judgment.type, 'curator_independent_judgment')
})

test('IA Shadow sempre registra contamination_check totalmente false — estruturalmente, não por convenção', () => {
  const shadow = recordAIShadowHypothesis({
    case_id: 'case_1',
    model_version: 'manual-v1',
    hypothesis_profile: {},
    hypothesis_ranking: ['psy_b', 'psy_a'],
    confidence_note: 'Baixa confiança, conversa curta.',
  })

  assert.deepEqual(shadow.contamination_check, {
    received_math_output: false,
    received_curator_output: false,
    received_patient_choice: false,
    received_outcome: false,
  })
})

test('revealAndDecide detecta corretamente concordância e divergência com matemática/IA', () => {
  const judgment = recordCuratorIndependentJudgment({
    case_id: 'case_1',
    curator_id: 'cur_1',
    recommended_psychologist_id: 'psy_a',
    reasoning: 'x',
  })
  const shadow = recordAIShadowHypothesis({
    case_id: 'case_1',
    model_version: 'manual-v1',
    hypothesis_profile: {},
    hypothesis_ranking: ['psy_b', 'psy_a'],
    confidence_note: 'x',
  })
  const mathOutput: MathEngineOutput = {
    engine_version: 'math-engine/v1',
    eligible_candidates: ['psy_a', 'psy_b'],
    excluded_candidates: [],
    scores: [],
    ranked: ['psy_a', 'psy_b'],
  }

  // Curador, depois de ver os dois, decide bater com a matemática (psy_a), não com a IA (psy_b).
  const decision = revealAndDecide({
    case_id: 'case_1',
    curator_id: 'cur_1',
    independent_judgment: judgment,
    math_output: mathOutput,
    ai_shadow: shadow,
    final_psychologist_id: 'psy_a',
  })

  assert.equal(decision.agreed_with_math, true)
  assert.equal(decision.agreed_with_ai, false)

  const comparison = compareHypotheses(judgment, mathOutput, shadow)
  assert.equal(comparison.curator_top, 'psy_a')
  assert.equal(comparison.math_top, 'psy_a')
  assert.equal(comparison.ai_top, 'psy_b')
  assert.equal(comparison.all_three_agree, false)
  assert.equal(comparison.curator_agrees_with_math, true)
})
