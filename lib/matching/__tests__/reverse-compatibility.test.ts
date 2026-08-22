import { test } from 'node:test'
import assert from 'node:assert/strict'
import { findCompatiblePatientsForPsychologist } from '../engine/reverse-compatibility'
import { computeStyleScore } from '../engine/math-engine'
import type { PsychologistRecord } from '../schema/psychologist'
import type { PatientProfileRecord } from '../schema/patient'

function dim(value: number) {
  return { value, source: 'paciente_declarado' as const, recorded_at: '2026-08-22T00:00:00.000Z' }
}

const psy: PsychologistRecord = {
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
}

test('lado psicólogo->paciente aplica o mesmo filtro duro do lado paciente->psicólogo', () => {
  const compatible: PatientProfileRecord = {
    case_id: 'case_ok',
    patient_id: 'pat_1',
    profile_version: 'v1',
    style: { directiveness: dim(5), emotional_intensity: dim(4), temporal_focus: dim(3), support_challenge: dim(6) },
    engagement_expectation: null,
    constraints: { modality: ['video'], price_band: 'padrao', availability_windows: [] },
    recorded_at: '2026-08-22T00:00:00.000Z',
  }
  const incompatible: PatientProfileRecord = {
    ...compatible,
    case_id: 'case_texto_only',
    constraints: { modality: ['texto'], price_band: 'padrao', availability_windows: [] },
  }

  const result = findCompatiblePatientsForPsychologist(psy, [compatible, incompatible])

  assert.deepEqual(result.eligible_case_ids, ['case_ok'])
  assert.equal(result.excluded[0]?.case_id, 'case_texto_only')
})

test('score de compatibilidade no sentido reverso bate com computeStyleScore direto', () => {
  const profile: PatientProfileRecord = {
    case_id: 'case_1',
    patient_id: 'pat_1',
    profile_version: 'v1',
    style: { directiveness: dim(2), emotional_intensity: dim(4), temporal_focus: dim(3), support_challenge: dim(6) },
    engagement_expectation: null,
    constraints: { modality: ['video'], price_band: 'padrao', availability_windows: [] },
    recorded_at: '2026-08-22T00:00:00.000Z',
  }

  const reverse = findCompatiblePatientsForPsychologist(psy, [profile])
  const direct = computeStyleScore(profile.style, psy)

  assert.equal(reverse.scores[0]!.compatibility, direct.compatibility)
  assert.equal(reverse.scores[0]!.distance, direct.distance)
  assert.equal(reverse.ranked_case_ids[0], 'case_1')
})
