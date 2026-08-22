import { writeFileSync, mkdirSync } from 'fs'
import path from 'path'
import { createDemoStore } from '../../lib/matching/store/demo-store'
import { compareCase, computeMetrics, CaseComparison } from '../../lib/shadow/comparison'

/**
 * REVEAL (V0.3): só compara casos que já têm curador E IA registrados.
 * Uso:
 *   npx tsx scripts/shadow/compare.ts             # todos os casos
 *   npx tsx scripts/shadow/compare.ts <case_id>   # um caso
 */
async function main() {
  const store = createDemoStore()
  const target = process.argv[2]
  const caseIds = target ? [target] : await store.listCaseIds()

  const comparisons: CaseComparison[] = []
  for (const caseId of caseIds.sort()) {
    comparisons.push(await compareCase(store, caseId))
  }

  const pending = comparisons.filter((c) => !c.ready)
  const ready = comparisons.filter((c) => c.ready)

  for (const c of pending) {
    console.log(`[pendente] ${c.case_id}: falta ${c.missing.join(', ')} — reveal bloqueado.`)
  }

  for (const c of ready) {
    console.log(`\n=== ${c.case_id} ===`)
    console.log('| Dimensão            | Regra           | Curador         | IA              | IA=Cur |')
    console.log('|---------------------|-----------------|-----------------|-----------------|--------|')
    for (const r of c.rows) {
      const fmt = (x: { value: number | null; bucket: string }) =>
        `${x.value ?? '—'} (${x.bucket})`.padEnd(15)
      console.log(
        `| ${r.dimension.padEnd(19)} | ${fmt(r.regra)} | ${fmt(r.curador)} | ${fmt(r.ia)} | ${r.ia_igual_curador ? 'sim' : 'NÃO'}    |`
      )
    }
    for (const r of c.rows) {
      if (!r.ia_igual_curador) {
        console.log(`  DIVERGÊNCIA em ${r.dimension}:`)
        console.log(`    Curador (${r.curador.value ?? 'null'}): ${r.curador.evidence ?? '(sem evidência)'}`)
        console.log(`    IA      (${r.ia.value ?? 'null'}): ${r.ia.evidence ?? '(sem evidência)'}`)
      }
    }
  }

  if (ready.length > 0) {
    const metrics = computeMetrics(comparisons)
    console.log('\n=== MÉTRICAS DESCRITIVAS ===')
    console.log(JSON.stringify(metrics, null, 2))

    const outDir = path.join(process.cwd(), 'data', 'shadow')
    mkdirSync(outDir, { recursive: true })
    const report = { generated_at: new Date().toISOString(), comparisons: ready, metrics }
    writeFileSync(path.join(outDir, 'comparison_report.json'), JSON.stringify(report, null, 2))
    console.log(`\nRelatório salvo em data/shadow/comparison_report.json`)
  }
}

main()
