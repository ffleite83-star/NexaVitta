# 17. IA Shadow vs. Psicólogo Curador — V0.3

Status: laboratório implementado, testado, buildado. O experimento real com psicólogo curador ainda **não** aconteceu — ver seção 10 (Limitações), que nesta rodada é a seção mais importante do documento.

## 1. Hipótese

Dada exatamente a mesma conversa bruta de um paciente, a IA consegue produzir uma interpretação estruturada das preferências de acompanhamento suficientemente próxima da interpretação independente de um psicólogo? Não testamos diagnóstico, avaliação clínica, qualidade terapêutica ou competência profissional — exclusivamente interpretação de sinais de preferência de acompanhamento a partir de conversa natural.

## 2. Protocolo

Para cada caso: RAW → três interpretações independentes (Regra Determinística `signal-extractor/v1` como baseline técnico; Psicólogo Curador; IA Shadow com prompt versionado) → reveal → comparação. As três usam o mesmo evento (`profile_extracted`) e o mesmo modelo de perfil existente — nenhum modelo paralelo. A regra é opcional na comparação (baseline ausente não trava o reveal); curador e IA são obrigatórios.

Casos: os 12 sintéticos A–L da V0.2, inalterados (incluindo K, abandonado, que tem RAW parcial — informação insuficiente também é resultado válido).

## 3. Anti-ancoragem — como é garantida

Por construção, não por convenção: `registerInterpretation` não tem parâmetro por onde outra interpretação entraria; o `independence_check` gravado em cada evento só aceita `false` (é um `z.literal(false)` — não existe como registrar "true"); a ferramenta do curador (`open-case-for-curator`) e o pacote da IA (`export-for-ai`) são construídos exclusivamente a partir do `TranscriptRecord` — interpretações, correções do paciente e saídas de matching não têm caminho até eles (testado); o reveal (`compare`) só funciona com curador E IA registrados; e o julgamento inicial é travado: a comparação usa sempre a **primeira** interpretação de cada fonte — registros posteriores ficam no log, mas nunca substituem (testado). A correção do paciente do caso L existe no store e é estruturalmente invisível para a IA (testado com string sentinela).

## 4. Prompt

`prompts/ai-shadow/v0.1.md` (versão `ai-shadow/v0.1`, armazenada em cada resultado): objetivo, definição operacional das 4 dimensões com semântica de escala explícita, proibições de diagnóstico/inferência clínica/invenção, regra de evidência (trecho literal ou nada), regra de incerteza (null é resposta correta; conflito = null com evidência dos dois lados), formato JSON estrito, e instrução de parada em caso de contaminação.

## 5. Dados e ferramentas

Fluxo operacional para o psicólogo real, sem infraestrutura nova: `npx tsx scripts/shadow/open-case-for-curator.ts <case_id>` (mostra SÓ o RAW), preencher JSON no formato de `scripts/shadow/exemplo-interpretacao.json`, `register-interpretation.ts <arquivo>`, e depois de IA também registrada, `compare.ts`. Para a IA externa: `export-for-ai.ts <case_id>` gera o pacote prompt+RAW para copiar/colar. Interpretações desta rodada: `data/shadow/ai-interpretations.v0_1.json` e `data/shadow/curator-interpretations.SIMULADO.json`.

## 6. Decisão de métrica: buckets

Comparação por buckets (`null → sem_leitura`, `1–3 → baixo`, `4 → médio`, `5–7 → alto`), não igualdade exata: exigir 6 === 7 chamaria de discordância duas leituras que dizem a mesma coisa. Valores brutos e evidências ficam preservados lado a lado; diferença numérica nunca é tratada como erro (seção 13 do brief). Essa granulação é discutível e está aberta a revisão quando houver curador real.

## 7. Resultados da rodada demo — LEIA A SEÇÃO 10 ANTES DE USAR ESTES NÚMEROS

Rodada executada sobre os 12 casos com: Regra real, IA real (prompt v0.1 aplicado manualmente por claude-fable-5) e curador **SIMULADO** (placeholder rotulado). Relatório completo: `data/shadow/comparison_report.json`.

Concordância por dimensão (IA×Curador | Regra×Curador | Regra×IA, sobre 12): directiveness 11|12|11 · emotional_intensity 10|10|8 · temporal_focus 9|11|8 · support_challenge 9|9|8. Nulls: Regra 36, Curador-sim 30, IA 23 (de 48 leituras possíveis cada). IA+Curador concordam com Regra divergindo: 5. Regra+IA concordam com Curador divergindo: 1. Todos divergem: 0. Ambos incertos (IA e curador sem leitura): 22. Divergências IA×Curador com evidência lado a lado: 9 — o padrão dominante é a IA atribuindo valor médio com confiança baixa a falas evasivas ("um equilíbrio, talvez", "um pouco de tudo") onde o curador-sim registrou ausência.

## 8. Respostas preliminares às perguntas 1–8 (provisórias por natureza)

**Q1 (a conversa produz informação suficiente?)** Para as duas dimensões-alvo de cada caso, sim; fora delas, a conversa atual gera muitas respostas evasivas — as sondagens de uma linha rendem pouco. **Q2 (a IA identifica?)** Nos casos fáceis por construção, sim — mas ver seção 10. **Q3 (dimensões mais difíceis?)** support_challenge e temporal_focus tiveram as menores concordâncias; directiveness é a mais legível. **Q4 (IA com excesso de certeza?)** Sinal preliminar: sim, na margem — a IA produziu menos nulls (23) que o curador-sim (30) e a maioria das 9 divergências é a IA lendo valor em fala evasiva. É exatamente o padrão que vale vigiar com curador real. **Q5 (curador mais nuançado?)** Não respondível com curador simulado. **Q6 (regra útil como baseline?)** A regra teve 36 nulls e divergiu de IA+Curador em 5 leituras que ambos fizeram — como baseline "barato e cego" ela cumpre papel de contraste, mas não decide nada. Decisão A/B/C (manter/melhorar/abandonar) fica adiada até dados com curador real, como pedido. **Q7 (perguntas que produzem bons sinais?)** As duas abertas carregam quase todo o sinal; as sondagens produzem respostas curtas e evasivas nos fixtures. Suspeita a validar: sondagens precisam de follow-up, não de mais opções. **Q8 (padrões sistemáticos de erro da IA?)** O candidato identificado: converter evasiva em "meio-termo" (4/baixa) em vez de ausência. Registrado para verificação futura.

## 9. Matriz

A matriz caso × dimensão × (Regra, Curador, IA) com valores, buckets, confianças e evidências é gerada por `compare.ts` e persistida no relatório JSON. Divergências são impressas com as duas evidências lado a lado, permitindo a análise "quem está interpretando melhor o mesmo trecho?".

## 10. Limitações — o que estes números NÃO dizem

**O baseline escreveu a prova.** Os casos A–L foram escritos pelo mesmo agente que escreveu o extrator, com vocabulário que casa com o léxico dele. Os casos são artificialmente fáceis e a Regra fica artificialmente boa. **A IA da rodada é o autor dos fixtures.** A aplicação do prompt foi genuína, mas o executor conhece as respostas esperadas — contaminação registrada na proveniência (`interpreter_id: claude-fable-5/manual`) e no cabeçalho do JSON. **O curador é simulado.** Rotulado como `cur_SIMULADO_placeholder` em todos os registros; a coluna existe para validar encanamento e nada mais. Q5 e qualquer conclusão sobre a hipótese central são inrespondíveis até um psicólogo real abrir os casos. **12 casos sintéticos não sustentam estatística** — as métricas são descritivas por decisão explícita. Em resumo: esta rodada valida o **laboratório** (critério de sucesso da seção 19 do brief: comparação limpa, três fontes, mesmo RAW, divergência localizável — sim, conseguimos). Não valida a IA, não valida a regra, não diz nada sobre psicólogos.

## 11. Decisões futuras (nenhuma tomada agora)

Quando houver psicólogo(s) curador(es): substituir o conjunto SIMULADO pelos registros reais (mesmas ferramentas, mesmo formato) e re-rodar `compare.ts`; gerar conversas novas que nenhum componente do sistema escreveu (role-play dos próprios psicólogos é o caminho barato); só então: decisão A/B/C sobre o extrator, revisão do prompt v0.1 → v0.2 com base nos padrões de erro observados, revisão dos buckets, e eventual segunda IA (modelo diferente, sem contaminação de autoria) para separar "capacidade do modelo" de "vazamento do autor". Correção do paciente entra como terceira referência **depois** — nunca antes — da comparação IA×Curador de cada caso.
