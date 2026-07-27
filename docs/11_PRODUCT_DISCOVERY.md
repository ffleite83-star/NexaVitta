# 11 · Product Discovery — Sprint 2

**Papel assumido nesta sprint:** Head of Product Discovery (não UX, não desenvolvimento, não Product Design).

**Pergunta que motiva a sprint:** como sabemos que um match entre paciente e psicólogo foi realmente bom?

**Regra desta sprint:** nenhuma linha de código. O objetivo é descobrir quais dados importam antes de decidir o que construir.

## 1. Por que "gostou?" é a pergunta errada

Satisfação autorreportada logo após uma sessão é um mau preditor de resultado clínico e de continuidade — é fácil responder bem por educação, efeito halo do primeiro encontro, ou porque a sessão foi agradável sem ser útil. A literatura de psicoterapia já resolveu esse problema há décadas: em vez de perguntar "gostou?", mede-se a **aliança terapêutica** com instrumentos validados, e o resultado clínico com instrumentos ultrabreves aplicados em toda sessão.

## 2. O que a ciência já sabe (e a NexaVitta não precisa reinventar)

- **Aliança terapêutica é o principal fator comum entre modalidades de terapia.** Meta-análises mostram que a relação terapeuta-paciente responde por cerca de 30% do resultado do tratamento — mais do que a técnica ou abordagem específica usada. [Role of Common Factors in Psychotherapy Outcomes](https://www.hhs.nd.gov/sites/www/files/documents/BH/cuijpers_2019_annurev-clinpsy-common-factors.pdf)
- **A aliança medida cedo prediz abandono com boa precisão.** O Working Alliance Inventory (WAI) e sua versão curta (WAI-SR, 12 itens, aplicável já na 2ª sessão) não só predizem abandono como apontam onde está a desconexão (vínculo, tarefas ou metas). [Therapeutic Alliance and Affordability: Indicators of Early Dropout in Telepsychiatry](https://www.scientificarchives.com/article/therapeutic-alliance-and-affordability-:-indicators-of-early-dropout-in-telepsychiatry) · [Validation of the WAI-S-P](https://pmc.ncbi.nlm.nih.gov/articles/PMC10540858/)
- **Existem instrumentos ultrabreves já validados e prontos para uso em produto.** ORS (Outcome Rating Scale, 4 itens) e SRS (Session Rating Scale, 4 itens) foram desenhados por Scott Miller e Barry Duncan exatamente para aplicação em toda sessão sem gerar fadiga. Em estudo controlado, dar esse feedback ao terapeuta em tempo real dobrou a proporção de pacientes com mudança clinicamente significativa. [The Session Rating Scale (Miller)](https://www.scottdmiller.com/assets/uploads/documents/SessionRatingScale-JBTv3n1.pdf) · [Outcome Rating Scale — validação](https://www.researchgate.net/publication/242159752_The_Outcome_Rating_Scale_A_Preliminary_Study_of_the_Reliability_Validity_and_Feasibility_of_a_Brief_Visual_Analog_Measure)

  *Nota de risco:* ORS/SRS são instrumentos proprietários (ICCE / Better Outcomes Now). Usar os itens exatos em produto comercial pode exigir licenciamento — validar antes de embutir no produto. O WAI-SR tem uso mais aberto para pesquisa, mas também checar termos antes de uso comercial em escala.
- **O abandono é concentrado bem no início.** Estimativas variam por metodologia (10% a 81%, média ~35-47%), mas o padrão consistente é: a maior parte do abandono acontece nas primeiras 1 a 3 sessões, não distribuído ao longo do tratamento. [Premature Discontinuation in Adult Psychotherapy: Meta-Analysis](https://clinica.ispa.pt/sites/default/files/16._dropout_meta_analysis.pdf) · [Psychotherapy discontinuation — panorama](https://en.wikipedia.org/wiki/Psychotherapy_discontinuation)
  → Implicação direta: o matching precisa provar seu valor **dentro das primeiras 3 sessões**, não em 3 meses.
- **Matching por dados demográficos (gênero, raça/etnia) tem efeito real, mas não é a resposta completa.** Concordância demográfica aumenta taxa de conclusão do tratamento em alguns grupos, mas o efeito em resultado clínico é inconsistente — em alguns estudos, pares *discordantes* evoluíram melhor em confiança/respeito ao longo do tempo. [Race/Ethnicity concordance — JMIR](https://www.jmir.org/2024/1/e65354) · [Therapist-Patient Race and Sex Matching](https://www.psychiatrictimes.com/view/therapist-patient-race-and-sex-matching-predictors-treatment-duration)
  → Implicação: filtros demográficos ajudam conversão inicial (a pessoa aceita começar), mas **não devem ser tratados como proxy de compatibilidade real**. Isso é sinal de entrada, não sinal de match.
- **Referência de mercado:** a BetterHelp reporta 93% de "sucesso" no seu algoritmo de matching — mas essa métrica mede cumprimento de preferências declaradas (especialidade, horário), não resultado clínico nem continuidade. É um lembrete de que "match bem-sucedido" e "preferências atendidas" são coisas diferentes, e a NexaVitta não deve confundir as duas ao definir sucesso. [BetterHelp matching — Psychreg](https://www.psychreg.org/making-match-exploring-therapist-pairing-betterhelp-new-findings/)

## 3. O verdadeiro KPI da NexaVitta

Não é cadastro. Não é sessão avulsa. Não é faturamento.

**É continuidade da jornada** — operacionalizada, para não virar conceito vago, como:

- **Métrica primária:** % de pacientes que chegam à 3ª sessão com o mesmo profissional (o ponto onde a literatura mostra que a maior parte do abandono já teria acontecido).
- **Métrica secundária (curva de sobrevivência):** tempo médio até o abandono, e distribuição de abandono por sessão (1ª, 2ª, 3ª...) — não um número único, uma curva.
- **Métrica de longo prazo:** % ainda ativos aos 90 dias.

## 4. Indicadores propostos por sessão (leading indicators)

Em vez de "você gostou?", aplicar, ao final de cada sessão, um conjunto curto (adaptado da lógica WAI/SRS, a validar licenciamento — ver risco acima):

1. Você conseguiu falar sobre o que precisava?
2. Você se sentiu ouvido?
3. Você se sentiu compreendido?
4. Você sentiu confiança para continuar se abrindo?
5. Você acredita que ele(a) compreendeu o momento que você está vivendo?
6. Você gostaria de continuar com esse profissional?
7. Você marcaria uma nova conversa?

Isso não é uma pesquisa de satisfação — é uma proxy de aliança terapêutica (vínculo, tarefas, metas), coletada a tempo de agir (antes do paciente simplesmente sumir).

## 5. A pergunta de ouro

**Quais dessas sete respostas realmente predizem continuidade — e qual o menor subconjunto necessário?**

Isso não se responde por opinião. Precisa de dados reais de um piloto pequeno, correlacionando respostas pós-sessão com comportamento real (o paciente voltou ou não).

## 6. Hipóteses, em ordem de valor esperado

- **H1** — Um score composto de vínculo (perguntas 2, 3, 5) coletado após a sessão 1 prediz melhor o "voltou para a sessão 2" do que qualquer dado coletado *antes* da sessão (especialidade, gênero, preço).
- **H2** — Filtros demográficos/especialidade aumentam a conversão de agendamento da 1ª sessão, mas não predizem continuidade além da 3ª sessão — ou seja, são bons para reduzir fricção de entrada, ruins como proxy de compatibilidade.
- **H3** — O maior alavancador de continuidade não é "matching mais esperto no início", é o **loop de feedback contínuo**: pacientes que respondem ao check-in pós-sessão e recebem alguma ação em resposta (ex.: opção fácil de trocar de profissional sem culpa) têm continuidade maior do que os que não têm esse loop — independente da qualidade do match inicial.
- **H4** — Existe um subconjunto de 2-3 perguntas (não as 7) que captura quase todo o poder preditivo das outras — o que importa para manter o check-in ultrabreve (setup para Sprint 3/4, sem gerar fadiga de formulário).

## 7. Como validar isso sem escrever uma linha de código

- **Experimento 1 — Matching "Mágico de Oz".** Um humano da equipe faz o match manualmente (não algoritmo) para os primeiros 20-30 pares reais, usando um questionário leve pré-sessão. Depois de cada sessão, aplica-se o check-in de 7 perguntas por formulário simples (Typeform/Google Forms). Rastreia-se manualmente (planilha) se o paciente remarcou. Isso já testa H1 e H4 sem nenhum algoritmo.
- **Experimento 2 — Curva de sobrevivência do piloto.** Com os mesmos 20-30 pares, registrar semana a semana quantos seguem ativos. Isso vira o "ground truth" contra o qual qualquer algoritmo futuro será validado — sem essa curva de base, não dá para saber depois se um algoritmo de matching melhorou algo.
- **Experimento 3 — Entrevistas com quem abandonou vs quem continuou.** 10-15 entrevistas curtas com pacientes que pararam após a 1ª sessão e 10-15 com quem passou da 3ª, buscando o que o check-in numérico não captura (isso alimenta a Sprint 3, Behavioral Science).
- **Experimento 4 — Teste do subconjunto mínimo de perguntas.** Depois de ter ~30-50 respostas do Experimento 1, rodar uma correlação simples (Excel/Sheets, sem código) entre cada uma das 7 perguntas e o desfecho real (remarcou ou não) para descobrir quais perguntas carregam o sinal — validando H4.

## 8. O que evitar

- Não usar CSAT genérico ("de 0 a 10, o quanto você recomendaria") como métrica principal — é a métrica mais fácil de coletar e uma das menos preditivas de continuidade real.
- Não tratar "preferências atendidas" (gênero, especialidade, horário) como sinônimo de "match bem-sucedido" — são a porta de entrada, não o resultado.
- Não esperar ter uma amostra grande antes de começar — o objetivo desta sprint é rodar o Experimento 1 com o menor N possível que já produza sinal direcional (20-30 pares é suficiente para orientar a próxima sprint, não para provar estatisticamente nada ainda).

## Próxima sprint

Sprint 3 — Behavioral Science: por que pacientes abandonam depois da 1ª, 3ª e 5ª sessão; o que gera adesão; o que destrói adesão. Alimenta-se do Experimento 3 acima.
