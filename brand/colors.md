# Cor

| Token | Hex | Papel |
|---|---|---|
| `ink` | `#172838` | Texto principal, fundos de destaque |
| `ink-soft` | `#365263` | Texto secundário |
| `paper` | `#f6f5ef` | Fundo padrão |
| `sand` | `#e9e6da` | Superfícies alternativas |
| `sage` | `#c0d2a2` | Acento — início da jornada |
| `blue` | `#6599a2` | Acento — meio da jornada |
| `violet` | `#5967a6` | Acento — continuidade |
| `line` | `rgba(23,40,56,.14)` | Divisores e bordas |

Uso: sage → blue → violet formam o gradiente da trajetória (ver `motion.md`) e representam a progressão começar → conhecer → continuar. Nunca usar essas três cores fora dessa lógica de progressão.

Contraste: `ink` sobre `paper` é a combinação padrão de leitura; `paper` sobre `ink` é reservada para seções de destaque (ex.: bloco "Fundação" da home).

Fonte da verdade técnica: `tailwind.config.ts`.
