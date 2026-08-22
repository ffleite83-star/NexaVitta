import { promises as fs } from 'fs'
import path from 'path'
import type { CaseStore } from './types'
import type { CaseEvent } from '../schema/events'
import type { PatientRecord, PatientProfileRecord } from '../schema/patient'
import type { PsychologistRecord } from '../schema/psychologist'

/**
 * Implementação de arquivo local, em JSON. Uso: fixtures, demo, simulação
 * (docs/14). Nunca dado real — ver aviso em lib/matching/store/types.ts.
 *
 * Layout em disco (append-only por caso, para nunca perder evento):
 *   {baseDir}/events/{case_id}.json   -> array de CaseEvent, em ordem
 *   {baseDir}/patients/{id}.json      -> PatientRecord
 *   {baseDir}/patient_profiles/{case_id}.json -> PatientProfileRecord
 *   {baseDir}/psychologists/{id}.json -> PsychologistRecord
 */
export class LocalJsonStore implements CaseStore {
  constructor(private readonly baseDir: string) {}

  private async ensureDir(sub: string) {
    await fs.mkdir(path.join(this.baseDir, sub), { recursive: true })
  }

  private filePath(sub: string, key: string) {
    return path.join(this.baseDir, sub, `${key}.json`)
  }

  private async readJson<T>(filePath: string): Promise<T | null> {
    try {
      const raw = await fs.readFile(filePath, 'utf-8')
      return JSON.parse(raw) as T
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null
      throw err
    }
  }

  private async writeJson(filePath: string, data: unknown) {
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8')
  }

  async appendEvent(event: CaseEvent): Promise<void> {
    await this.ensureDir('events')
    const filePath = this.filePath('events', event.case_id)
    const existing = (await this.readJson<CaseEvent[]>(filePath)) ?? []
    existing.push(event)
    await this.writeJson(filePath, existing)
  }

  async getEventsForCase(caseId: string): Promise<CaseEvent[]> {
    const filePath = this.filePath('events', caseId)
    return (await this.readJson<CaseEvent[]>(filePath)) ?? []
  }

  async listCaseIds(): Promise<string[]> {
    await this.ensureDir('events')
    const files = await fs.readdir(path.join(this.baseDir, 'events'))
    return files.filter((f) => f.endsWith('.json')).map((f) => f.replace(/\.json$/, ''))
  }

  async savePatient(record: PatientRecord): Promise<void> {
    await this.ensureDir('patients')
    await this.writeJson(this.filePath('patients', record.id), record)
  }

  async getPatient(id: string): Promise<PatientRecord | null> {
    return this.readJson<PatientRecord>(this.filePath('patients', id))
  }

  async savePatientProfile(record: PatientProfileRecord): Promise<void> {
    await this.ensureDir('patient_profiles')
    await this.writeJson(this.filePath('patient_profiles', record.case_id), record)
  }

  async getPatientProfile(caseId: string): Promise<PatientProfileRecord | null> {
    return this.readJson<PatientProfileRecord>(this.filePath('patient_profiles', caseId))
  }

  async savePsychologist(record: PsychologistRecord): Promise<void> {
    await this.ensureDir('psychologists')
    await this.writeJson(this.filePath('psychologists', record.id), record)
  }

  async getPsychologist(id: string): Promise<PsychologistRecord | null> {
    return this.readJson<PsychologistRecord>(this.filePath('psychologists', id))
  }

  async listPsychologists(): Promise<PsychologistRecord[]> {
    await this.ensureDir('psychologists')
    const files = await fs.readdir(path.join(this.baseDir, 'psychologists'))
    const records = await Promise.all(
      files
        .filter((f) => f.endsWith('.json'))
        .map((f) => this.readJson<PsychologistRecord>(path.join(this.baseDir, 'psychologists', f)))
    )
    return records.filter((r): r is PsychologistRecord => r != null)
  }
}
