import Link from 'next/link'
import Trajectory from '@/components/Trajectory'

const pillars = [
  {
    n: '01',
    title: 'Humanos antes de tudo',
    body: 'A tecnologia reduz barreiras. Pessoas continuam no centro de cada decisão.',
  },
  {
    n: '02',
    title: 'Ciência com humildade',
    body: 'Dados e evidências orientam; nunca substituem a escuta clínica ou a autonomia de alguém.',
  },
  {
    n: '03',
    title: 'Confiança para começar',
    body: 'Transformamos dúvida em clareza e insegurança em um primeiro passo possível.',
  },
]

export default function Home() {
  return (
    <main>
      <section className="mx-auto grid max-w-content items-center gap-14 px-6 py-20 md:grid-cols-2 md:px-10 md:py-28">
        <div>
          <p className="mb-4 text-xs font-medium tracking-wide text-ink-soft">Brand Book · Documento fundador</p>
          <h1 className="mb-6 text-4xl font-extrabold leading-tight text-ink md:text-5xl">
            Caminhamos com você até o <em className="font-serif italic text-violet">próximo passo.</em>
          </h1>
          <p className="mb-8 max-w-[440px] text-lg leading-relaxed text-ink-soft">
            A NexaVitta torna o início do cuidado em saúde mental mais humano, claro e menos solitário.
          </p>
          <Link
            href="/manifesto"
            className="inline-flex items-center gap-3 rounded-lg bg-ink px-5 py-3.5 text-sm font-bold text-white"
          >
            Conheça a nossa história <span aria-hidden="true">↓</span>
          </Link>
        </div>
        <Trajectory />
      </section>

      <section className="border-t border-line bg-ink px-6 py-20 text-paper md:px-10">
        <div className="mx-auto max-w-content">
          <p className="mb-4 text-xs font-medium tracking-wide text-sage">Fundação</p>
          <div className="grid gap-8 md:grid-cols-2">
            <h2 className="text-2xl font-semibold md:text-3xl">
              Toda grande empresa nasce de uma ideia.{' '}
              <em className="font-serif italic">A NexaVitta nasceu de uma pergunta.</em>
            </h2>
            <div className="space-y-4 text-[15px] leading-relaxed text-paper/80">
              <p>Como podemos fazer com que alguém não enfrente sozinho o momento de pedir ajuda?</p>
              <p>
                Não criamos a caminhada. Criamos uma maneira mais humana de começar e encontrar quem pode
                seguir ao lado.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-content px-6 py-20 md:px-10">
        <p className="mb-4 text-xs font-medium tracking-wide text-sage">Quem somos</p>
        <h2 className="mb-10 text-2xl font-semibold text-ink md:text-3xl">
          Uma empresa de <em className="font-serif italic">escuta.</em>
        </h2>
        <div className="grid gap-8 border-t border-line pt-10 md:grid-cols-3">
          {pillars.map((p, i) => (
            <article key={p.n} className={i > 0 ? 'border-line md:border-l md:pl-8' : ''}>
              <span className="text-xs text-ink-soft">{p.n}</span>
              <h3 className="mb-2 mt-2 text-lg font-semibold text-ink">{p.title}</h3>
              <p className="text-sm text-ink-soft">{p.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-content border-t border-line px-6 py-20 md:px-10">
        <blockquote className="max-w-[640px] font-serif text-2xl italic text-ink md:text-3xl">
          Não prometemos mudar a sua vida.
          <br />
          Prometemos caminhar com você até o próximo passo.
        </blockquote>
      </section>
    </main>
  )
}
