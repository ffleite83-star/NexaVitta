import { test } from 'node:test'
import assert from 'node:assert/strict'
import { runMathEngine, computeStyleScore, styleFloorWarning } from '../engine/math-engine'
import type { PsychologistRecord } from '../schema/psychologist'
import type { PatientProfileRecord } from '../schema/patient'

function dim(value: number | null) {
  return value == null
    ? null
    : { value, source: 'paciente_declarado' as const, recorded_at: '2026-08-22T00:00:00.000Z' }
}

function makePsychologist(overrides: Partial<PsychologistRecord> = {}): PsychologistRecord {
  return {
    id: 'psy_1',
    status: 'ativo',
    crp: null,
    offer: { modality: ['video'], price_band: 'padrao', availability_windows: [] },
    declared_profile: {
      style: {
        directiveness: dim(5),
        emotional_intensity: dim(4),
        temporal_focus: dim(3),
        support_challenge: dim(6),
      },
      version: 'v1',
      recorded_at: '2026-08-22T00:00:00.000Z',
    },
    observed_profile: { style: {}, sample_size: 0, last_updated_at: null },
    active_patient_count: 0,
    profile_version: 'v1',
    ...overrides,
  }
}

function makePatientProfile(overrides: Partial<PatientProfileRecord> = {}): PatientProfileRecord {
  return {
    case_id: 'case_1',
    patient_id: 'pat_1',
    profile_version: 'v1',
    style: {
      directiveness: dim(5),
      emotional_intensity: dim(4),
      temporal_focus: dim(3),
      support_challenge: dim(6),
    },
    engagement_expectation: null,
    constraints: { modality: ['video'], price_band: 'padrao', availability_windows: [] },
    recorded_at: '2026-08-22T00:00:00.000Z',
    ...overrides,
  }
}

test('filtro duro exclui psicólogo com modalidade incompatível, sem tocar em estilo', () => {
  const psy = makePsychologist({ id: 'psy_texto_only', offer: { modality: ['texto'], price_band: 'padrao', availability_windows: [] } })
  const patient = makePatientProfile({ constraints: { modality: ['video'], price_band: 'padrao', availability_windows: [] } })

  const result = runMathEngine(patient, [psy])

  assert.equal(result.eligible_candidates.length, 0)
  assert.equal(result.excluded_candidates[0]?.psychologist_id, 'psy_texto_only')
  assert.match(result.excluded_candidates[0]!.reason, /modalidade/)
  assert.equal(result.scores.length, 0) // nunca calcula estilo pra quem foi excluído na logística
})

test('perfis idênticos produzem compatibilidade 1 (distância zero)', () => {
  const psy = makePsychologist()
  const patient = makePatientProfile()

  const score = computeStyleScore(patient.style, psy)

  assert.equal(score.distance, 0)
  assert.equal(score.compatibility, 1)
  assert.equal(score.reliable, true)
})

test('fórmula de compatibilidade é 1 - (distância L1 / distância máxima possível)', () => {
  const psy = makePsychologist({
    declared_profile: {
      style: {
        directiveness: dim(1), // paciente=5 -> diff 4
        emotional_intensity: dim(4), // diff 0
        temporal_focus: dim(3), // diff 0
        support_challenge: dim(2), // paciente=6 -> diff 4
      },
      version: 'v1',
      recorded_at: '2026-08-22T00:00:00.000Z',
    },
  })
  const patient = makePatientProfile()

  const score = computeStyleScore(patient.style, psy)

  // soma diffs = 4+0+0+4 = 8, sobre 4 dimensões * 6 = 24 -> compat = 1 - 8/24 = 0.6666...
  assert.equal(score.distance, 8)
  assert.ok(Math.abs((score.compatibility ?? 0) - (1 - 8 / 24)) < 1e-9)
})

test('dimensões não preenchidas de ambos os lados não entram na conta', () => {
  const psy = makePsychologist({
    declared_profile: {
      style: {
        directiveness: dim(5),
        emotional_intensity: null,
        temporal_focus: dim(3),
        support_challenge: dim(6),
      },
      version: 'v1',
      recorded_at: '2026-08-22T00:00:00.000Z',
    },
  })
  const patient = makePatientProfile({
    style: {
      directiveness: dim(5),
      emotional_intensity: dim(4), // psicólogo não tem essa dimensão -> não compara
      temporal_focus: dim(3),
      support_challenge: dim(6),
    },
  })

  const score = computeStyleScore(patient.style, psy)

  assert.equal(score.per_dimension.emotional_intensity, null)
  assert.equal(score.distance, 0) // as 3 dimensões comparáveis são idênticas
  assert.equal(score.compatibility, 1)
})

test('perfil com menos de 2/4 dimensões preenchidas gera aviso de piso mínimo', () => {
  const patient = makePatientProfile({
    style: {
      directiveness: dim(5),
      emotional_intensity: null,
      temporal_focus: null,
      support_challenge: null,
    },
  })

  const warning = styleFloorWarning(patient)
  assert.ok(warning != null)
  assert.match(warning!, /1\/4/)
})

test('psicólogo inativo é excluído mesmo com estilo compatível', () => {
  const psy = makePsychologist({ status: 'inativo' })
  const patient = makePatientProfile()

  const result = runMathEngine(patient, [psy])

  assert.equal(result.eligible_candidates.length, 0)
  assert.match(result.excluded_candidates[0]!.reason, /status=inativo/)
})

test('empate de compatibilidade é resolvido por menor active_patient_count', () => {
  const psyA = makePsychologist({ id: 'psy_a', active_patient_count: 5 })
  const psyB = makePsychologist({ id: 'psy_b', active_patient_count: 1 })
  const patient = makePatientProfile()

  const result = runMathEngine(patient, [psyA, psyB])

  assert.deepEqual(result.ranked, ['psy_b', 'psy_a'])
})
