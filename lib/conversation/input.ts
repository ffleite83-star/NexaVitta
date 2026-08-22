/**
 * Abstração de entrada (V0.2, seção 11 — pragmatismo sobre voz).
 *
 * O Conversation Engine só entende TEXTO. Voz entra por aqui:
 *
 *   Voice Input -> VoiceTranscriber.transcribe() -> texto -> engine
 *   Text Input  -> texto -> engine
 *
 * Em V0.2 só TextInput existe de verdade. VoiceTranscriber é o contrato
 * que uma futura integração de speech-to-text precisa cumprir — de
 * propósito mínimo, para não construirmos infraestrutura de voz agora.
 */
export interface VoiceTranscriber {
  /** Recebe áudio (formato a definir na integração real) e devolve texto. */
  transcribe(audio: ArrayBuffer): Promise<string>
}

/** Implementação futura entra aqui. Por ora, não existe — e está tudo bem. */
export const VOICE_TRANSCRIBER_AVAILABLE = false
