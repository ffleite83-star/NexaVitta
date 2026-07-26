# 06 · Design System

Tokens de cor, tipografia e espaçamento vivem em `tailwind.config.ts` — fonte única da verdade, consumida por todos os componentes em `components/`.

| Token | Valor | Uso |
|---|---|---|
| `ink` | `#172838` | Texto principal |
| `ink-soft` | `#365263` | Texto secundário |
| `paper` | `#f6f5ef` | Fundo padrão |
| `sand` | `#e9e6da` | Superfícies alternativas |
| `sage` | `#c0d2a2` | Acento — início |
| `blue` | `#6599a2` | Acento — meio |
| `violet` | `#5967a6` | Acento — continuidade |

Tipografia: Manrope (interface) via `next/font/google`, Playfair Display itálico reservado para ênfase pontual.

Componentes-base: `Nav`, `Footer`, `PageShell`, `Trajectory` (ilustração animada com Framer Motion). Novos componentes visuais devem nascer em `components/` e ser reutilizados, nunca duplicados dentro de páginas.

Detalhe completo do guia de marca em `brand/`.
