# 13 · Arquitetura de Matching — Motor Matemático, IA Shadow, Curadoria Humana, Resultado Real

**Papel assumido:** Head of Product + Product Discovery + Arquiteto de Matching.

**Status:** referência oficial de arquitetura conceitual do matching. Substitui as decisões de UX/score de `docs/12_MATCHING_V1.md` no que for conflitante; o resto de `docs/12` (modelo de dados de paciente/psicólogo, restrição logística, reclassificação da Sprint 2) continua valendo e é a base sobre a qual esta arquitetura é construída. Nenhuma linha de código foi alterada para produzir este documento.

**Nota sobre a fonte:** o PDF `NexaVitta_Modelo_Curadoria_e_AI_Shadow.pdf` não chegou anexado — este documento foi construído a partir da especificação detalhada enviada em texto. Se o PDF tiver conteúdo adicional, revisar este documento depois de recebê-lo.

---

## 0. O que muda em relação ao docs/12

`docs/12` definia três coisas que continuam de pé: o modelo de dados do paciente e do psicólogo (com a correção de tirar `engagement` do score e adicionar restrição logística como filtro), a fórmula de compatibilidade (distância normalizada, pesos iguais), e a decisão de não expor score/ranking numérico ao paciente.

O que essa nova arquitetura adiciona: duas camadas de julgamento rodando em paralelo ao motor matemático — uma IA em modo sombra e um psicólogo curador com autoridade real — mais um "decision trail" que reconstrói qualquer caso ponta a ponta, e um índice objetivo (AI Readiness Index) para decidir quando a IA ganha mais autonomia. O motor matemático deixa de ser "o algoritmo" e passa a ser uma das três hipóteses avaliadas — a mais simples e transparente das três, não a mais autorizada.

## 1. Confronto central antes de detalhar as camadas

O desenho, como descrito, coloca Motor Matemático e IA Shadow em paralelo recebendo o mesmo `perfil estruturado`. Isso faz as duas camadas competirem no mesmo território — comparar uma IA cara contra uma média ponderada de 4 números não ensina muito, porque a matemática já é trivial e transparente por construção. A comparação genuinamente valiosa, especialmente com pouquíssimo volume, não é "IA vs. matemática no score final" — é **IA vs. curador humano na extração do perfil a partir da conversa bruta**. Isso é testável desde o caso #1, não depende de volume, e é exatamente a tarefa que hoje um humano faz manualmente seguindo a rubrica já escrita em `docs/11_PRODUCT_DISCOVERY.md` (seção 10) — e é a tarefa que a IA precisará assumir de verdade mais adiante. Por isso, a IA Shadow desta arquitetura recebe **a conversa bruta**, não só o perfil já estruturado por um humano — e o dado mais importante que ela produz no início é a própria hipótese de perfil, não só a hipótese de compatibilidade.

Segundo confronto: nenhuma dessas camadas precisa de infraestrutura nova para existir desde o caso #1. "IA Shadow" no V0 pode ser, literalmente, uma pessoa da equipe colando a transcrição da conversa num prompt versionado e documentado (Claude ou outro modelo, via chat comum) e registrando a saída numa planilha — sem serviço, sem API, sem código de produto. Isso resolve a exigência de "a IA deve existir desde o primeiro caso" sem violar "não quero uma arquitetura gigantesca". A engenharia de verdade (automatizar essa chamada) só se justifica depois que o volume tornar o processo manual o gargalo — não antes.

## 2. As quatro camadas

### Camada 1 — Motor Matemático

- **Entrada:** perfil estruturado do paciente (dimensões de estilo presentes), perfis `declared_profile` dos psicólogos disponíveis após aplicar o filtro de restrição logística (`docs/12`, seção 4).
- **Processamento:** distância normalizada por dimensão presente, média, conversão em compatibilidade (`docs/12`, seção 6), ordenação interna.
- **Saída:** lista completa de candidatos com score (nunca exibido ao paciente — visível ao curador), decomposição por dimensão ("a maior divergência está em X").
- **Responsabilidade:** produzir uma primeira ordenação transparente, auditável e barata.
- **O que NÃO pode fazer:** decidir sozinho, aparecer como número/autoridade para o paciente, usar `observed_profile` antes do piso de amostra definido em `docs/12`.
- **Dados armazenados:** snapshot do perfil do paciente usado, score de **todos** os candidatos (não só o topo), versão da fórmula/pesos.

### Camada 2 — IA Shadow

- **Entrada:** a conversa bruta (quando existir registro dela) **e** o perfil estruturado — nunca a saída do Motor Matemático. Essa regra é absoluta: a IA Shadow não pode, em nenhum momento, receber o score ou a ordenação da Camada 1 como parte do seu prompt ou contexto. Contaminação cruzada invalidaria qualquer comparação futura entre as duas.
- **Processamento:** um prompt versionado e documentado (texto do prompt vive no repositório, como qualquer outro artefato de arquitetura) que produz duas coisas: (a) uma hipótese própria de perfil estruturado, direto da conversa bruta, comparável ao perfil que um humano extrairia pela mesma rubrica; (b) uma hipótese própria de compatibilidade/ordenação dos psicólogos disponíveis, com uma justificativa textual e uma autoavaliação de confiança (a IA descreve o quão confiante está, não um score calibrado ainda).
- **Saída:** hipótese de perfil, hipótese de ordenação, nota de confiança textual, identificador de versão do modelo e do prompt usados.
- **Responsabilidade:** gerar uma segunda opinião independente e registrada. Nada além disso.
- **O que NÃO pode fazer:** influenciar o que é apresentado ao paciente, ser mostrada ao curador antes de ele registrar o próprio julgamento (seção 5), tomar qualquer decisão, ser tratada como "mais objetiva" só por ser IA.
- **Dados armazenados:** hipótese de perfil da IA, hipótese de ordenação da IA, nota de confiança, versão do modelo+prompt, timestamp.

### Camada 3 — Curadoria Humana por Psicólogo

- **Entrada:** perfil estruturado do paciente, contexto relevante da conversa (sem exigir acesso a conteúdo clínico além do necessário), disponibilidade/restrições dos psicólogos candidatos.
- **Processamento:** ver seção 5 — o curador registra o próprio julgamento **antes** de ver a sugestão da matemática e da IA, para não virar aprovação automática do que a tela mostra.
- **Saída:** decisão final de quem será apresentado/priorizado ao paciente, registro explícito de concordância/discordância com cada uma das outras duas camadas, motivo textual.
- **Responsabilidade:** é a única camada com autoridade real de decisão em toda a arquitetura, do V0 até a IA Readiness Index permitir o contrário (seção 7).
- **O que NÃO pode fazer:** diagnosticar, definir tratamento, ser substituída por CEO, engenharia, PM, PD ou IA — regra explícita e preservada integralmente.
- **Dados armazenados:** julgamento independente do curador (registrado antes do reveal), decisão final, concordância/discordância com matemática e com IA, motivo.

### Camada 4 — Resultado Real

- **Entrada:** comportamento real do paciente e da jornada após o encaminhamento — aceite, rejeição, primeira sessão, continuidade, abandono, troca.
- **Processamento:** nenhum julgamento aqui — só captura fiel, incluindo quem não avançou em cada etapa (seção 3).
- **Saída:** eventos de funil e desfecho, disponíveis para comparar contra as três hipóteses anteriores — inclusive contra o próprio curador, que também pode estar errado.
- **Responsabilidade:** ser a fonte da verdade contra a qual tudo o resto é eventualmente avaliado.
- **O que NÃO pode fazer:** ser estimado ou inferido — é sempre fato registrado, nunca projeção.
- **Dados armazenados:** ver funil completo na seção 3.

## 3. Dataset mínimo — funil completo, não só convertidos

Cada paciente gera uma sequência de eventos, e cada evento é uma linha própria (nunca só um agregado final). Isso captura corretamente quem abandona em qualquer ponto, evitando viés de sobrevivência:

| Evento | O que registra |
|---|---|
| `conversation_started` | timestamp, canal (texto/voz), quem conduziu |
| `conversation_completed` | timestamp, duração, se os dados mínimos (≥2 dimensões) foram capturados |
| `conversation_abandoned` | ponto em que parou, se souber o motivo |
| `profile_extracted_human` | perfil estruturado, quem extraiu, versão da rubrica |
| `profile_extracted_ai_shadow` | perfil estruturado hipotético da IA, versão do modelo/prompt |
| `math_recommendation_generated` | score de todos os candidatos, versão da fórmula |
| `ai_shadow_recommendation_generated` | ordenação hipotética da IA, confiança declarada, versão |
| `curator_independent_judgment` | julgamento do curador antes do reveal (seção 5) |
| `curator_decision` | decisão final, concordância/discordância com cada camada, motivo |
| `recommendation_presented_to_patient` | quais psicólogos foram mostrados, em que ordem/curadoria textual |
| `patient_response` | aceitou o destaque / escolheu outro / rejeitou todos / não respondeu |
| `first_session_scheduled` / `first_session_completed` | datas |
| `session_n_completed` | por sessão: nº, data, check-in de 7 perguntas + pergunta de compatibilidade (`docs/12`, seção 10) |
| `status_changed` | ativo / pausado / encerrado / trocou de profissional, com motivo quando souber (alta terapêutica ≠ abandono ≠ troca) |

Isso cobre explicitamente os casos que você listou: inicia e não completa a conversa, completa mas não recebe recomendação (perfil insuficiente), recebe e discorda, recebe e não converte, converte, faz 1ª sessão, continua, abandona, troca. Nenhum desses estados fica de fora do dataset.

## 4. Decision trail — reconstrução ponta a ponta

Cada caso precisa poder ser reconstruído lendo uma única cadeia de eventos ligados por um `case_id`:

```
case_id
 ├─ patient_profile (snapshot + versão da rubrica de extração)
 ├─ raw_data_reference (referência à conversa bruta, quando existir)
 ├─ math_engine: { candidatos[], scores[], versão da fórmula }
 ├─ ai_shadow: { perfil_hipotético, ordenação_hipotética, confiança, versão modelo+prompt }
 ├─ curator: { julgamento_independente, decisão_final, concordância_com_math, concordância_com_ai, motivo }
 ├─ patient_choice: { aceitou_destaque | escolheu_outro | rejeitou_todos, timestamp }
 └─ outcome: { sessões, status, motivo_encerramento, trocou }
```

Isso não é burocracia — é o que torna possível, mais adiante, perguntar "quando a IA discordou do curador, quem estava mais perto do resultado real?" sem precisar reconstruir nada retroativamente.

## 5. Papel do Psicólogo Curador — fluxo operacional

**Quando é acionado:** depois que a conversa é completada e o perfil mínimo (≥2 dimensões) existe, antes de qualquer recomendação ser mostrada ao paciente.

**O que vê, e em que ordem — isso é o ponto crítico:** primeiro, só o perfil do paciente e a lista de psicólogos disponíveis (após filtro logístico), sem nenhuma sugestão. O curador registra o próprio julgamento nesse momento — quem indicaria e por quê. **Só depois** de registrar esse julgamento independente, ele vê a sugestão do Motor Matemático e da IA Shadow, e então marca concordância ou discordância com cada uma, com motivo. Essa ordem — julgamento próprio antes do reveal — é a única forma barata de evitar que a curadoria vire "aprovar o que a tela mostra": sem isso, o curador tende a ancorar no primeiro número que vê, e a camada humana perde a independência que justifica sua existência.

**O que pode alterar:** concordar com qualquer uma das sugestões, discordar e escolher outro profissional, pedir mais contexto antes de decidir.

**Como a discordância vira dado, não opinião solta:** todo "discordo" exige o motivo em texto curto, categorizado quando possível (ex.: "contexto não capturado pela conversa", "disponibilidade real diferente do cadastro", "julgo o estilo declarado do psicólogo desatualizado") — isso transforma a discordância em algo que pode ser agregado e analisado depois, em vez de ficar preso na memória de uma pessoa.

**Quem assume o papel:** entre os 3-4 psicólogos parceiros iniciais, o mais engajado com o problema e disposto a entender o sistema a fundo — Psicólogo Curador / Líder de Curadoria, papel que só um profissional pode ocupar (nunca CEO, engenharia, PM, PD ou IA), conforme definido.

## 6. AI Readiness Index

Não é a IA que decide que está pronta — é um índice objetivo, revisado por humanos, com critérios definidos antes de qualquer avaliação real. Os thresholds abaixo são **hipóteses iniciais**, não constantes científicas — servem para começar a medir, e devem ser recalibrados assim que houver dado suficiente para questioná-los.

**Dimensões e métricas propostas:**

1. **Volume de casos completos** — nº de casos com decision trail inteiro (perfil, matemática, IA, curador, resultado). *Hipótese de piso: 30-50 casos antes de sair do shadow puro.*
2. **Qualidade da extração de perfil** — o quão perto a hipótese de perfil da IA fica do perfil extraído pelo humano, avaliado por amostragem manual (o curador revisa uma amostra e marca concordância). *Hipótese: ≥70% de concordância "próxima" antes de considerar a IA como substituta da extração manual.*
3. **Taxa de concordância IA-curador na decisão final** — não IA-matemática; o curador é o padrão-ouro provisório até haver resultado real suficiente. *Hipótese: ≥70-80% sustentado por vários casos consecutivos antes de aumentar autonomia.*
4. **Estabilidade/reprodutibilidade** — mesma conversa, mesma versão de prompt, gera perfil e ordenação consistentes ao reprocessar. Testável a qualquer momento, sem depender de volume.
5. **Correlação com resultado real** — só mensurável depois de haver volume de desfechos reais (continuidade, abandono); é a métrica mais importante a longo prazo e a última a ficar disponível.

**Estados de maturidade:**

- **Shadow puro** — IA roda em paralelo, zero autoridade, 100% registrado. Estado inicial, do caso #1.
- **Shadow assistido** — a hipótese da IA passa a ser visível ao curador (depois do reveal, nunca antes do julgamento independente dele), como "segunda opinião" explícita, ainda sem poder de decisão.
- **Produção controlada** — a IA pode gerar a ordenação inicial que o Motor Matemático gerava, mas todo caso ainda passa pelo curador antes de qualquer coisa chegar ao paciente.
- **Produção com autonomia parcial** — a IA decide sozinha apenas nos casos em que sua própria confiança declarada está acima de um limiar (a definir com dado real), com o curador revisando por amostragem, não caso a caso.

**Quem autoriza cada transição:** o Psicólogo Curador Líder junto com o CEO — nunca a IA, nunca só engenharia ou produto isoladamente, dado que envolve julgamento clínico-adjacente.

## 7. Evolução — V0 → V1 → V2 → Data-driven → ML

- **V0 / Shadow (agora):** tudo manual — conversa por humano, extração de perfil por humano, Motor Matemático como fórmula simples (planilha ou script pequeno), IA Shadow como prompt versionado rodado manualmente por uma pessoa, curador decidindo com o fluxo da seção 5. Nenhuma infraestrutura de produto além de uma planilha/registro estruturado único.
- **V1:** automatiza o que já provou valor sem exigir volume — cálculo do Motor Matemático (elimina erro manual de conta), armazenamento estruturado único, painel mínimo de acompanhamento. IA Shadow continua manual se o volume ainda for baixo o suficiente para isso não ser gargalo.
- **V2:** só depois de cruzar os pisos do AI Readiness Index — automatiza a chamada da IA Shadow (deixa de ser copiar-colar), interface de autoatendimento para o paciente escolher, pesos diferenciados por dimensão com base em dado real, uso do `observed_profile` do psicólogo (`docs/12`, seção 5).
- **Data-driven:** volume suficiente (hipótese: algumas centenas de casos com desfecho conhecido) para analisar estatisticamente qual camada (matemática, IA, curador) mais se aproxima do resultado real, por dimensão e por tipo de caso.
- **ML / predictive matching:** só depois de Data-driven mostrar que existe sinal real a aprender — nunca antes disso, para não otimizar ruído.

## 8. Simplicidade preservada — o que fica manual, o que não construímos ainda

Fica manual por enquanto: a conversa de onboarding, a extração de perfil por humano, a autoavaliação do psicólogo, o check-in pós-sessão, a chamada da IA Shadow (copiar-colar num prompt versionado), a curadoria (pode viver numa planilha/documento compartilhado, não precisa de interface própria).

Vale automatizar já, é barato: o cálculo do Motor Matemático e o armazenamento estruturado único — não porque exigem escala, mas porque eliminam erro humano de conta e evitam perda de dado logo na largada.

Não construímos ainda: nenhum serviço de IA em produção, nenhuma interface de paciente para autoatendimento, nenhum pipeline automatizado de extração de perfil por IA, nenhum modelo de ML. Tudo isso espera o AI Readiness Index e o volume real, não a vontade de ter uma arquitetura completa desde o início.

## 9. Decisões para o CEO

1. **Aprovar a mudança de foco do Shadow Mode:** IA Shadow recebe a conversa bruta (não só o perfil já estruturado por humano) e sua comparação mais valiosa no início é contra o curador na extração de perfil, não contra a matemática no score.
2. **Aprovar que a IA Shadow, na V0, seja 100% manual** (prompt versionado rodado por uma pessoa, sem serviço/infraestrutura) até o volume justificar automatizar.
3. **Aprovar o fluxo anti-ancoragem da curadoria:** o curador registra o próprio julgamento antes de ver qualquer sugestão da matemática ou da IA.
4. **Aprovar os thresholds do AI Readiness Index como hipóteses de partida** (30-50 casos para sair do shadow puro, ≥70-80% de concordância IA-curador para ganhar mais autonomia), a recalibrar com dado real.
5. **Aprovar que só o Psicólogo Curador Líder + CEO autorizam transições de maturidade da IA** — nunca engenharia/produto isoladamente, nunca a IA.
6. **Confirmar quem será o Psicólogo Curador / Líder de Curadoria** entre os 3-4 parceiros iniciais — decisão de pessoas, não técnica.
7. **Segue valendo o bloqueio de `docs/12` (seção 15):** validar LGPD/CFP/sigilo/protocolo de risco antes do primeiro paciente real — essa arquitetura não altera nem resolve esse ponto.
