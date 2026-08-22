import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import type { CaseStore } from '../store/types'
import { LocalJsonStore } from '../store/local-json-store'
import { reconstructCase } from '../reconstruction/reconstruct-case'
import type { CaseEvent } from '../schema/events'
import type { PatientRecord, PatientProfileRecord } from '../schema/patient'
import type { PsychologistRecord } from '../schema/psychologist'

/**
 * Teste de CONTRATO da interface CaseStore (V0.1, "persistence-ready").
 *
 * A mesma bateria comportamental roda contra duas implementações totalmente
 * diferentes: LocalJsonStore (arquivo) e um InMemoryStore escrito aqui no
 * teste, só contra a interface. Se as duas passam e reconstructCase funciona
 * igual nas duas, está provado que trocar a persistência (ex.: Supabase no
 * futuro, pós Launch Gate) não exige tocar no domínio. O InMemoryStore vive
 * DENTRO deste arquivo de propósito: ele é prova, não camada de produção.
 */
class InMemoryStore implements CaseStore {
  private events = new Map<string, CaseEvent[]>()
  private patients = new Map<string, PatientRecord>()
  private profiles = new Map<string, PatientProfileRecord>()
  private psychologists = new Map<string, PsychologistRecord>()

  async appendEvent(event: CaseEvent): Promise<void> {
    const list = this.events.get(event.case_id) ?? []
    list.push(event)
    this.events.set(event.case_id, list)
  }
  async getEventsForCase(caseId: string): Promise<CaseEvent[]> {
    return [...(this.events.get(caseId) ?? [])]
  }
  async listCaseIds(): Promise<string[]> {
    return [...this.events.keys()]
  }
  async savePatient(record: PatientRecord): Promise<void> {
    this.patients.set(record.id, record)
  }
  async getPatient(id: string): Promise<PatientRecord | null> {
    return this.patients.get(id) ?? null
  }
  async savePatientProfile(record: PatientProfileRecord): Promise<void> {
    this.profiles.set(record.case_id, record)
  }
  async getPatientProfile(caseId: string): Promise<PatientProfileRecord | null> {
    return this.profiles.get(caseId) ?? null
  }
  async savePsychologist(record: PsychologistRecord): Promise<void> {
    this.psychologists.set(record.id, record)
  }
  async getPsychologist(id: string): Promise<PsychologistRecord | null> {
    return this.psychologists.get(id) ?? null
  }
  async listPsychologists(): Promise<PsychologistRecord[]> {
    return [...this.psychologists.values()]
  }
}

type StoreFactory = { name: string; create: () => Promise<{ store: CaseStore; cleanup: () => Promise<void> }> }

const factories: StoreFactory[] = [
  {
    name: 'LocalJsonStore',
    create: async () => {
      const dir = await mkdtemp(path.join(tmpdir(), 'nexavitta-contract-'))
      return { store: new LocalJsonStore(dir), cleanup: () => rm(dir, { recursive: true, force: true }) }
    },
  },
  {
    name: 'InMemoryStore',
    create: async () => ({ store: new InMemoryStore(), cleanup: async () => {} }),
  },
]

const sampleEvents: CaseEvent[] = [
  {
    case_id: 'case_c1',
    event_id: 'e1',
    recorded_at: '2026-08-22T09:00:00.000Z',
    type: 'conversation_started',
    patient_id: 'pat_c1',
    channel: 'texto',
  },
  {
    case_id: 'case_c1',
    event_id: 'e2',
    recorded_at: '2026-08-22T09:05:00.000Z',
    type: 'conversation_abandoned',
    stage: 'meio',
    reason: 'teste de contrato',
  },
]

for (const factory of factories) {
  test(`contrato CaseStore [${factory.name}]: eventos append-only + round-trip de registros`, async () => {
    const { store, cleanup } = await factory.create()
    try {
      for (const ev of sampleEvents) await store.appendEvent(ev)

      const events = await store.getEventsForCase('case_c1')
      assert.equal(events.length, 2)
      assert.equal(events[0]!.type, 'conversation_started')

      const caseIds = await store.listCaseIds()
      assert.ok(caseIds.includes('case_c1'))

      const patient: PatientRecord = {
        id: 'pat_c1',
        contact_ref: null,
        consent: { given_at: '2026-08-22T09:00:00.000Z', scope: ['perfil_matching'] },
        created_at: '2026-08-22T09:00:00.000Z',
      }
      await store.savePatient(patient)
      assert.deepEqual(await store.getPatient('pat_c1'), patient)
      assert.equal(await store.getPatient('inexistente'), null)
    } finally {
      await cleanup()
    }
  })

  test(`contrato CaseStore [${factory.name}]: reconstructCase (domínio) funciona sem saber qual persistência há por trás`, async () => {
    const { store, cleanup } = await factory.create()
    try {
      for (const ev of sampleEvents) await store.appendEvent(ev)

      const trail = await reconstructCase(store, 'case_c1')
      assert.equal(trail.event_count, 2)
      assert.equal(trail.conversation.started, true)
      assert.equal(trail.conversation.abandoned_at_stage, 'meio')
    } finally {
      await cleanup()
    }
  })
}
