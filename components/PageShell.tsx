import { ReactNode } from 'react'

export default function PageShell({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string
  title: string
  children: ReactNode
}) {
  return (
    <article className="mx-auto max-w-[720px] px-6 py-20 md:px-10">
      <p className="mb-4 text-xs font-medium tracking-wide text-sage">{eyebrow} · Brand Book</p>
      <h1 className="mb-10 font-serif text-4xl italic text-ink md:text-5xl">{title}</h1>
      <div>{children}</div>
    </article>
  )
}
