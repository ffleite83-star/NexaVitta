# 12 · Matching V1 — proposta técnica e de produto

**Papel assumido:** Head of Product + Product Discovery + Arquiteto do sistema de Matching.

**Regra desta entrega:** nenhuma linha de código. Esta é a proposta de arquitetura para aprovação antes da implementação.

> **Atualização:** este documento segue valendo para o modelo de dados (paciente/psicólogo), a fórmula de compatibilidade e a decisão de não expor score ao paciente. A partir da arquitetura de 4 camadas (Motor Matemático, IA Shadow, Curadoria Humana, Resultado Real), a referência oficial é `docs/13_MATCHING_ARCHITECTURE.md`.

---

## 1. Diagnóstico do estado atual

Site publicado em `nexa-vitta.vercel.app`, Next.js/TS/Tailwind/Framer Motion/MDX, com o Brand Book completo (14 páginas de fundação) e a documentação interna `docs/00` a `11`. Zero código de produto existe — nenhuma linha de matching, cadastro ou banco de dados. Zero psicólogos e zero pacientes reais estão na plataforma ainda.

A Sprint 2 (`docs/11_PRODUCT_DISCOVERY.md`) produziu, mas **não executou**: as 4 dimensões de preferência (C-NIP), um desenho de piloto controlado com 20-30 pares em dois grupos (formulário vs. conversa guiada por Entrevista Motivacional), formulários prontos e uma planilha operacional. Nada disso rodou com gente real ainda.

## 2. Mudança de estratégia

Concordo com a mudança, e vou além: com N real esperado de 3-4 psicólogos e provavelmente menos de 10-15 pacientes nos primeiros meses, o desenho controlado de 20-30 pares em dois grupos não é só impraticável — é estatisticamente vazio. Qualquer "resultado" de comparação formulário-vs-conversa com esse volume seria ruído lido como sinal. Insistir nesse desenho não é rigor científico, é teatro de dados. Abandonar o experimento controlado e ir para produção real desde o par #1 é a decisão certa.

Uma coisa eu preservaria do desenho antigo, sem custo: manter, em todo registro, a proveniência do dado (se o perfil veio de formulário, de conversa guiada por humano, ou futuramente de IA). Isso não é reviver o experimento — é só not jogar fora um metadado que não custa nada guardar hoje e que vira análise retrospectiva de graça quando (e se) houver volume.

## 3. Princípios do Matching V1

- Simplicidade explicável antes de sofisticação. Qualquer score deve ser decomponível em "por causa de X e Y", nunca opaco.
- O objetivo do V1 não é prever bem — é gerar dado limpo e reutilizável desde o primeiro atendimento.
- Pesos iguais hoje, pesos aprendíveis depois: sem evidência para diferenciar peso entre dimensões, não inventamos diferenciação.
- Humano no loop nas decisões: com 3-4 psicólogos, qualquer decisão de baixa confiança é trivialmente revisável por uma pessoa.
- Matching é sobre compatibilidade de estilo declarada, nunca sobre resultado clínico.

**Sobre o funil proposto (seção 4 do seu documento):** o desenho está correto como visão de longo prazo, mas é grande demais pra fase atual — "ranking" de 3-4 opções e "apresentação de opções" não precisam de UI sofisticada no dia 1. Guardo o funil como norte de arquitetura, mas o V1 implementa uma fração pequena dele (ver seção 13).

## 4. Modelo de dados do paciente

A estrutura proposta por você está quase certa, mas tem um problema estrutural: ela representa só **estilo psicológico**, e falta uma camada de **restrições logísticas** (disponibilidade, faixa de preço, modalidade). Com 3-4 psicólogos, se o melhor match de estilo não tem horário livre ou está fora da faixa de preço do paciente, apresentar essa pessoa como topo do ranking é enganoso e inútil na prática. Proponho que restrição logística seja um **filtro obrigatório aplicado antes** do cálculo de compatibilidade de estilo — nunca misturado no mesmo score.

Segundo ponto: `engagement` (envolvimento esperado) não tem contraparte simétrica no lado do psicólogo — não é um eixo relacional de estilo, é uma autoexpectativa do paciente sobre o próprio comportamento. Proponho **tirá-lo da fórmula de compatibilidade** e guardá-lo como dado contextual, útil para outra coisa no futuro (ex.: sinal de risco de baixa adesão), não para calcular "quão parecido" paciente e psicólogo são.

```
patient_profile = {
  # eixos de estilo — usados no cálculo de compatibilidade
  directiveness:       1-7 | null,
  emotional_intensity: 1-7 | null,
  temporal_focus:      1-7 | null,   # 1 = presente, 7 = passado
  support_challenge:   1-7 | null,   # 1 = desafio, 7 = suporte

  # contextual — armazenado, não usado no score de compatibilidade no V1
  engagement_expectation: 1-7 | null,

  # restrição logística — filtro obrigatório, não é "estilo"
  constraints: {
    availability: [...],   # janelas de horário compatíveis
    price_band:   enum | null,
    modality:     "video" | "audio" | "texto" | null,
  },

  # proveniência — herdado da Sprint 2, mantido de graça
  source: "formulario" | "conversa_humana" | "conversa_ia" (futuro),
  collected_at: timestamp,
}
```

**Obrigatório vs. opcional:** nada é estritamente obrigatório no momento da captura — numa conversa real, nem sempre os 4 eixos emergem. Regra: só exibimos compatibilidade de estilo se **pelo menos 2 dos 4 eixos** estiverem preenchidos; abaixo disso, mostramos todos os psicólogos disponíveis (após filtro logístico) sem ranking de estilo, com uma nota explícita de que o perfil ainda está incompleto.

**Escala:** mantém 1-7, consistente com o C-NIP já adotado na Sprint 2 — granularidade suficiente sem precisão falsa.

**Dado faltante na fórmula:** dimensão ausente é excluída do cálculo (não recebe valor neutro 4 — isso criaria falsa precisão). A distância é a média apenas sobre as dimensões presentes nos dois perfis.

**De conversa livre para variável estruturada (futuro):** a rubrica "o que observar" já escrita em `docs/11_PRODUCT_DISCOVERY.md` (seção 10) **é** a especificação da futura extração automática — hoje um humano aplica essa rubrica manualmente durante a conversa; amanhã um modelo de linguagem aplica a mesma rubrica sobre a transcrição. Não precisamos reinventar isso quando chegar a hora, só automatizar o que já está escrito.

## 5. Modelo de dados do psicólogo

A distinção declared/observed está certa e eu mantenho — mas simplifico o formato: `confidence` não precisa ser um campo armazenado à parte, é **derivado** de `sample_size` (baixa < 5 sessões, média 5-15, alta > 15). Guardar confidence como campo separado cria risco de ficar dessincronizado do sample_size real; melhor computar na hora.

```
psychologist_profile = {
  id: string,
  declared_profile: {           # autoavaliação, preenchida 1x no onboarding
    directiveness, emotional_intensity, temporal_focus, support_challenge: 1-7
  },
  observed_profile: {           # média das leituras pós-sessão sobre esse profissional
    directiveness, emotional_intensity, temporal_focus, support_challenge: 1-7 | null,
    sample_size: int            # nº de sessões que alimentaram essa média
  },
  constraints: { availability, price_band, modalities },
}
```

**Decisão importante:** no V1, o cálculo de compatibilidade usa **apenas `declared_profile`**. `observed_profile` é calculado e armazenado desde a primeira sessão, mas só passa a influenciar o score quando `sample_size` cruzar um piso mínimo (proponho 10 sessões por psicólogo). Com 3-4 profissionais, deixar o sistema começar a "corrigir" o perfil de alguém com 2-3 observações ruidosas é decidir com base em quase nada — overengineering disfarçado de personalização.

Adição barata: um check pós-sessão do **lado do psicólogo** também ("essa sessão pareceu combinar com o que você descreveu no seu perfil? sim/mais ou menos/não") — sinal muito mais limpo para alimentar `observed_profile` no futuro do que tentar inferir só a partir das respostas do paciente.

## 6. Algoritmo de compatibilidade V1

```
distance(paciente, psicólogo) =
    média( |dim_paciente_i − dim_psicólogo_i| )  para cada dimensão i presente nos dois perfis

compatibility = 1 − (distance / 6)      # 6 = distância máxima possível numa escala 1-7
```

Isso é, literalmente, a mesma fórmula de "Distância de Congruência" já prototipada na planilha do piloto (`NexaVitta_Piloto_Sprint2.xlsx`) — só automatizada. Não inventei fórmula nova; reaproveitei o que já validamos como conceito.

**Pesos:** concordo com sua preferência — pesos iguais no V1, como constante de configuração (não *hardcoded* inline), para poder ajustar depois sem reescrever a lógica. Sem dado real, qualquer peso diferenciado agora seria opinião disfarçada de ciência.

**Por que média simples evita que uma variável domine:** cada dimensão contribui igualmente e está na mesma escala (1-7) — não há termo com magnitude maior "engolindo" os outros, como aconteceria numa soma ponderada mal normalizada.

**Dado faltante:** excluído do cálculo, conforme seção 4.

**Confiança baixa:** perfil do paciente com menos de 2 dimensões preenchidas → não calcular/exibir compatibilidade de estilo (seção 4). Perfil do psicólogo sempre existe (é obrigatório no onboarding), então esse lado não tem esse problema.

**Empate:** com 3-4 psicólogos, empate é comum e não é um problema a resolver com mais matemática. Critério de desempate: balanceamento de carga (prefere quem tem menos pacientes ativos no momento) — critério operacional, não pseudo-precisão estatística.

**Ranking:** ver seção 8 — proponho não expor ranking numérico ao paciente.

## 7. Matching ≠ resultado clínico — como aparece na experiência

O rótulo nunca é "melhor psicólogo pra você" — é "compatibilidade de estilo declarado". Nunca mostramos o número (ex. "87%") — isso empresta precisão estatística que a fórmula, com 4 perguntas numa escala de 7 pontos, não tem. Nem proponho as bandas "alta/média/baixa" que você sugeriu: com só 3-4 opções, uma banda de 3 níveis mal diferencia nada e ainda cria a ilusão de uma régua objetiva. Prefiro **nenhum indicador numérico ou categórico visível** — o sistema usa compatibilidade internamente pra ordenar e curar a lista, mas o que o paciente vê é uma descrição em linguagem simples de cada psicólogo (extraída do próprio perfil declarado: "tende a ser mais direto e estruturado" vs. "dá mais espaço pra você guiar a conversa"), sem nota, sem ranking visível, sem autoridade emprestada de matemática que ainda não provou nada.

## 8. Confronto direto: o maior valor do V1 agora não está na UX de recomendação

Com 3-4 psicólogos, qualquer pessoa da equipe consegue "ser o algoritmo" de cabeça em 10 segundos olhando 4 números. A inteligência artificial de fato não tem quase nenhum trabalho de otimização real pra fazer nesse volume. O que o sistema precisa fazer bem, agora, não é ranquear — é **nunca perder um dado**: registrar todo perfil, todo match oferecido, toda escolha, toda rejeição, todo check-in, de forma limpa e estruturada, sessão após sessão, para que quando o volume chegar, o histórico já exista. Construir a parte "inteligente" da UX antes de garantir essa disciplina de captura é investir no lugar errado primeiro.

## 9. Os 3-4 primeiros psicólogos

- **Apresentar todos, sempre** — com só 3-4 profissionais, esconder algum não tem propósito nenhum.
- **Sem score visível, sem ranking numérico** — seção 7.
- **Curadoria por texto, não por posição** — a compatibilidade ordena internamente quem aparece primeiro/é mencionado com mais destaque, mas todos ficam visíveis e escolhíveis.
- **Escolha manual sempre permitida.**
- **Rejeição sempre permitida** — e registrada: qual foi oferecido, qual foi escolhido, se coincidem ou não. Não pedimos motivo obrigatório (fricção), mas deixamos um campo opcional.
- **O sistema nunca decide sozinho** — todo match termina em confirmação humana (paciente e, quando fizer sentido, alguém da equipe revisando enquanto o volume for pequeno). Concordo integralmente com sua preferência de recomendar sem impor; não vejo motivo pra questioná-la.

## 10. O que registrar em cada etapa (dataset mínimo viável)

**Antes da sessão** — por evento de match: `patient_profile` (snapshot, não referência viva — perfis podem mudar depois e o registro do match precisa continuar auditável), `psychologist_profile` de **todos os candidatos considerados** (não só o escolhido — precisamos de exemplos negativos para aprender depois), score de compatibilidade de cada um, ordem de apresentação, qual foi escolhido, motivo se informado.

**Depois da 1ª sessão** — reaproveita o check-in de 7 perguntas já desenhado na Sprint 2, mais uma pergunta nova e necessária: *"o quanto esse profissional combina com o que você estava procurando?"* — distinta das perguntas de aliança geral, porque precisamos de uma variável que valide especificamente a hipótese de matching (um(a) terapeuta pode gerar boa aliança por outros motivos mesmo sendo um "mau match de estilo no papel" — sem essa pergunta específica, não conseguimos nunca saber se o nosso score prediz alguma coisa).

**Sessões seguintes** — nº de sessões, datas, status (ativo/pausado/encerrado), motivo de encerramento quando souber (alta terapêutica ≠ abandono ≠ troca — são coisas diferentes e não podem virar a mesma categoria), troca de profissional (sim/não + novo par vinculado).

## 11. Arquitetura para aprendizado futuro (sem ML agora)

Princípio único: **guardar evento bruto, nunca só agregado.** Toda resposta de check-in é uma linha própria (paciente, psicólogo, nº da sessão, timestamp, as 7 respostas, score calculado) — exatamente como a planilha do piloto já modela, agora como fonte de verdade de produto. Todo evento de match guarda todos os candidatos e scores, não só o vencedor.

Isso já deixa pronta, sem desenho adicional, a tabela que qualquer modelo futuro vai precisar: *features* = as distâncias por dimensão entre paciente e psicólogo no momento do match + contexto (fonte do perfil, sample_size do psicólogo); *label* = continuidade até a 3ª sessão / abandono / troca. Não precisamos "desenhar o dataset de ML" separadamente — ele nasce como subproduto de registrar direito desde o dia 1.

## 12. Reclassificação dos experimentos da Sprint 2

| Elemento | Classificação | Motivo |
|---|---|---|
| Formulário C-NIP-lite do paciente | **B** — coleta contínua | Vira parte do onboarding real; deixa de ser "grupo de teste" |
| Conversa guiada por EM | **B**, com uma mudança — proponho que vire o **fluxo padrão único**, não mais um grupo comparado ao formulário (ver confronto abaixo) |
| Autoavaliação do psicólogo | **A** — executar agora | Já pronta, 1x por profissional, custo baixíssimo |
| Check-in pós-sessão | **A** — executar agora | Já pronto, altíssimo valor de dado por baixíssimo custo |
| Score de aliança | **A** | Deriva automaticamente do check-in |
| Continuidade | **A** | É observação de comportamento real, não precisa desenho extra |
| Curva de sobrevivência | **B** — coleta contínua | Vira métrica permanente de acompanhamento, não experimento isolado |
| Cálculo de congruência | **A**, com restrição | Calculamos e armazenamos sempre; só usamos `observed_profile` no score após piso de amostra (seção 5) |
| Desenho controlado de 20-30 pares em 2 grupos comparados estatisticamente | **D** — descartar como desenhado | Sem volume pra gerar sinal estatístico válido; manter só o metadado de proveniência (seção 2), não o experimento |

**Confronto:** eu reclassificaria a "conversa guiada" de forma mais forte do que um B genérico. Não faz sentido manter formulário-vs-conversa como comparação — não vamos ter volume pra comparar tão cedo. A conversa já é a escolha certa por alinhamento com o manifesto da marca ("a IA nunca conversa para responder, conversa para compreender") independente de qualquer teste estatístico. Proponho adotá-la como o fluxo padrão agora, com o formulário sobrando como opção manual de fallback (ex.: para quem prefere não conversar), não como "grupo de controle".

## 13. Manual agora, automatizado depois

**V1 — manual:** conversa de onboarding (humano segue o roteiro de EM já escrito), autoavaliação do psicólogo (formulário simples), apresentação das opções ao paciente (pode ser humano explicando por WhatsApp, não precisa de UI no dia 1), check-in pós-sessão (formulário simples).

**V1 — automatizado (vale construir já, é barato e evita erro/perda de dado):** cálculo de compatibilidade (fórmula simples, poucas linhas, elimina erro manual de conta), armazenamento estruturado único (uma fonte da verdade, não planilhas soltas se espalhando), um painel mínimo de acompanhamento pra você e pra equipe (pacientes, psicólogos, compatibilidade calculada, status — pode nascer bem simples).

**V2 — depois de ter evidência real:** interface de autoatendimento pro paciente escolher entre as opções (hoje é humano mediando), pesos diferenciados por dimensão (baseado em quais dimensões realmente correlacionam com continuidade nos dados reais), uso do `observed_profile` quando `sample_size` cruzar o piso mínimo, extração automática dos sinais da conversa por IA (aplicando a mesma rubrica já escrita, substituindo o humano roteirista).

**V3 / Data-driven:** modelo preditivo de continuidade sobre o histórico acumulado — só quando houver volume suficiente pra não ser overfitting disfarçado (sugiro um piso de algumas centenas de pares com desfecho conhecido antes de cogitar qualquer modelo estatístico ou de ML sério). Pesos aprendidos automaticamente, possivelmente modelos mais ricos.

## 14. Métricas

**North Star:** continuidade até a 3ª sessão — mantido da Sprint 2, é o que a literatura aponta como o ponto onde a maior parte do abandono já teria acontecido, e o que mais se conecta ao propósito da marca.

**Secundárias:** taxa de aceitação do match (escolheu o profissional destacado pelo sistema ou outro), avaliação de compatibilidade pós-1ª-sessão (pergunta nova da seção 10), intenção de continuar, nº médio de sessões.

**Diagnósticas (servem pra debugar o sistema, não são "sucesso"):** distribuição de distância por dimensão (qual eixo mais diverge), taxa de perfil incompleto, `sample_size` por psicólogo, taxa de rejeição do candidato destacado, troca de profissional.

**Crítica à lista original:** "quantidade de pacientes" e "quantidade de matches" são contexto operacional de crescimento, não métricas de produto — não entram no que "acompanhamos principalmente". "Troca de psicólogo" não é secundária, é diagnóstica — trocar pode ser saudável (ajuste) ou sintoma de mau match, depende do motivo, então sozinha não diz se o sistema está indo bem.

## 15. Riscos e pontos que precisam de validação profissional/regulatória

- Dado de estilo/preferência, mesmo sem conteúdo clínico, é dado relacionado à saúde — tratamento sob LGPD (base legal, finalidade, consentimento específico, possível necessidade de DPO) **necessita validação profissional/regulatória**.
- Enquadramento da plataforma perante normas do CFP sobre divulgação e intermediação de serviços psicológicos **necessita validação profissional/regulatória**.
- Guarda de qualquer relato feito durante a conversa de onboarding (mesmo que o sistema só extraia "estilo") pode tocar em sigilo profissional-adjacente — **necessita validação profissional/regulatória** antes de operar com o primeiro paciente real.
- Risco de produto (não jurídico): conversa aberta pode captar conteúdo de risco (ideação, crise) — precisa de protocolo de encaminhamento humano definido antes do primeiro atendimento real, não é algo pra intuir na hora.

## 16. Decisões para o CEO

Só o que realmente precisa da sua aprovação — o resto eu decido como arquiteto:

1. **Aprovar abandonar o experimento controlado de 20-30 pares** e adotar matching V1 em produção real desde o par #1, mantendo só o metadado de proveniência do perfil.
2. **Aprovar que a conversa guiada por EM vire o fluxo padrão único** de onboarding agora — não mais um grupo comparado a formulário — com o formulário como opção manual de fallback.
3. **Aprovar que o V1 não mostre nenhum score ou ranking visível ao paciente** — só apresentação curada em linguagem simples de todos os psicólogos disponíveis.
4. **Aprovar que `observed_profile` seja armazenado desde já mas só entre no cálculo de compatibilidade após 10 sessões por psicólogo** — evita decidir com base em ruído.
5. **Bloqueante: validar com jurídico/regulatório os pontos da seção 15 (LGPD, CFP, sigilo, protocolo de risco) antes de operar com o primeiro paciente real.**
6. **Aprovar o piso mínimo de "algumas centenas de pares com desfecho conhecido"** como critério de entrada na fase V3/Data-driven, para não cogitarmos ML antes da hora.

Depois da sua aprovação nesses seis pontos, parto para a implementação.
