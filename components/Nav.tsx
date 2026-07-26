import Link from 'next/link'
import Image from 'next/image'
import { pages } from '@/lib/pages'

export default function Nav() {
  return (
    <header className="sticky top-0 z-40 flex items-center justify-between border-b border-line/60 bg-paper/90 px-6 py-4 backdrop-blur md:px-10">
      <Link href="/" className="flex items-center gap-2.5 text-[18px] font-extrabold tracking-tight text-ink">
        <Image src="/brand/nexavitta-mark.svg" alt="" width={22} height={22} />
        NexaVitta
      </Link>
      <nav aria-label="Navegação principal" className="hidden gap-5 overflow-x-auto text-[13px] text-ink-soft lg:flex">
        <Link href="/manifesto" className="hover:text-ink">Manifesto</Link>
        <Link href="/quem-somos" className="hover:text-ink">Quem Somos</Link>
        <Link href="/produto" className="hover:text-ink">Produto</Link>
        <Link href="/roadmap" className="hover:text-ink">Roadmap</Link>
      </nav>
      <Link
        href="/manifesto"
        className="rounded-full border border-line px-3.5 py-2 text-xs text-ink"
      >
        Brand Book <span className="ml-1 text-violet">v1.0</span>
      </Link>
    </header>
  )
}
