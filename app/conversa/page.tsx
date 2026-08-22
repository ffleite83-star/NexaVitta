'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import {
  startConversation,
  submitResponse,
  extractForCheckpoint,
  summarizeForCheckpoint,
  ConversationState,
} from '@/lib/conversation/engine'
import type { StyleDimension } from '@/lib/matching/schema/common'

/**
 * /conversa — Patient Voice Discovery (V0.2).
 * Uma conversa, não um formulário. Mobile-first, calma, sem gamificação.
 * AMBIENTE DE DEMONSTRAÇÃO: dados sintéticos apenas (Launch Gate, docs/15).
 */

type Bubble = { from: 'nexavitta' | 'voce'; text: string }
type Phase = 'inicio' | 'conversa' | 'checkpoint' | 'corrigindo' | 'fim' | 'abandonada'

const DIMENSION_LABELS: Record<StyleDimension, { pergunta: string; baixo: string; alto: string }> = {
  directiveness: {
    pergunta: 'Sobre condução das conversas',
    baixo: 'Prefiro conduzir no meu ritmo',
    alto: 'Prefiro que me ajudem a organizar os caminhos',
  },
  emotional_intensity: {
    pergunta: 'Sobre a parte emocional',
    baixo: 'Prefiro um tom mais prático e contido',
    alto: 'Falar do que sinto vem com naturalidade',
  },
  temporal_focus: {
    pergunta: 'Sobre onde focar',
    baixo: 'No que está acontecendo agora',
    alto: 'Na minha história, no que vem de longe',
  },
  support_challenge: {
    pergunta: 'Sobre o jeito de me acompanhar',
    baixo: 'Alguém direto, que me provoque',
    alto: 'Acolhimento primeiro',
  },
}

export default function ConversaPage() {
  const [phase, setPhase] = useState<Phase>('inicio')
  const [state, setState] = useState<ConversationState | null>(null)
  const [bubbles, setBubbles] = useState<Bubble[]>([])
  const [input, setInput] = useState('')
  const [summary, setSummary] = useState<string[]>([])
  const [corrections, setCorrections] = useState<Partial<Record<StyleDimension, number>>>({})
  const [caseId] = useState(() => `case_web_${Date.now()}`)
  const [patientId] = useState(() => `pat_web_${Date.now()}`)
  const [saving, setSaving] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [bubbles, phase])

  async function post(action: string, extra: Record<string, unknown> = {}) {
    try {
      await fetch('/api/conversa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, case_id: caseId, patient_id: patientId, ...extra }),
      })
    } catch {
      // demo: falha de persistência não interrompe a experiência
    }
  }

  function comecar() {
    const step = startConversation('texto')
    setState(step.state)
    setBubbles([{ from: 'nexavitta', text: step.prompt!.text }])
    setPhase('conversa')
  }

  async function responder() {
    if (!state || !input.trim()) return
    const texto = input.trim()
    setInput('')
    setBubbles((b) => [...b, { from: 'voce', text: texto }])

    const step = submitResponse(state, texto)
    setState(step.state)

    if (step.prompt) {
      setBubbles((b) => [...b, { from: 'nexavitta', text: step.prompt!.text }])
      return
    }

    // conversa terminou -> checkpoint de transparência
    setBubbles((b) => [...b, { from: 'nexavitta', text: step.closing_text! }])
    const extraction = extractForCheckpoint(step.state)
    setSummary(summarizeForCheckpoint(extraction))
    setSaving(true)
    await post('complete', { state: step.state })
    setSaving(false)
    setPhase('checkpoint')
  }

  async function confirmar() {
    await post('confirm')
    setPhase('fim')
  }

  async function enviarCorrecoes() {
    const list = Object.entries(corrections).map(([dimension, value]) => ({
      dimension,
      corrected_value: value,
      correction_note: null,
    }))
    if (list.length > 0) await post('correct', { corrections: list })
    else await post('confirm')
    setPhase('fim')
  }

  async function sair() {
    if (state && state.patient_responses.length > 0 && phase === 'conversa') {
      await post('abandon', { state, stage: `apos_resposta_${state.patient_responses.length}` })
    }
    setPhase('abandonada')
  }

  return (
    <main className="mx-auto flex min-h-[calc(100vh-73px)] w-full max-w-md flex-col px-4 pb-6 pt-6">
      {phase === 'inicio' && (
        <div className="my-auto flex flex-col items-center gap-6 text-center">
          <p className="text-xs uppercase tracking-[0.2em] text-violet">Conversa</p>
          <h1 className="font-serif text-3xl leading-snug text-ink">
            Antes de qualquer coisa, a gente quer te escutar.
          </h1>
          <p className="text-sm leading-relaxed text-ink-soft">
            Uma conversa curta, no seu ritmo. Sem testes, sem diagnóstico, sem resposta certa.
            No final, mostramos o que entendemos — e você corrige o que quiser.
          </p>
          <button
            onClick={comecar}
            className="rounded-full bg-ink px-8 py-3 text-sm font-semibold text-paper transition hover:opacity-90"
          >
            Começar conversa
          </button>
          <p className="text-[11px] leading-relaxed text-ink-soft/70">
            Ambiente de demonstração — use apenas informações fictícias.
            Nenhum dado real de paciente é coletado nesta fase.
          </p>
        </div>
      )}

      {(phase === 'conversa' || phase === 'checkpoint' || phase === 'corrigindo') && (
        <>
          <div className="flex-1 space-y-3 overflow-y-auto pb-4">
            {bubbles.map((b, i) => (
              <div key={i} className={b.from === 'voce' ? 'flex justify-end' : 'flex justify-start'}>
                <div
                  className={
                    b.from === 'voce'
                      ? 'max-w-[85%] rounded-2xl rounded-br-md bg-ink px-4 py-3 text-sm leading-relaxed text-paper'
                      : 'max-w-[85%] rounded-2xl rounded-bl-md bg-sand px-4 py-3 text-sm leading-relaxed text-ink'
                  }
                >
                  {b.text}
                </div>
              </div>
            ))}

            {phase === 'checkpoint' && (
              <div className="rounded-2xl border border-line bg-paper p-4">
                <p className="mb-3 text-xs uppercase tracking-wide text-violet">O que eu entendi</p>
                <ul className="space-y-2 text-sm leading-relaxed text-ink">
                  {summary.map((line, i) => (
                    <li key={i}>{line}</li>
                  ))}
                </ul>
                <p className="mt-3 text-sm text-ink-soft">Faz sentido para você?</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    onClick={confirmar}
                    className="rounded-full bg-ink px-5 py-2 text-xs font-semibold text-paper"
                  >
                    Faz sentido
                  </button>
                  <button
                    onClick={() => setPhase('corrigindo')}
                    className="rounded-full border border-line px-5 py-2 text-xs text-ink"
                  >
                    Quero ajustar algo
                  </button>
                </div>
                {saving && <p className="mt-2 text-[11px] text-ink-soft/60">registrando…</p>}
              </div>
            )}

            {phase === 'corrigindo' && (
              <div className="rounded-2xl border border-line bg-paper p-4">
                <p className="mb-3 text-xs uppercase tracking-wide text-violet">Ajuste o que quiser</p>
                <div className="space-y-4">
                  {(Object.keys(DIMENSION_LABELS) as StyleDimension[]).map((dim) => {
                    const labels = DIMENSION_LABELS[dim]
                    const selected = corrections[dim]
                    return (
                      <div key={dim}>
                        <p className="mb-1.5 text-xs font-semibold text-ink">{labels.pergunta}</p>
                        <div className="flex flex-wrap gap-1.5">
                          <button
                            onClick={() => setCorrections((c) => ({ ...c, [dim]: 2 }))}
                            className={`rounded-full border px-3 py-1.5 text-[11px] ${selected === 2 ? 'border-ink bg-ink text-paper' : 'border-line text-ink-soft'}`}
                          >
                            {labels.baixo}
                          </button>
                          <button
                            onClick={() => setCorrections((c) => ({ ...c, [dim]: 6 }))}
                            className={`rounded-full border px-3 py-1.5 text-[11px] ${selected === 6 ? 'border-ink bg-ink text-paper' : 'border-line text-ink-soft'}`}
                          >
                            {labels.alto}
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
                <button
                  onClick={enviarCorrecoes}
                  className="mt-4 rounded-full bg-ink px-5 py-2 text-xs font-semibold text-paper"
                >
                  Pronto
                </button>
              </div>
            )}

            <div ref={endRef} />
          </div>

          {phase === 'conversa' && (
            <div className="border-t border-line pt-3">
              <div className="flex items-end gap-2">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      void responder()
                    }
                  }}
                  rows={2}
                  placeholder="Escreva do seu jeito…"
                  className="flex-1 resize-none rounded-2xl border border-line bg-paper px-4 py-3 text-sm text-ink outline-none placeholder:text-ink-soft/50 focus:border-ink-soft"
                />
                <button
                  onClick={() => void responder()}
                  disabled={!input.trim()}
                  className="rounded-full bg-ink px-5 py-3 text-sm font-semibold text-paper disabled:opacity-30"
                >
                  Enviar
                </button>
              </div>
              <button onClick={() => void sair()} className="mt-2 text-[11px] text-ink-soft/60 underline">
                sair da conversa
              </button>
            </div>
          )}
        </>
      )}

      {phase === 'fim' && (
        <div className="my-auto flex flex-col items-center gap-5 text-center">
          <h2 className="font-serif text-2xl text-ink">Obrigado pela conversa.</h2>
          <p className="text-sm leading-relaxed text-ink-soft">
            O que você compartilhou fica registrado com cuidado — do jeito que você disse,
            não só do jeito que entendemos. É a partir daqui que buscamos o encontro certo.
          </p>
          <Link href="/" className="rounded-full border border-line px-6 py-2.5 text-sm text-ink">
            Voltar ao início
          </Link>
        </div>
      )}

      {phase === 'abandonada' && (
        <div className="my-auto flex flex-col items-center gap-5 text-center">
          <h2 className="font-serif text-2xl text-ink">Tudo bem parar por aqui.</h2>
          <p className="text-sm leading-relaxed text-ink-soft">
            Você pode voltar quando quiser. A conversa estará sempre aberta.
          </p>
          <Link href="/" className="rounded-full border border-line px-6 py-2.5 text-sm text-ink">
            Voltar ao início
          </Link>
        </div>
      )}
    </main>
  )
}
