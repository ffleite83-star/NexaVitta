# 09 · Roadmap

**Fase 0 — Fundação (atual).** Brand Book publicado; filosofia, voz e sistema visual documentados e versionados antes de qualquer funcionalidade.

**Fase 1 — Validação de conteúdo.** Testar manifesto e proposta de valor com psicólogos e potenciais usuários; ajustar antes de investir em produto.

**Fase 2 — MVP de jornada.** Jornada única ponta a ponta: acolhimento → clareza → próximo passo sugerido. Sem cadastro obrigatório, sem pagamento.

**Fase 3 — Encontro com profissionais.** Introdução incremental do encontro com psicólogos, mantendo o princípio de "facilitar encontros", não "vender consultas".

Versão publicada: `content/roadmap.mdx`. Atualizações de fase devem vir acompanhadas de entrada em `10_CHANGELOG.md`.

---

## Premissas de lançamento (bloqueantes)

**P1 — Launch Gate de dados reais (atualizado em 2026-08-22, referência canônica: `docs/15_LAUNCH_GATE.md`).** Nenhum dado real de paciente entra no ambiente atual antes de infraestrutura privada apropriada e validada. A escolha específica (repositório privado, Supabase/Postgres, outra) será feita antes do primeiro paciente real — não agora. Fixtures e dados sintéticos seguem no ambiente atual normalmente. Importante: repositório privado protege código, não é solução de proteção de dados de pacientes. Item grave — deve constar em qualquer checklist de lançamento.
