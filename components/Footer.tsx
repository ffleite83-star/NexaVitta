import Link from 'next/link'
import Image from 'next/image'
import { pages } from '@/lib/pages'

const groups: { key: PageGroup; label: string }[] = [
  { key: 'fundacao', label: 'Fundação' },
  { key: 'direcao', label: 'Direção' },
  { key: 'produto', label: 'Produto' },
  { key: 'historico', label: 'Histórico' },
]

type PageGroup = 'fundacao' | 'direcao' | 'produto' | 'historico'

export default function Footer() {
  return (
    <footer className="mx-auto max-w-content px-6 py-16 md:px-10">
      <div className="mb-10 flex items-center gap-2.5 text-[18px] font-extrabold text-ink">
        <Image src="/brand/nexavitta-mark.svg" alt="" width={22} height={22} />
        NexaVitta
      </div>
      <div className="grid grid-cols-2 gap-8 border-t border-line pt-10 text-[13px] md:grid-cols-4">
        {groups.map((g) => (
          <div key={g.key}>
            <p className="mb-3 text-ink-soft">{g.label}</p>
            <ul className="space-y-2">
              {pages
                .filter((p) => p.navGroup === g.key)
                .map((p) => (
                  <li key={p.slug}>
                    <Link href={`/${p.slug}`} className="text-ink hover:text-violet">
                      {p.nav}
                    </Link>
                  </li>
                ))}
            </ul>
          </div>
        ))}
      </div>
      <p className="mt-12 text-xs text-ink-soft">Brand Book v1.0 · Documento vivo, atualizado a cada passo.</p>
    </footer>
  )
}
