# 16. Patient Voice Discovery — V0.2

Status: implementado, testado, buildado. Código em `lib/conversation/`, UX em `app/conversa/`, API em `app/api/conversa/`, fixtures sintéticos A–L em `lib/conversation/fixtures.ts`.

A porta de entrada de dados da NexaVitta: uma conversa natural que vira matéria-prima estruturada — sem virar questionário, sem inventar certeza, sem perder o que a pessoa realmente disse.

## 1. Fluxo

```text
/conversa (tela de entrada)
      ↓
Conversation Engine (máquina de estado pura, versionada)
      ↓  2 perguntas abertas → sondagens SÓ para dimensões sem sinal → 1 contextual (engajamento)
Respostas livres do paciente (texto; voz preparada por abstração)
      ↓
Extrator determinístico de sinais (heurística versionada — NÃO é IA)
      ↓
Checkpoint de transparência: "eis o que entendi — faz sentido?"
      ↓
confirma │ corrige │ sai
      ↓
Recorder → CaseStore existente (eventos + transcrição RAW + perfil no modelo existente)
```

A conversa é adaptativa de forma simples: quem dá sinal claro nas perguntas abertas responde menos perguntas (caso C completa em 4 respostas; caso I, sem sinal nenhum, recebe as 4 sondagens e completa em 7). Nenhuma pergunta menciona escala, dimensão ou termo clínico.

## 2. Eventos

Novos nesta rodada (V0.2), somados aos existentes: `conversation_response` (metadado do turno — turno, prompt, modo, tamanho; **sem o texto**), `transcription_created` (ponteiro para o RAW no store), `profile_confirmed` e `profile_corrected` (dimensão, valor anterior, valor corrigido, fala da correção). O `profile_extracted` existente foi reaproveitado para o perfil produzido — nenhum evento duplicado foi criado. O enum `extracted_by` ganhou o valor `regra_deterministica`, porque registrar o extrator heurístico como "curador" ou como "IA" seria mentir sobre proveniência.

A reconstrução (`reconstructCase`) agora responde também: quantos turnos houve, onde está a transcrição, qual versão do fluxo estava ativa, se o paciente confirmou ou corrigiu, e o quê.

## 3. Dados — RAW nunca se perde

Três camadas, exatamente como pedido: **RAW** — a transcrição completa (turnos NexaVitta + paciente) vive em `TranscriptRecord`, salva via `saveTranscript` no CaseStore, referenciada por ponteiro nos eventos (nunca texto bruto solto no log). Abandono também salva o RAW parcial. **STRUCTURED** — o perfil usa o `PatientProfileRecord` existente; `DimensionValue` ganhou dois campos opcionais: `evidence` (a frase original que sustenta o valor) e `confidence` (baixa/media/alta). **SOURCE** — extrator = `regra_derivada`; correção do paciente = `paciente_declarado`. Sem evidência → `value = null`. Sinais conflitantes → `value = null` com evidência dos dois lados preservada.

Correção nunca sobrescreve silenciosamente: a interpretação original fica intacta dentro do evento `profile_extracted`; a correção gera eventos `profile_corrected` e um novo registro de perfil com proveniência honesta. O teste do fluxo 3 verifica exatamente isso.

## 4. Decisões desta rodada

O checkpoint precisa interpretar em tempo real e IA em produção está vetada — então o intérprete de V0.2 é um **extrator determinístico** (léxico pt-BR versionado, `signal-extractor/v1`): explicável, reprodutível, barato. Ele é deliberadamente cru; seu papel é encanamento e baseline, nunca "a leitura da NexaVitta". Voz ficou como **abstração** (`lib/conversation/input.ts`): o engine só entende texto; qualquer speech-to-text futuro entrega texto pelo contrato `VoiceTranscriber`, sem tocar no engine. Logística (modalidade/preço/horário) **não** é coletada nesta conversa — a conversa é sobre estilo; misturar agenda com escuta quebraria o tom. O perfil sai com `constraints` vazias, preenchíveis por etapa posterior. Engajamento segue contextual, fora dos eixos de compatibilidade.

## 5. Limitações conhecidas

O extrator erra — e por design não escondemos isso: match por substring gera falsos positivos (ex.: "tenho **passado** por mudanças" lido como foco no passado; caso real observado nos fixtures e corrigido no texto do fixture, não no extrator). Ironia e negação complexa não são tratadas. É esse tipo de erro que a comparação IA Shadow vs. Curador vai quantificar. Persistência via UX: em deploy serverless (Vercel) a escrita em disco é efêmera — o registro persistente funciona rodando localmente (`npm run dev`); limitação aceitável porque produção real está atrás do Launch Gate de qualquer forma. Fechar a aba no meio da conversa não registra abandono (só o botão "sair da conversa" registra); os fixtures cobrem abandono pelo caminho do recorder.

## 6. Como testar

```
npm run test:matching                                   # 30 testes (11 novos da conversa)
npx tsx scripts/conversation/simulate-conversations.ts  # bateria A–L completa contra o store
npm run dev                                             # abrir http://localhost:3000/conversa
```

Os três fluxos exigidos têm teste dedicado: completo (conversa→transcrição→perfil→confirmação→case), abandono (case incompleto com RAW parcial, sem perfil inventado) e correção (original preservada + correção registrada). Há também teste de determinismo do engine — mesma entrada, mesmo estado — que garante que um caso pode ser reprocessado no futuro com outra versão de extrator.

## 7. O que ficou para depois (deliberadamente)

Speech-to-text real; coleta de logística; curador na UX (o caso já está estruturado para ele: transcrição → análise própria → só depois ver IA/matemática — anti-ancoragem intacta); IA Shadow rodando sobre as transcrições (próxima etapa: IA vs. Curador sobre os mesmos RAWs, antes de qualquer dado real); matching conectado à conversa; melhoria do extrator (word boundaries, negação) — só vale investir depois que soubermos, pela comparação com o curador, se ele deve sequer continuar existindo.

## 8. Launch Gate

Intacto. Ambiente atual = dados sintéticos. A tela de entrada avisa: "use apenas informações fictícias". Não há autenticação de paciente real de propósito. Nada nesta rodada habilita coleta real.
