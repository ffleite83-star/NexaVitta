import { notFound } from 'next/navigation'
import { pages, getPage } from '@/lib/pages'
import PageShell from '@/components/PageShell'

export function generateStaticParams() {
  return pages.map((p) => ({ slug: p.slug }))
}

export function generateMetadata({ params }: { params: { slug: string } }) {
  const meta = getPage(params.slug)
  return { title: meta ? `${meta.title} — NexaVitta` : 'NexaVitta' }
}

export default async function Page({ params }: { params: { slug: string } }) {
  const meta = getPage(params.slug)
  if (!meta) notFound()

  let Content
  try {
    Content = (await import(`@/content/${params.slug}.mdx`)).default
  } catch {
    notFound()
  }

  return (
    <PageShell eyebrow={`${meta!.eyebrow} · Fundação`} title={meta!.title}>
      <Content />
    </PageShell>
  )
}
