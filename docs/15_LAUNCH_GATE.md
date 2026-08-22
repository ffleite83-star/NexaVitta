# 15. Launch Gate — Dados Reais

Status: premissa oficial de lançamento, registrada em 2026-08-22 por decisão do CEO. Bloqueante. Este documento é a referência canônica; a premissa P1 em `docs/09_ROADMAP.md` aponta para cá.

## 0. A regra em uma frase

Nenhum dado real de paciente entra no ambiente atual antes de existir infraestrutura privada e apropriada, validada, para os dados envolvidos. Sem exceção, sem "só alguns pacientes pra testar".

```text
DESENVOLVIMENTO
      ↓
DADOS SINTÉTICOS
      ↓
     OK

PRIMEIRO PACIENTE REAL
      ↓
    STOP
      ↓
 LAUNCH GATE
      ↓
INFRAESTRUTURA PRIVADA VALIDADA
      ↓
 DADOS REAIS
```

Não existe estado intermediário entre as duas colunas. O primeiro dado real é uma mudança de ambiente, não um incremento.

## 1. O que conta como "dado real"

Qualquer dado que possa identificar ou caracterizar uma pessoa atendida ou candidata a atendimento: dados de pacientes; conversas; transcrições; avaliações e check-ins pós-sessão; informações de contato; e qualquer informação potencialmente sensível ligada a uma pessoa real — mesmo parcial, mesmo "anonimizada" informalmente. Na dúvida, é dado real e o gate se aplica.

O que NÃO conta: fixtures, dados sintéticos, casos simulados e dados de teste gerados pelos scripts em `scripts/matching/`. Esses continuam sendo a fonte de dados de desenvolvimento e podem viver no repositório atual, que permanece público por ora.

## 2. Repositório privado NÃO é proteção de dados

Registro explícito, porque essa confusão seria perigosa: tornar o repositório privado protege o **código**, não os **dados de pacientes**. São problemas diferentes com soluções diferentes. Um repositório privado com dados de pacientes commitados em JSON continuaria sendo uma falha grave de governança — histórico de git não tem retenção, exclusão, controle de acesso granular nem auditoria.

Antes do lançamento real, avaliaremos separadamente: código, banco, armazenamento, logs, backups, autenticação, autorização, ambientes, retenção, acesso e auditoria. A decisão sobre repositório privado, Supabase/Postgres ou outra infraestrutura será tomada antes do primeiro paciente real — não precisa ser tomada agora.

## 3. Checklist do gate

O gate só abre quando TODOS os itens abaixo estiverem resolvidos (ou conscientemente aceitos com registro do porquê).

**Infraestrutura**: ambiente privado; armazenamento adequado ao tipo de dado; banco apropriado; autenticação; autorização; backups; logs (que não vazem dado sensível); controle de acesso.

**Dados**: definição explícita de quais dados serão coletados e por quê; minimização (coletar o mínimo que serve ao matching); política de retenção; mecanismo de exclusão e correção; separação entre identificadores e dados analíticos sempre que possível (o schema atual já nasce assim — `contact_ref` é ponteiro, nunca o dado de contato dentro do perfil).

**Governança**: consentimento (escopo, registro, revogação); política de privacidade; tratamento de dados sensíveis; regras de acesso interno (quem vê transcrição, quem vê perfil, quem vê decisão); auditoria de acesso.

**Regulação** — todos os itens abaixo estão marcados como **NECESSITA VALIDAÇÃO PROFISSIONAL/REGULATÓRIA** e nenhum deles deve ser tratado como resolvido por este documento: LGPD (base legal, dados sensíveis de saúde, direitos do titular); CFP/CRP (exigências sobre atuação e registro profissional na plataforma); sigilo profissional (quem além do psicólogo pode ler uma transcrição, incluindo curador e IA); protocolo de risco (o que fazer se uma conversa revelar risco de vida). Não declaramos conformidade com nada disso. A validação será feita com profissional habilitado antes do piloto real.

## 4. O que o código já garante hoje (e o que não garante)

Garante: o domínio (`lib/matching/engine`, `curation`, `schema`, `reconstruction`) não conhece a persistência — depende só da interface `CaseStore`. A troca de `LocalJsonStore` (fixtures/demo) por uma implementação privada futura é escrever uma nova classe e mudar uma linha em `createDemoStore()` (`lib/matching/store/demo-store.ts`), sem tocar em regras de matching, schemas, decision trail ou lógica de domínio. Isso está provado por teste de contrato (`lib/matching/__tests__/store-contract.test.ts`): a mesma bateria comportamental passa contra duas implementações diferentes da interface, incluindo a reconstrução de caso.

Não garante: nada da seção 3. Persistence-ready significa que a migração será previsível — não que ela já aconteceu.

## 5. Estratégia registrada

Construir rápido com dados sintéticos, mas não construir de forma descartável. O ambiente atual (repo público + fixtures JSON) segue sendo o ambiente de desenvolvimento até o gate. Quando o primeiro paciente real estiver próximo: STOP, abrir este documento, resolver o checklist, escolher e validar a infraestrutura, e só então migrar.
