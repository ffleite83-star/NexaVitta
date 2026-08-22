import path from 'path'
import type { CaseStore } from './types'
import { LocalJsonStore } from './local-json-store'

/**
 * Ponto ÚNICO de composição da persistência de desenvolvimento.
 *
 * Hoje: fixtures/demo em JSON local (dado sintético, seguro no repo público).
 * Amanhã (pós Launch Gate — ver docs/15_LAUNCH_GATE.md): trocar o corpo desta
 * função por uma implementação de CaseStore apontando para a infraestrutura
 * privada escolhida. Scripts e domínio não mudam — esse é o contrato.
 *
 * LAUNCH GATE: esta função NUNCA deve retornar um store apontando para dado
 * real enquanto o ambiente for o atual. Dado real exige a infraestrutura
 * privada validada descrita em docs/15_LAUNCH_GATE.md.
 */
export const DEMO_STORE_DIR = path.join(process.cwd(), 'data', 'fixtures', 'store')

export function createDemoStore(): CaseStore {
  return new LocalJsonStore(DEMO_STORE_DIR)
}
