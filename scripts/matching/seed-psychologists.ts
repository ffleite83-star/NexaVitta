import path from 'path'
import { LocalJsonStore } from '../../lib/matching/store/local-json-store'
import type { PsychologistRecord } from '../../lib/matching/schema/psychologist'

export const STORE_DIR = path.join(process.cwd(), 'data', 'fixtures', 'store')

function dim(value: number) {
  return { value, source: 'paciente_declarado' as const, recorded_at: '2026-08-01T00:00:00.000Z' }
}

/**
 * 3 psicólogos sintéticos — o mínimo pra simulação ser interessante (mostrar
 * filtro duro excluindo um, e desempate/ranking entre os outros dois).
 * Dado fictício: seguro pro repositório público (ver aviso em store/types.ts).
 */
export function syntheticPsychologists(): PsychologistRecord[] {
  return [
    {
      id: 'psy_ana',
      status: 'ativo',
      crp: 'CRP-EXEMPLO-01', // NECESSITA VALIDAÇÃO PROFISSIONAL/REGULATÓRIA
      offer: { modality: ['video', 'audio'], price_band: 'padrao', availability_windows: ['seg-manha', 'qua-noite'] },
      declared_profile: {
        style: {
          directiveness: dim(6), // bem diretiva
          emotional_intensity: dim(3),
          temporal_focus: dim(3), // foco em presente
          support_challenge: dim(3), // mais desafio
        },
        version: 'profile-schema/v1',
        recorded_at: '2026-08-01T00:00:00.000Z',
      },
      observed_profile: { style: {}, sample_size: 0, last_updated_at: null },
      active_patient_count: 3,
      profile_version: 'profile-schema/v1',
    },
    {
      id: 'psy_bruno',
      status: 'ativo',
      crp: 'CRP-EXEMPLO-02',
      offer: { modality: ['video'], price_band: 'padrao', availability_windows: ['ter-noite'] },
      declared_profile: {
        style: {
          directiveness: dim(2), // pouco diretivo, mais escuta
          emotional_intensity: dim(6),
          temporal_focus: dim(5), // mais passado
          support_challenge: dim(6), // mais suporte
        },
        version: 'profile-schema/v1',
        recorded_at: '2026-08-01T00:00:00.000Z',
      },
      observed_profile: { style: {}, sample_size: 0, last_updated_at: null },
      active_patient_count: 1,
      profile_version: 'profile-schema/v1',
    },
    {
      id: 'psy_carla',
      status: 'ativo',
      crp: 'CRP-EXEMPLO-03',
      offer: { modality: ['texto'], price_band: 'econômico', availability_windows: ['qui-manha'] },
      declared_profile: {
        style: {
          directiveness: dim(4),
          emotional_intensity: dim(4),
          temporal_focus: dim(4),
          support_challenge: dim(4),
        },
        version: 'profile-schema/v1',
        recorded_at: '2026-08-01T00:00:00.000Z',
      },
      observed_profile: { style: {}, sample_size: 0, last_updated_at: null },
      active_patient_count: 0,
      profile_version: 'profile-schema/v1',
    },
  ]
}

export async function seedPsychologists(store: LocalJsonStore) {
  for (const psy of syntheticPsychologists()) {
    await store.savePsychologist(psy)
  }
}
