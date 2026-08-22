import { NextRequest, NextResponse } from 'next/server'
import { createDemoStore } from '@/lib/matching/store/demo-store'
import {
  recordCompletedConversation,
  recordAbandonedConversation,
  recordProfileConfirmation,
  recordProfileCorrections,
  ProfileCorrection,
} from '@/lib/conversation/recorder'
import type { ConversationState } from '@/lib/conversation/engine'

/**
 * API de registro da conversa (V0.2). AMBIENTE DE DESENVOLVIMENTO:
 * persiste no demo store (fixtures JSON locais, dado sintético).
 * LAUNCH GATE: nenhum dado real de paciente pode passar por aqui antes da
 * infraestrutura privada validada (docs/15_LAUNCH_GATE.md). Não há auth de
 * paciente real de propósito — isto não é produção.
 *
 * Nota: em deploy serverless (Vercel), escrita em disco é efêmera — o
 * registro persistente só funciona rodando localmente (npm run dev).
 * Limitação documentada em docs/16.
 */

interface Body {
  action: 'complete' | 'abandon' | 'confirm' | 'correct'
  case_id: string
  patient_id: string
  state?: ConversationState
  stage?: string
  corrections?: ProfileCorrection[]
}

export async function POST(req: NextRequest) {
  let body: Body
  try {
    body = (await req.json()) as Body
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  if (!body.case_id || !body.patient_id || !body.action) {
    return NextResponse.json({ error: 'case_id, patient_id e action são obrigatórios' }, { status: 400 })
  }

  const store = createDemoStore()

  try {
    switch (body.action) {
      case 'complete': {
        if (!body.state) return NextResponse.json({ error: 'state é obrigatório' }, { status: 400 })
        await store.savePatient({
          id: body.patient_id,
          contact_ref: null,
          consent: { given_at: new Date().toISOString(), scope: ['perfil_matching'] },
          created_at: new Date().toISOString(),
        })
        const { profile } = await recordCompletedConversation(store, {
          case_id: body.case_id,
          patient_id: body.patient_id,
          state: body.state,
        })
        return NextResponse.json({ ok: true, profile })
      }
      case 'abandon': {
        if (!body.state) return NextResponse.json({ error: 'state é obrigatório' }, { status: 400 })
        await store.savePatient({
          id: body.patient_id,
          contact_ref: null,
          consent: { given_at: new Date().toISOString(), scope: ['perfil_matching'] },
          created_at: new Date().toISOString(),
        })
        await recordAbandonedConversation(store, {
          case_id: body.case_id,
          patient_id: body.patient_id,
          state: body.state,
          stage: body.stage ?? 'desconhecido',
        })
        return NextResponse.json({ ok: true })
      }
      case 'confirm': {
        await recordProfileConfirmation(store, body.case_id)
        return NextResponse.json({ ok: true })
      }
      case 'correct': {
        if (!body.corrections?.length) return NextResponse.json({ error: 'corrections vazio' }, { status: 400 })
        const updated = await recordProfileCorrections(store, body.case_id, body.corrections)
        return NextResponse.json({ ok: true, profile: updated })
      }
      default:
        return NextResponse.json({ error: 'action desconhecida' }, { status: 400 })
    }
  } catch (err) {
    console.error('[api/conversa]', err)
    return NextResponse.json({ error: 'falha ao registrar' }, { status: 500 })
  }
}
