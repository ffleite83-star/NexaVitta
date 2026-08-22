import type { CaseEvent } from '../schema/events'
import type { TranscriptRecord } from '../schema/transcript'
import type { PatientRecord, PatientProfileRecord } from '../schema/patient'
import type { PsychologistRecord } from '../schema/psychologist'

/**
 * Abstração de armazenamento (pedido original, seção 6 e observação levantada
 * na task #18): o repositório GitHub do NexaVitta é PÚBLICO. Nenhum dado real
 * de paciente ou psicólogo pode morar nele. `LocalJsonStore` é seguro para
 * fixtures/demo (dado sintético) e para rodar localmente, mas a decisão de
 * ONDE o primeiro caso real mora (repo privado separado vs. banco gerenciado)
 * segue pendente — ver docs/14_DATA_BACKBONE_V0.md. Esta interface existe
 * exatamente para que essa decisão não trave o trabalho de agora: trocar de
 * implementação depois é escrever uma nova classe, não reescrever o sistema.
 */
export interface CaseStore {
  appendEvent(event: CaseEvent): Promise<void>
  saveTranscript(record: TranscriptRecord): Promise<void>
  getTranscript(caseId: string): Promise<TranscriptRecord | null>
  getEventsForCase(caseId: string): Promise<CaseEvent[]>
  listCaseIds(): Promise<string[]>

  savePatient(record: PatientRecord): Promise<void>
  getPatient(id: string): Promise<PatientRecord | null>

  savePatientProfile(record: PatientProfileRecord): Promise<void>
  getPatientProfile(caseId: string): Promise<PatientProfileRecord | null>

  savePsychologist(record: PsychologistRecord): Promise<void>
  getPsychologist(id: string): Promise<PsychologistRecord | null>
  listPsychologists(): Promise<PsychologistRecord[]>
}
