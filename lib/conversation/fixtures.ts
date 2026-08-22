import { startConversation, submitResponse, ConversationState, InputMode } from './engine'

/**
 * Bateria de conversas 100% SINTÉTICAS (V0.2, seção 15).
 * Nenhuma pessoa real. Nenhum dado real. Launch Gate intacto.
 *
 * Cada caso é uma lista ordenada de respostas do "paciente" — o runner
 * alimenta o engine na ordem em que as perguntas vierem. Como as sondagens
 * são adaptativas, casos com sinal forte nas abertas recebem menos perguntas.
 */
export interface SyntheticCase {
  key: string
  label: string
  responses: string[]
  abandons_after?: number // se presente, abandona após N respostas
}

export const SYNTHETIC_CASES: SyntheticCase[] = [
  {
    key: 'caso_a_diretividade',
    label: 'A — prefere condução ativa',
    responses: [
      'Estou me sentindo meio perdido no trabalho e na vida, muita coisa ao mesmo tempo.',
      'Espero encontrar orientação, sabe? Alguém que me dê um norte e um plano, com passos claros do que fazer.',
      'Falar do que sinto vem razoavelmente fácil, sem problema.',
      'Acho que é mais sobre o que está acontecendo agora, a situação atual mesmo.',
      'Um pouco dos dois, mas tudo bem.',
      'Gosto da ideia de levar coisas pro dia a dia, praticar entre as sessões.',
    ],
  },
  {
    key: 'caso_b_autonomia',
    label: 'B — prefere conduzir a própria fala',
    responses: [
      'Estou vivendo umas mudanças e queria um espaço pra pensar em voz alta.',
      'Quero espaço para eu ir chegando nas coisas no meu tempo. Não gosto que me digam o que fazer.',
      'Depende do dia, honestamente.',
      'Um pouco de cada, acho.',
      'Também não sei bem.',
      'Prefiro que aconteça dentro das sessões mesmo.',
    ],
  },
  {
    key: 'caso_c_emocional',
    label: 'C — confortável com expressão emocional',
    responses: [
      'Ando muito sensível, choro fácil e queria entender o que eu sinto.',
      'Quero poder desabafar de verdade, falar dos meus sentimentos sem me segurar.',
      'Como eu disse, me abrir não é problema, quero sentir tudo que precisar.',
      'Talvez as duas coisas.',
      'Não sei dizer.',
      'Tanto faz, de verdade.',
    ],
  },
  {
    key: 'caso_d_contido',
    label: 'D — racional/contido',
    responses: [
      'Tenho um problema pontual de ansiedade em reuniões e quero resolver.',
      'Procuro algo racional, com lógica, prático e direto. Não sou de falar de sentimento.',
      'Prefiro ir com calma nessa parte, como falei, sou mais contido.',
      'É sobre o presente, claramente.',
      'Indiferente.',
      'Não gosto de dever de casa, prefiro resolver na sessão.',
    ],
  },
  {
    key: 'caso_e_passado',
    label: 'E — explora origens/história espontaneamente',
    responses: [
      'Sinto que repito padrões que vêm da minha infância, da forma como minha família sempre funcionou.',
      'Quero entender minha história, de onde vem esse jeito meu. Acho que a resposta está lá atrás.',
      'Tranquilo falar do que sinto.',
      'Como falei, é sobre o passado, quero olhar pra origem das coisas.',
      'Qualquer um dos dois.',
      'Posso levar reflexões pro dia a dia, sim.',
    ],
  },
  {
    key: 'caso_f_presente',
    label: 'F — focado no problema atual',
    responses: [
      'Estou com um problema bem específico agora: mudei de cidade e não estou me adaptando.',
      'Quero lidar com o que está acontecendo, a situação atual. Quero resolver isso logo.',
      'Normal, nem fácil nem difícil.',
      'O agora, sem dúvida. O problema atual.',
      'Um equilíbrio, talvez.',
      'Tanto faz.',
    ],
  },
  {
    key: 'caso_g_suporte',
    label: 'G — busca acolhimento',
    responses: [
      'Estou passando por um luto e preciso de um lugar seguro pra estar.',
      'Preciso de acolhimento, de alguém que me escute com paciência e carinho.',
      'Consigo falar do que sinto, sim.',
      'Um pouco dos dois.',
      'Como disse, acolhimento primeiro. Quero apoio e gentileza.',
      'Prefiro dentro das sessões por enquanto.',
    ],
  },
  {
    key: 'caso_h_desafio',
    label: 'H — prefere abordagem direta/desafiadora',
    responses: [
      'Sinto que estou estagnado e sendo complacente comigo mesmo.',
      'Quero alguém direto comigo, sem rodeios, que me confronte quando eu estiver me enganando.',
      'Sem problema com isso.',
      'Mais o agora.',
      'Que me provoque mesmo, quero que me tire da zona de conforto.',
      'Gosto de tarefas, quero aplicar as coisas.',
    ],
  },
  {
    key: 'caso_i_ambiguo',
    label: 'I — informação insuficiente',
    responses: [
      'Não sei bem, só achei que seria bom conversar com alguém.',
      'Não pensei muito nisso ainda.',
      'Hmm, não sei.',
      'Difícil dizer.',
      'Também não sei.',
      'Sem preferência.',
      'Pode ser qualquer formato.',
    ],
  },
  {
    key: 'caso_j_contraditorio',
    label: 'J — sinais conflitantes',
    responses: [
      'Quero alguém que me dê um plano com passos claros, mas ao mesmo tempo não gosto que me digam o que fazer.',
      'É isso, quero direção mas também quero liberdade total.',
      'Normal.',
      'Um pouco de tudo.',
      'Depende do dia.',
      'Indiferente.',
    ],
  },
  {
    key: 'caso_k_abandono',
    label: 'K — começa e não termina',
    responses: [
      'Estou pensando em começar terapia mas ainda não tenho certeza.',
    ],
    abandons_after: 1,
  },
  {
    key: 'caso_l_correcao',
    label: 'L — sistema interpreta, pessoa corrige',
    responses: [
      'Preciso de orientação, um norte. Quero um plano.',
      'Espero encontrar passos claros e alguém que me conduza.',
      'De boa falar do que sinto.',
      'Mais o agora.',
      'Equilíbrio.',
      'Tanto faz.',
    ],
    // correção aplicada pelo runner/teste: a pessoa corrige a leitura de
    // diretividade para baixo ("na verdade eu quero decidir as coisas eu mesmo")
  },
]

export interface FixtureRunResult {
  state: ConversationState
  completed: boolean
  responses_used: number
}

/** Alimenta o engine com as respostas do caso, na ordem em que as perguntas vierem. */
export function runFixtureConversation(
  fixture: SyntheticCase,
  inputMode: InputMode = 'texto',
  now?: () => string
): FixtureRunResult {
  let { state, prompt } = startConversation(inputMode, now)
  let used = 0

  while (prompt != null && used < fixture.responses.length) {
    if (fixture.abandons_after != null && used >= fixture.abandons_after) {
      return { state, completed: false, responses_used: used }
    }
    const step = submitResponse(state, fixture.responses[used]!, now)
    state = step.state
    prompt = step.prompt
    used += 1
  }

  const completed = prompt == null
  if (fixture.abandons_after != null) {
    return { state, completed: false, responses_used: used }
  }
  return { state, completed, responses_used: used }
}
