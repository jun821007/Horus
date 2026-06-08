import { useCallback, useEffect, useMemo, useState } from 'react'
import { apiGet, apiPatch, apiPost } from '../lib/api'
import { copyText, latestPlanPair, planCopyText } from '../lib/ideas'
import type { IdeaCategory, IdeaMessage, IdeaPlan, IdeaRecord } from '../types/ideas'


function priorityChipClass(priority: string | null | undefined): string {
  if (priority === 'P0') return 'chip danger'
  if (priority === 'P1') return 'chip'
  return 'chip muted'
}
type Props = {
  ideaId: string | null
  categories: IdeaCategory[]
  onMessage: (text: string, err?: boolean) => void
  onIdeaCreated: (id: string) => void
  onDecision: () => void
}

export function IdeaChatView({ ideaId, categories, onMessage, onIdeaCreated, onDecision }: Props) {
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [idea, setIdea] = useState<IdeaRecord | null>(null)
  const [messages, setMessages] = useState<IdeaMessage[]>([])
  const [plans, setPlans] = useState<IdeaPlan[]>([])
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  const load = useCallback(async (id: string) => {
    const res = await apiGet<{ ok: boolean; idea: IdeaRecord; messages: IdeaMessage[]; plans: IdeaPlan[] }>(
      `/api/ideas/${id}`,
    )
    setIdea(res.idea)
    setMessages(res.messages)
    setPlans(res.plans)
  }, [])

  useEffect(() => {
    if (!ideaId) {
      setIdea(null)
      setMessages([])
      setPlans([])
      return
    }
    void load(ideaId).catch((e) => onMessage(String(e), true))
  }, [ideaId, load, onMessage])

  const { plan1, plan2 } = useMemo(() => latestPlanPair(plans), [plans])
  const latestMeta = useMemo(() => {
    const last = [...messages].reverse().find((m) => m.role === 'assistant')
    return last?.metadata ?? null
  }, [messages])

  const categoryName = useMemo(() => {
    const id = latestMeta?.category_id ?? idea?.category_id
    return categories.find((c) => c.id === id)?.name ?? '—'
  }, [categories, idea, latestMeta])

  const canDecide = idea && ['draft', 'pending'].includes(idea.status)
  const adoptedIndex = idea?.adopted_plan_index
  const canCompose = !idea || ['draft', 'pending'].includes(idea.status)

  const submit = async () => {
    const text = draft.trim()
    if (!text || busy) return
    setBusy(true)
    try {
      if (ideaId) {
        await apiPost(`/api/ideas/${ideaId}/messages`, { text })
        await load(ideaId)
      } else {
        const res = await apiPost<{ ok: boolean; idea: IdeaRecord }>('/api/ideas', { text })
        onIdeaCreated(res.idea.id)
        await load(res.idea.id)
      }
      setDraft('')
      onMessage('AI 分析完成')
    } catch (e) {
      onMessage(String(e), true)
    } finally {
      setBusy(false)
    }
  }

  const decide = async (action: 'adopt_1' | 'adopt_2' | 'pending' | 'archive') => {
    if (!ideaId || busy) return
    if (action === 'archive' && !window.confirm('確定丟棄此想法？')) return
    setBusy(true)
    try {
      const res = await apiPatch<{ ok: boolean; idea: IdeaRecord }>(`/api/ideas/${ideaId}/decision`, { action })
      setIdea(res.idea)
      await load(ideaId)
      onDecision()
      onMessage('已記錄決策')
    } catch (e) {
      onMessage(String(e), true)
    } finally {
      setBusy(false)
    }
  }

  const copyPlan = async (planIndex: 1 | 2, plan: IdeaPlan | null) => {
    if (!plan) return
    const ok = await copyText(planCopyText(planIndex, plan))
    if (ok) {
      setCopiedKey(`${plan.id}-${planIndex}`)
      window.setTimeout(() => setCopiedKey(null), 1500)
    } else {
      onMessage('複製失敗', true)
    }
  }

  return (
    <div className="ideas-chat-layout">
      <div className="ideas-thread">
        {messages.length === 0 && !busy ? (
          <div className="empty-state">輸入想法，AI 會回兩個方案</div>
        ) : null}
        {messages.map((m) => {
          if (m.role === 'system') {
            return <div key={m.id} className="bubble system">{m.content}</div>
          }
          if (m.role === 'user') {
            return <div key={m.id} className="bubble user">{m.content}</div>
          }
          return (
            <div key={m.id} className="bubble assistant">
              {m.content}
            </div>
          )
        })}
        {busy ? <div className="bubble assistant">思考中…</div> : null}
      </div>

      {(plan1 || plan2) && !busy ? (
        <div className="panel" style={{ marginTop: 8 }}>
          <div style={{ marginBottom: 8 }}>
            <span className="chip">{categoryName}</span>
            <span className={priorityChipClass(latestMeta?.priority ?? idea?.priority)}>
              {latestMeta?.priority ?? idea?.priority ?? '—'}
            </span>
          </div>
          {latestMeta?.priority_reason ? <p className="card-meta">{latestMeta.priority_reason}</p> : null}
          {[plan1, plan2].map((plan, idx) => {
            if (!plan) return null
            const n = (idx + 1) as 1 | 2
            const adopted = adoptedIndex === n
            return (
              <div key={plan.id} className={`ideas-plan-card ${adopted ? 'adopted' : ''} ${adoptedIndex && !adopted ? 'faded' : ''}`}>
                <h4>方案{n === 1 ? '一' : '二'}：{plan.title}</h4>
                <p className="ideas-plan-label">問題點</p>
                <ul>{plan.problem_points.map((p) => <li key={p}>{p}</li>)}</ul>
                <p className="ideas-plan-label">行動建議</p>
                <ul>{plan.actions.map((a) => <li key={a}>{a}</li>)}</ul>
                <p className="card-meta">下一步：{plan.next_step || '—'}</p>
                <button type="button" className="btn btn-sm" disabled={!plan} onClick={() => void copyPlan(n, plan)}>
                  {copiedKey === `${plan.id}-${n}` ? '已複製' : `複製方案${n === 1 ? '一' : '二'}`}
                </button>
              </div>
            )
          })}
          {canDecide ? (
            <div className="ideas-decision-bar">
              <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => void decide('adopt_1')}>採用①</button>
              <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => void decide('adopt_2')}>採用②</button>
              <button type="button" className="btn btn-sm" disabled={busy} onClick={() => void decide('pending')}>暫緩</button>
              <button type="button" className="btn btn-sm" disabled={busy} onClick={() => void decide('archive')}>丟棄</button>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="ideas-compose-bar">
        <textarea
          className="input-field"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="突然想到什麼？"
          rows={2}
          disabled={busy || !canCompose}
        />
        <button
          type="button"
          className="btn btn-primary"
          disabled={busy || !draft.trim() || !canCompose}
          onClick={() => void submit()}
        >
          {busy ? '思考中…' : '送出'}
        </button>
      </div>
    </div>
  )
}


