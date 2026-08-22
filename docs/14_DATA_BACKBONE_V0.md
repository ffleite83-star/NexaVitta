# 14. Data Backbone V0 — Implementação

Status: implementado, testado, buildado. Código em `lib/matching/` e `scripts/matching/`, dado sintético em `data/fixtures/store/`.

Este documento registra o que foi construído nesta rodada, exatamente conforme o pedido "V0: Data Backbone + IA Shadow + Marketplace", e — igualmente importante — o que foi deliberadamente deixado de fora.

## 0. Resumo executivo

O objetivo da rodada era um só: nenhum dado relevante do primeiro usuário real pode se perder. Não construímos ranking sofisticado, não construímos ML, não automatizamos a IA em produção. Construímos a espinha dorsal de dados: schemas versionados, um motor matemático determinístico e explicável, um fluxo estruturado de anti-ancoragem para o curador, registro manual da IA Shadow sem contaminação, um log de eventos append-only, reconstrução completa de caso, e a capacidade (só dado, sem UX) do lado psicólogo do marketplace.

Critério de conclusão da rodada, verificado: simulei um caso de paciente de ponta a ponta (conversa → transcrição → curador → IA shadow → matemática → comparação → decisão → registro → resultado simulado) e um caso do lado psicólogo (perfil → elegibilidade → compatibilidade com perfis de paciente → registro). Os dois casos são reconstruíveis por completo a partir do log de eventos. Ver seção 4.

## 1. O que foi construído

**Schemas e versionamento** (`lib/matching/schema/`, `lib/matching/versions.ts`)
`common.ts` define proveniência de dado (`ProfileSource`), o valor de dimensão versionado (`DimensionValue`), as 4 dimensões de estilo (`StyleProfile`: directiveness, emotional_intensity, temporal_focus, support_challenge — `engagement_expectation` fica fora de propósito, é contextual) e as restrições logísticas (`Constraints`: modalidade, faixa de preço, janelas de disponibilidade). `patient.ts` e `psychologist.ts` modelam os dois lados do marketplace, com identidade/consentimento separados de perfil comportamental (minimização de dado) e a distinção `declared_profile` vs. `observed_profile` do lado psicólogo. `events.ts` define o log de eventos do caso como união discriminada zod — 12 tipos de evento, de `conversation_started` a `status_changed`. `versions.ts` centraliza as constantes de versão que toda saída relevante carrega.

**Motor Matemático** (`lib/matching/engine/math-engine.ts`)
Determinístico, sem ML. `checkLogisticFit` é o núcleo do filtro duro (status, modalidade, faixa de preço, disponibilidade) — reutilizado nos dois sentidos do marketplace. `applyHardFilters` exclui psicólogos logisticamente incompatíveis antes de qualquer cálculo de estilo. `computeStyleScore` calcula distância L1 normalizada só nas dimensões preenchidas em ambos os lados, convertendo em compatibilidade (`1 - distância/distância_máxima`). `effectivePsychologistStyle` decide se usa perfil declarado ou observado, conforme o piso de amostra. Empate de compatibilidade é resolvido por `active_patient_count` crescente (balanceamento de carga) — nunca por critério de estilo escondido. `styleFloorWarning` avisa quando o perfil do paciente tem menos de 2/4 dimensões preenchidas.

**Anti-ancoragem + IA Shadow manual** (`lib/matching/curation/anti-anchoring.ts`)
A ordem é imposta pela assinatura das funções, não por convenção verbal. `recordCuratorIndependentJudgment` e `recordAIShadowHypothesis` não têm parâmetro por onde resultado de matemática, do outro registro, escolha do paciente ou resultado entrariam — a lista de não-contaminação (`contamination_check`) é sempre `false` estruturalmente. Só depois de ter os dois registros independentes em mãos é possível chamar `revealAndDecide`, o único ponto do sistema que já viu tudo e produz a decisão final do curador, com concordância/divergência calculada automaticamente contra matemática e IA.

**Store local + reconstrução de caso** (`lib/matching/store/`, `lib/matching/reconstruction/`)
`CaseStore` é uma interface; `LocalJsonStore` é a implementação em arquivo, append-only por caso (nunca perde um evento, mesmo de caso abandonado). `reconstructCase` varre o log cronologicamente e responde à pergunta "o que aconteceu neste caso, do início ao fim" sem precisar de UX nenhuma — é a prova de que a trilha de decisão existe.

**Marketplace reverso** (`lib/matching/engine/reverse-compatibility.ts`)
`findCompatiblePatientsForPsychologist` aplica exatamente a mesma regra de filtro duro e a mesma fórmula de distância de estilo, só invertendo quem é o sujeito da pergunta. Só dado — nenhuma UX, nenhuma promessa de volume de pacientes ao profissional.

**Testes** (`lib/matching/__tests__/`, `npm run test:matching`)
15 testes com `node:test` via `tsx`, cobrindo: filtro duro isolado de estilo, fórmula de compatibilidade, piso mínimo de dimensões, desempate por carga, garantias estruturais de não-contaminação e de "curador não viu matemática/IA", round-trip do store, caso abandonado não desaparece, reconstrução completa de trilha de decisão, e simetria entre o sentido paciente→psicólogo e psicólogo→paciente. Todos passam.

**Scripts de simulação** (`scripts/matching/`) — ver seção 3.

## 2. O que foi deliberadamente não construído

Conforme a lista de exclusões do pedido original: nenhum ranking sofisticado além de filtro+distância+desempate por carga; nenhum modelo preditivo; nenhuma IA decidindo em produção (a IA Shadow é 100% manual em V0 — um humano aplica um prompt versionado e digita o resultado); nenhum dashboard; nenhuma automação de aquisição de psicólogo; nenhuma UX final de marketplace (os dois lados só existem como dado e função, não como tela); nenhuma infraestrutura além de arquivo JSON local. Isso é intencional, não corte de canto: qualquer coisa dessa lista que eu tivesse construído agora seria trabalho descartável antes de sabermos se o V0 sequer funciona com gente real.

## 3. Como simular o primeiro caso

```
cd NexaVitta
npm install
npx tsx scripts/matching/simulate-patient-case.ts
npx tsx scripts/matching/simulate-psychologist-compatibility.ts
npm run test:matching
```

`simulate-patient-case.ts` roda dois casos: `case_demo_convertido` (jornada completa — conversa, perfil extraído pelo curador, julgamento independente do curador, hipótese da IA Shadow, cálculo do motor matemático, reveal e decisão final, apresentação ao paciente, resposta, sessão, status) e `case_demo_abandonado` (conversa que para no meio — prova de que um não-convertido fica registrado, não some do dataset). Ao final, imprime a reconstrução completa de trilha de decisão de cada caso via `reconstructCase`.

`simulate-psychologist-compatibility.ts` roda o lado psicólogo: 3 psicólogos sintéticos (`psy_ana`, `psy_bruno`, `psy_carla`, com ofertas logísticas e perfis de estilo diferentes, em `scripts/matching/seed-psychologists.ts`) contra 3 perfis de paciente sintéticos, mostrando elegibilidade, exclusão e ranking de compatibilidade em ambas as direções.

## 4. Onde os dados estão armazenados

Dado sintético (fixtures/demo, gerado pelos scripts acima): `data/fixtures/store/`, dentro do próprio repositório — seguro porque não é dado real, e o repositório é público.

Dado real de paciente ou psicólogo: **ainda não tem lugar definido.** Essa é a pergunta pendente levantada na task #18 e que segue sem resposta sua. O código não bloqueia por isso — `CaseStore` é uma interface, `LocalJsonStore` é uma implementação entre outras possíveis — mas a decisão real precisa ser tomada antes do primeiro caso de verdade, não depois. As opções continuam as mesmas: repositório privado separado (mais simples, mas ainda arquivo, sem concorrência real) ou banco gerenciado tipo Supabase/Neon/Vercel Postgres (mais trabalho de setup agora, mas não vira dívida técnica depois). Repito o pedido de decisão porque agora há código rodando em cima dela.

## 5. Confronto — pontos que quero deixar registrados, não só o que foi pedido

**A não-contaminação da IA Shadow é estrutural no código, não à prova de humano.** `recordAIShadowHypothesis` não aceita matemática nem julgamento do curador como parâmetro — isso é real. Mas em V0 a IA Shadow é manual: uma pessoa roda o prompt em outra ferramenta e digita o resultado nessa função. Nada impede, na prática, que essa pessoa já tenha visto o resultado do motor matemático numa aba ao lado. A garantia que o código dá é "a função não passa esse dado adiante"; a garantia que falta é processo — quem roda a IA Shadow precisa ser instruído a fazer isso antes de qualquer outra etapa do caso ser aberta na tela, ou por outra pessoa. Isso é operação, não código, mas se não virar uma regra explícita de processo, a proteção estrutural do software é decorativa.

**Com 3-4 psicólogos reais, o desempate por carga (`active_patient_count`) vai decidir mais casos do que a distância de estilo.** A escala é 1-7 inteiro em 4 dimensões — com poucos psicólogos e perfis de estilo relativamente distintos entre si (por desenho, pra cobrir mais do espaço), empates exatos são raros, mas *quase-empates* não. Na prática, com pool tão pequeno, o balanceamento de carga tende a virar o critério que mais movimenta a decisão, não um desempate marginal. Não é um bug — é uma consequência inevitável de operar com poucos profissionais — mas se isso não for dito abertamente, alguém vai achar que o "motor matemático" está escolhendo por estilo quando na verdade está escolhendo por quem está mais livre.

**O piso de amostra de 10 sessões para o perfil observado do psicólogo (`OBSERVED_PROFILE_MIN_SAMPLE_SIZE`) pode nunca ser alcançado no horizonte de V0/V1 com 3-4 psicólogos.** Se cada um atender poucos pacientes por mês, "10 sessões com o mesmo psicólogo" é uma barra alta cedo. Vale decidir, quando o volume real aparecer, se esse piso deve cair (ex.: 5) só nesta fase inicial — registrado aqui pra não ser esquecido, não mudado agora sem dado real na frente.

**`LocalJsonStore` assume um único escritor por caso.** Ler-modificar-escrever um arquivo JSON por `case_id` é seguro para simulação e para operação manual (um curador de cada vez), mas não sobrevive a duas escritas concorrentes no mesmo caso. Não é problema hoje — é a razão pela qual `CaseStore` existe como interface. Registro aqui só para não virar surpresa quando o volume justificar trocar a implementação.

## 6. Decisões que precisam do CEO

1. Onde o primeiro dado real de paciente/psicólogo vai morar — repositório privado ou banco gerenciado (seção 4). Bloqueante para o primeiro caso de verdade, não para o código.
2. Se topa formalizar, como regra de processo (não de código), que quem roda a IA Shadow manual em V0 faça isso antes de ver qualquer outra saída do caso — ou que seja sempre uma pessoa diferente do curador (seção 5).
3. Se o piso de 10 sessões para perfil observado do psicólogo deve começar mais baixo dado o tamanho do pool inicial (seção 5) — decisão que pode esperar até termos volume real, mas que vale já estar no radar.

## 7. Próximos passos possíveis (não iniciados)

Fora de escopo desta rodada, na ordem em que fariam sentido depois que o backbone rodar com gente real: instrumentar a IA Shadow como chamada de API versionada (ainda sem autoridade de decisão) em vez de manual; UX mínima para o curador registrar julgamento/decisão sem editar JSON; UX mínima de apresentação ao paciente; primeira leitura do AI Readiness Index com dado real. Nenhum desses deve começar antes de termos ao menos alguns casos reais passando pelo fluxo atual.
