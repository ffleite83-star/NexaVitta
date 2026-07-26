import type { MDXComponents } from 'mdx/types'

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    h2: (props) => <h2 className="mt-12 mb-4 text-2xl font-semibold text-ink first:mt-0" {...props} />,
    h3: (props) => <h3 className="mt-8 mb-3 text-lg font-semibold text-ink" {...props} />,
    p: (props) => <p className="mb-5 text-[15px] leading-relaxed text-ink-soft" {...props} />,
    ul: (props) => <ul className="mb-5 ml-5 list-disc space-y-2 text-[15px] text-ink-soft" {...props} />,
    li: (props) => <li {...props} />,
    strong: (props) => <strong className="font-semibold text-ink" {...props} />,
    em: (props) => <em className="font-serif italic text-ink" {...props} />,
    blockquote: (props) => (
      <blockquote className="my-8 border-l-2 border-sage pl-6 font-serif text-xl italic text-ink" {...props} />
    ),
    ...components,
  }
}
