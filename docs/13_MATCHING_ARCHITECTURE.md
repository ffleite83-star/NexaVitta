# 13 · Arquitetura de Matching — Motor Matemático, IA Shadow, Curadoria Humana, Resultado Real

**Papel assumido:** Head of Product + Product Discovery + Arquiteto de Matching.

**Status:** referência oficial de arquitetura conceitual do matching. Substitui as decisões de UX/score de `docs/12_MATCHING_V1.md` no que for conflitante; o resto de `docs/12` (modelo de dados de paciente/psicólogo, restrição logística, reclassificação da Sprint 2) continua valendo e é a base sobre a qual esta arquitetura é construída. Nenhuma linha de código foi alterada para produzir este documento.

**Nota sobre a fonte:** reconciliado com o PDF `NexaVitta_Modelo_Curadoria_e_AI_Shadow.pdf` ("modelo conceitual fechado para a fase de lançamento"), recebido após a primeira versão deste documento. Onde o PDF define algo com mais precisão (dimensões e estados do AI Readiness Index, a experiência "Desafie a IA", os 10 princípios fechados), este documento foi atualizado para segui-lo como fonte primária. Onde ainda discordo de algum ponto, isso fica marcado explicitamente como observação — nunca sobrescrito em silêncio.

**Os 10 princípios fechados no PDF** (citados aqui porque orientam qualquer decisão de implementação): matemática desde o primeiro caso · IA desde o primeiro caso, inicialmente em shadow mode · curadoria humana feita por psicólogo · resultado real é o critério final de aprendizado · dados de não conversão também podem ser valiosos · modelos e prompts devem ser versionados · a IA não diagnostica nem substitui o profissional · o usuário mantém autonomia e pode discordar da recomendação · a coleta e o uso de dados precisam de consentimento e governança adequados · a sofisticação do modelo cresce conforme cresce a evidência.

*Este documento descreve um modelo de produto e operação; não constitui orientação jurídica, regulatória ou clínica (herdado do PDF original, e vale igualmente aqui).*

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

**Exemplo ilustrativo** (formato do PDF de referência — útil para visualizar o que a tabela de casos vai parecer):

| Caso | Matemático | IA | Curador | Resultado |
|---|---|---|---|---|
| 001 | A | B | B | 3 sessões |
| 002 | A | A | A | Abandono |
| 003 | C | B | B | 1 sessão |
| 004 | B | C | B | 7 sessões |

O objetivo nunca é declarar um vencedor por caso isolado — é acumular casos suficientes para enxergar padrões de erro, acerto e complementaridade entre as três hipóteses.

## 5. Papel do Psicólogo Curador — fluxo operacional

**Quando é acionado:** depois que a conversa é completada e o perfil mínimo (≥2 dimensões) existe, antes de qualquer recomendação ser mostrada ao paciente.

**O que vê, e em que ordem — isso é o ponto crítico:** primeiro, só o perfil do paciente e a lista de psicólogos disponíveis (após filtro logístico), sem nenhuma sugestão. O curador registra o próprio julgamento nesse momento — quem indicaria e por quê. **Só depois** de registrar esse julgamento independente, ele vê a sugestão do Motor Matemático e da IA Shadow, e então marca concordância ou discordância com cada uma, com motivo. Essa ordem — julgamento próprio antes do reveal — é a única forma barata de evitar que a curadoria vire "aprovar o que a tela mostra": sem isso, o curador tende a ancorar no primeiro número que vê, e a camada humana perde a independência que justifica sua existência.

**O que pode alterar:** concordar com qualquer uma das sugestões, discordar e escolher outro profissional, pedir mais contexto antes de decidir.

**Como a discordância vira dado, não opinião solta:** todo "discordo" exige o motivo em texto curto, categorizado quando possível (ex.: "contexto não capturado pela conversa", "disponibilidade real diferente do cadastro", "julgo o estilo declarado do psicólogo desatualizado") — isso transforma a discordância em algo que pode ser agregado e analisado depois, em vez de ficar preso na memória de uma pessoa.

**Quem assume o papel:** entre os 3-4 psicólogos parceiros iniciais, o mais engajado com o problema e disposto a entender o sistema a fundo — Psicólogo Curador / Líder de Curadoria, papel que só um profissional pode ocupar (nunca CEO, engenharia, PM, PD ou IA), conforme definido.

## 6. AI Readiness Index

Não é a IA que decide que está pronta — é um índice objetivo, calculado a partir de critérios definidos antes de qualquer avaliação real, nunca por autodeclaração do modelo. As dimensões e estados abaixo seguem o PDF de referência (fechado); os números de threshold continuam sendo **hipóteses iniciais**, não constantes científicas, e devem ser recalibrados assim que houver dado suficiente para questioná-los.

**Dimensões (conforme o PDF, fonte canônica):**

1. **Volume de casos válidos** — nº de casos com decision trail completo. *Hipótese de piso: 30-50 casos antes de sair da observação pura.*
2. **Cobertura de diferentes perfis e situações** — a IA só é avaliável de verdade se viu variedade, não só casos parecidos. *Isso é uma das razões pelas quais a experiência "Desafie a IA" (seção 8) é valiosa mais adiante: ela gera volume de conversas com perfis diversos, mesmo sem conversão em atendimento.*
3. **Qualidade e completude dos dados** — proporção de casos com perfil mínimo (≥2 dimensões) e conversa registrada de forma reconstruível.
4. **Estabilidade das recomendações** — mesma conversa, mesma versão de prompt, gera perfil e ordenação consistentes ao reprocessar.
5. **Concordância/divergência em relação ao motor matemático** — métrica do PDF, mantida.
6. **Evidência de desempenho contra resultados observados** — correlação entre a hipótese da IA e o resultado real (continuidade, abandono); só mensurável depois de haver volume de desfechos.
7. **Consistência entre versões do modelo** — mudanças de versão não podem gerar deriva silenciosa nas recomendações.

**Observação que mantenho (não está no PDF, é minha adição):** concordância com o motor matemático (dimensão 5) é um sinal mais fraco do que concordância com o curador — a matemática é uma fórmula trivial e transparente, e uma IA cara "acertar" uma média ponderada de 4 números prova relativamente pouco. Proponho rastrear como **dimensão adicional, não substituta**: *concordância/divergência em relação à decisão do curador*. Custa zero a mais para medir (o dado já existe no decision trail) e é o sinal que eu mais confiaria para autorizar mais autonomia.

**Estados conceituais (conforme o PDF, fonte canônica):**

```
OBSERVAÇÃO → SHADOW VALIDADO → CANDIDATA A PILOTO → PRODUÇÃO CONTROLADA
```

- **Observação** — a IA roda em paralelo, zero autoridade, tudo registrado. Estado inicial, do caso #1.
- **Shadow Validado** — volume e estabilidade mínimos atingidos; a hipótese da IA já pode ser mostrada ao curador como segunda opinião explícita (sempre depois do julgamento independente dele, seção 5), ainda sem poder de decisão.
- **Candidata a Piloto** — evidência de concordância (com curador e com resultado real, quando já houver) suficiente para propor um piloto controlado, com supervisão obrigatória caso a caso.
- **Produção Controlada** — a IA participa ativamente da recomendação com supervisão humana ainda presente, não autônoma.

A passagem de uma etapa para outra é decisão de governança baseada nesses critérios, nunca em quantidade bruta de usuários — e, como já registrado em `docs/12`, nunca antes de validação jurídica/regulatória (LGPD, CFP, sigilo, protocolo de risco).

**Quem autoriza cada transição:** o Psicólogo Curador Líder junto com o CEO — nunca a IA, nunca só engenharia ou produto isoladamente.

## 7. "Desafie a IA" — experiência pública de lançamento (fase posterior, não V0)

O PDF propõe, para depois que a infraestrutura estiver madura, transformar o próprio mecanismo de aprendizado em uma experiência pública: convidar qualquer pessoa a contar sua história, receber uma hipótese de compatibilidade da IA, e dizer se ela "acertou" — gerando um loop de curiosidade → mais conversas → mais dados → melhor perfilamento → mais pessoas querem testar. Com consentimento adequado, essas interações alimentam o aprendizado mesmo sem conversão em atendimento — e, por gerar volume de perfis diversos, essa experiência é diretamente útil para a dimensão de "cobertura" do AI Readiness Index (seção 6).

Concordo com o conceito, mas com três ressalvas que trato como bloqueantes de sequenciamento, não de mérito:

**1. Não é V0/V1.** O próprio PDF já condiciona a ativação a pipeline de dados, consentimento, segurança, versionamento e governança prontos — reforço isso: essa experiência não deveria ser cogitada antes de a IA sair do estado "Observação" (seção 6), e certamente não antes da validação jurídica/regulatória bloqueante já registrada em `docs/12`.

**2. Pré-requisito de oferta, não só de infraestrutura.** Com 3-4 psicólogos parceiros, uma campanha pública gerando volume de curiosos sem profundidade de oferta real por trás vira só entretenimento — não constrói funil de fato. "Desafie a IA" faz sentido depois de já existir uma base mínima de profissionais capaz de sustentar conversões reais geradas pelo interesse público, não antes.

**3. Tensão de tom com a voz da marca.** O manifesto já registrado (`docs/00_FOUNDATION.md`, `docs/11`) define a voz da NexaVitta como calma, clara e presente — "nunca performática". Um posicionamento como "Você acha que consegue enganar a IA?" carrega uma energia de quiz viral genérico que destoa desse tom, especialmente tratando-se de um produto adjacente a saúde mental. Proponho manter o conceito (contar a própria história, ver se o sistema entendeu) mas suavizar o enquadramento — algo como "Conte sua história. Veja se a NexaVitta entendeu" em vez de linguagem de "enganar" — antes de qualquer copy final.

**Segmentação de dado, adição minha:** toda interação vinda dessa experiência pública deve ser marcada com uma proveniência distinta (`source: desafio_publico`, diferente de `paciente_real`) e nunca misturada nas métricas que dependem de resultado clínico real (concordância com curador em casos reais, correlação com continuidade) — quem está testando por curiosidade não é um paciente, e tratar os dois like o mesmo tipo de evento contaminaria exatamente as métricas que o AI Readiness Index precisa ter limpas.

## 8. Evolução — V0 → V1 → V2 → Data-driven → ML

- **V0 / Shadow (agora):** tudo manual — conversa por humano, extração de perfil por humano, Motor Matemático como fórmula simples (planilha ou script pequeno), IA Shadow como prompt versionado rodado manualmente por uma pessoa, curador decidindo com o fluxo da seção 5. Nenhuma infraestrutura de produto além de uma planilha/registro estruturado único.
- **V1:** automatiza o que já provou valor sem exigir volume — cálculo do Motor Matemático (elimina erro manual de conta), armazenamento estruturado único, painel mínimo de acompanhamento. IA Shadow continua manual se o volume ainda for baixo o suficiente para isso não ser gargalo.
- **V2:** só depois de cruzar os pisos do AI Readiness Index — automatiza a chamada da IA Shadow (deixa de ser copiar-colar), interface de autoatendimento para o paciente escolher, pesos diferenciados por dimensão com base em dado real, uso do `observed_profile` do psicólogo (`docs/12`, seção 5).
- **Data-driven:** volume suficiente (hipótese: algumas centenas de casos com desfecho conhecido) para analisar estatisticamente qual camada (matemática, IA, curador) mais se aproxima do resultado real, por dimensão e por tipo de caso. É também o momento mais provável para ativar "Desafie a IA" (seção 7) — depois de já haver base de psicólogos e maturidade de governança suficientes para a campanha gerar funil real, não só entretenimento.
- **ML / predictive matching:** só depois de Data-driven mostrar que existe sinal real a aprender — nunca antes disso, para não otimizar ruído.

## 9. Simplicidade preservada — o que fica manual, o que não construímos ainda

Fica manual por enquanto: a conversa de onboarding, a extração de perfil por humano, a autoavaliação do psicólogo, o check-in pós-sessão, a chamada da IA Shadow (copiar-colar num prompt versionado), a curadoria (pode viver numa planilha/documento compartilhado, não precisa de interface própria).

Vale automatizar já, é barato: o cálculo do Motor Matemático e o armazenamento estruturado único — não porque exigem escala, mas porque eliminam erro humano de conta e evitam perda de dado logo na largada.

Não construímos ainda: nenhum serviço de IA em produção, nenhuma interface de paciente para autoatendimento, nenhum pipeline automatizado de extração de perfil por IA, nenhum modelo de ML. Tudo isso espera o AI Readiness Index e o volume real, não a vontade de ter uma arquitetura completa desde o início.

## 10. Decisões para o CEO

1. **Aprovar a mudança de foco do Shadow Mode:** IA Shadow recebe a conversa bruta (não só o perfil já estruturado por humano) e sua comparação mais valiosa no início é contra o curador na extração de perfil, não contra a matemática no score.
2. **Aprovar que a IA Shadow, na V0, seja 100% manual** (prompt versionado rodado por uma pessoa, sem serviço/infraestrutura) até o volume justificar automatizar.
3. **Aprovar o fluxo anti-ancoragem da curadoria:** o curador registra o próprio julgamento antes de ver qualquer sugestão da matemática ou da IA.
4. **Aprovar os thresholds do AI Readiness Index como hipóteses de partida** (30-50 casos para sair do estado "Observação"), e **aprovar a adição da métrica "concordância com o curador"** (minha proposta, além das 7 dimensões do PDF) como o sinal mais confiável para autorizar mais autonomia — a recalibrar com dado real.
5. **Aprovar que só o Psicólogo Curador Líder + CEO autorizam transições de maturidade da IA** — nunca engenharia/produto isoladamente, nunca a IA.
6. **Confirmar quem será o Psicólogo Curador / Líder de Curadoria** entre os 3-4 parceiros iniciais — decisão de pessoas, não técnica.
7. **Segue valendo o bloqueio de `docs/12` (seção 15):** validar LGPD/CFP/sigilo/protocolo de risco antes do primeiro paciente real — essa arquitetura não altera nem resolve esse ponto.
8. **Aprovar que "Desafie a IA" (seção 7) fique fora do escopo de V0/V1**, condicionada a: IA fora do estado "Observação", validação jurídica/regulatória concluída, e base de psicólogos suficiente para sustentar conversão real.
9. **Aprovar o ajuste de tom proposto para "Desafie a IA"** — substituir o enquadramento de "enganar a IA" por algo alinhado à voz calma da marca antes de qualquer copy final ir ao ar.
