export type PageMeta = {
  slug: string
  eyebrow: string
  title: string
  nav: string
  navGroup: 'fundacao' | 'direcao' | 'produto' | 'historico'
}

// Ordem e agrupamento seguem a ESTRUTURA definida no manifesto fundador (doc 01).
export const pages: PageMeta[] = [
  { slug: 'manifesto', eyebrow: '01', title: 'Manifesto', nav: 'Manifesto', navGroup: 'fundacao' },
  { slug: 'quem-somos', eyebrow: '02', title: 'Quem Somos', nav: 'Quem Somos', navGroup: 'fundacao' },
  { slug: 'missao', eyebrow: '03', title: 'Missão', nav: 'Missão', navGroup: 'fundacao' },
  { slug: 'visao', eyebrow: '04', title: 'Visão', nav: 'Visão', navGroup: 'fundacao' },
  { slug: 'valores', eyebrow: '05', title: 'Valores', nav: 'Valores', navGroup: 'fundacao' },
  { slug: 'personalidade', eyebrow: '06', title: 'Personalidade', nav: 'Personalidade', navGroup: 'direcao' },
  { slug: 'voz', eyebrow: '07', title: 'Voz', nav: 'Voz', navGroup: 'direcao' },
  { slug: 'direcao-criativa', eyebrow: '08', title: 'Direção Criativa', nav: 'Direção Criativa', navGroup: 'direcao' },
  { slug: 'sistema-visual', eyebrow: '09', title: 'Sistema Visual', nav: 'Sistema Visual', navGroup: 'direcao' },
  { slug: 'produto', eyebrow: '10', title: 'Produto', nav: 'Produto', navGroup: 'produto' },
  { slug: 'arquitetura', eyebrow: '11', title: 'Arquitetura', nav: 'Arquitetura', navGroup: 'produto' },
  { slug: 'ia', eyebrow: '12', title: 'IA', nav: 'IA', navGroup: 'produto' },
  { slug: 'roadmap', eyebrow: '13', title: 'Roadmap', nav: 'Roadmap', navGroup: 'historico' },
  { slug: 'changelog', eyebrow: '14', title: 'Changelog', nav: 'Changelog', navGroup: 'historico' },
]

export function getPage(slug: string) {
  return pages.find((p) => p.slug === slug)
}
