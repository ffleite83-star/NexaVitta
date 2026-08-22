import type { StyleDimension } from '../matching/schema/common'

/**
 * Roteiro da conversa guiada (V0.2 — Patient Voice Discovery).
 *
 * Princípios (pedido V0.2, seção 4; docs/11 seção 10 — entrevista motivacional):
 * - começa aberta, sem mencionar dimensões;
 * - as sondagens (probes) só entram para dimensões SEM sinal após as abertas;
 * - nenhuma pergunta é uma escala disfarçada;
 * - a pessoa pode responder qualquer coisa — o texto é livre sempre.
 *
 * Este roteiro é VERSIONADO (CONVERSATION_FLOW_VERSION). Mudou pergunta,
 * muda a versão — senão a comparação entre casos fica contaminada.
 */
export interface FlowPrompt {
  id: string
  text: string
  kind: 'aberta' | 'sondagem' | 'contextual'
  targets: StyleDimension | 'engagement' | null // qual dimensão a sondagem mira (null = aberta)
}

export const OPEN_PROMPTS: FlowPrompt[] = [
  {
    id: 'abertura',
    text: 'O que te trouxe até aqui?',
    kind: 'aberta',
    targets: null,
  },
  {
    id: 'expectativa',
    text: 'E quando você imagina começar esse processo, o que espera encontrar nessas conversas?',
    kind: 'aberta',
    targets: null,
  },
]

export const PROBES: FlowPrompt[] = [
  {
    id: 'sondagem_diretividade',
    text: 'Tem gente que prefere um profissional que ajude a organizar os caminhos, e gente que prefere mais espaço para conduzir a própria fala. Como isso costuma funcionar melhor para você?',
    kind: 'sondagem',
    targets: 'directiveness',
  },
  {
    id: 'sondagem_emocional',
    text: 'E falar sobre o que você sente — é algo que vem fácil, ou você prefere ir com mais calma nessa parte?',
    kind: 'sondagem',
    targets: 'emotional_intensity',
  },
  {
    id: 'sondagem_tempo',
    text: 'Você sente que o que quer entender está mais ligado ao que está acontecendo agora, ou a coisas que vêm de mais longe na sua história?',
    kind: 'sondagem',
    targets: 'temporal_focus',
  },
  {
    id: 'sondagem_suporte_desafio',
    text: 'Nos momentos mais difíceis, o que costuma te ajudar mais: alguém que acolhe primeiro, ou alguém que te provoca a olhar por outro ângulo?',
    kind: 'sondagem',
    targets: 'support_challenge',
  },
]

export const CONTEXTUAL_PROMPTS: FlowPrompt[] = [
  {
    id: 'engajamento',
    text: 'Fora das conversas, você se imagina levando reflexões ou pequenas práticas para o seu dia a dia, ou prefere que o processo aconteça dentro das sessões mesmo?',
    kind: 'contextual',
    targets: 'engagement',
  },
]

export const CLOSING_TEXT =
  'Obrigado por compartilhar. Antes de terminar, deixa eu te mostrar o que eu entendi — e você me corrige se eu tiver entendido algo errado.'
