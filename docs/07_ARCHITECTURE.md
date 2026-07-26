# 07 · Arquitetura

## Stack obrigatória

Next.js (App Router) · React · TypeScript · Tailwind · Framer Motion · MDX. Deploy: Vercel.

## Decisão: por que essa stack (registrada em 2026-07-26)

**Problema:** a primeira versão do Brand Book foi publicada como HTML/CSS estático de página única — rápido para validar tom e conteúdo, mas fora da stack mandada pelo documento fundador e sem caminho natural para crescer em múltiplas páginas, IA e produto.

**Solução escolhida:** migrar para Next.js App Router com conteúdo em MDX por página (`content/*.mdx`), roteamento dinâmico único (`app/[slug]/page.tsx`) e design system em Tailwind.

**Alternativas descartadas:**
- *Manter HTML estático e só adicionar novas páginas `.html`*: duplicaria markup a cada página nova e não atende a stack obrigatória do doc fundador.
- *Framework de conteúdo dedicado (Astro, Docusaurus)*: mais adequado a documentação pura, mas o roadmap prevê rotas dinâmicas de produto (cadastro, IA) que pedem um framework de aplicação, não só de conteúdo.
- *CMS headless externo desde já*: complexidade e custo desnecessários enquanto o time é pequeno e o conteúdo já vive bem versionado em Git.

**Riscos técnicos:** import dinâmico de MDX por slug (`import(`@/content/${slug}.mdx`)`) depende do webpack conseguir montar um contexto estático dos arquivos — validar em cada atualização de versão do Next.js.

**Riscos de produto:** conteúdo de páginas como Produto, Arquitetura e IA descreve intenção, não features implementadas — risco de gerar expectativa além do que existe; mitigado mantendo essas páginas explícitas sobre o que ainda não existe.

**Débitos técnicos:** sem testes automatizados, sem CMS, sem i18n, fontes carregadas via `<link>` do Google Fonts em vez de `next/font/google` (o build local não tinha acesso à rede de fontes do Google no ambiente usado; `next/font` é a opção preferível em produção e deve ser reavaliada) — ver `content/arquitetura.mdx` para a lista viva.

## Estrutura de pastas

```
docs/       → documentação interna (este diretório)
brand/      → guia de marca
content/    → conteúdo MDX das páginas do Brand Book
app/        → rotas Next.js
components/ → componentes de UI reutilizáveis
public/     → assets estáticos (marca, ícones)
```
