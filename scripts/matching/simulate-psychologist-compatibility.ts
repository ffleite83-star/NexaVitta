import { LocalJsonStore } from '../../lib/matching/store/local-json-store'
import { seedPsychologists, STORE_DIR } from './seed-psychologists'
import { findCompatiblePatientsForPsychologist } from '../../lib/matching/engine/reverse-compatibility'
import type { PatientProfileRecord } from '../../lib/matching/schema/patient'
import { PROFILE_SCHEMA_VERSION } from '../../lib/matching/versions'

function dim(value: number) {
  return { value, source: 'curador_inferido' as const, recorded_at: new Date().toISOString() }
}

/**
 * Lado psicólogo do marketplace (pedido original, seção 23): dado um
 * psicólogo já cadastrado, quais perfis de paciente registrados são
 * elegíveis e compatíveis com ele — mesma regra, direção invertida.
 * Só dado. Nenhuma UX, nenhuma promessa de volume pro profissional.
 *
 * Rodar: npx tsx scripts/matching/simulate-psychologist-compatibility.ts
 * (roda simulate-patient-case.ts antes, se quiser ver o caso_demo_convertido
 * junto no pool de perfis — aqui geramos perfis de paciente próprios pra não
 * depender de ordem de execução dos scripts.)
 */
async function main() {
  const store = new LocalJsonStore(STORE_DIR)
  await seedPsychologists(store)

  const profiles: PatientProfileRecord[] = [
    {
      case_id: 'case_rev_1',
      patient_id: 'pat_rev_1',
      profile_version: PROFILE_SCHEMA_VERSION,
      style: {
        directiveness: dim(6),
        emotional_intensity: dim(3),
        temporal_focus: dim(2),
        support_challenge: dim(3),
      },
      engagement_expectation: null,
      constraints: { modality: ['video', 'audio'], price_band: 'padrao', availability_windows: ['seg-manha'] },
      recorded_at: new Date().toISOString(),
    },
    {
      case_id: 'case_rev_2',
      patient_id: 'pat_rev_2',
      profile_version: PROFILE_SCHEMA_VERSION,
      style: {
        directiveness: dim(2),
        emotional_intensity: dim(6),
        temporal_focus: dim(5),
        support_challenge: dim(6),
      },
      engagement_expectation: null,
      constraints: { modality: ['video'], price_band: 'padrao', availability_windows: ['ter-noite'] },
      recorded_at: new Date().toISOString(),
    },
    {
      case_id: 'case_rev_3',
      patient_id: 'pat_rev_3',
      profile_version: PROFILE_SCHEMA_VERSION,
      style: {
        directiveness: dim(4),
        emotional_intensity: dim(4),
        temporal_focus: dim(4),
        support_challenge: dim(4),
      },
      engagement_expectation: null,
      constraints: { modality: ['texto'], price_band: 'caro', availability_windows: ['qui-manha'] }, // faixa de preço incompatível com psy_carla de propósito
      recorded_at: new Date().toISOString(),
    },
  ]

  for (const p of profiles) await store.savePatientProfile(p)

  const psychologists = await store.listPsychologists()

  for (const psy of psychologists) {
    const result = findCompatiblePatientsForPsychologist(psy, profiles)
    console.log(`\n=== Perfis de paciente compatíveis com ${psy.id} ===`)
    console.log(JSON.stringify(result, null, 2))
  }

  console.log(`\nDados salvos em: ${STORE_DIR}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
