import type { IdeaPlan } from '../types/ideas'

export function planCopyText(planIndex: 1 | 2, plan: IdeaPlan): string {
  const label = planIndex === 1 ? '方案一' : '方案二'
  const problems = plan.problem_points.map((p) => `- ${p}`).join('\n') || '- （無）'
  const actions = plan.actions.map((a) => `- ${a}`).join('\n') || '- （無）'
  return [
    `【${label}：${plan.title}】`,
    '問題點：',
    problems,
    '行動建議：',
    actions,
    `下一步：${plan.next_step || '—'}`,
  ].join('\n')
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.left = '-9999px'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  }
}

export function latestPlanPair(plans: IdeaPlan[]): { plan1: IdeaPlan | null; plan2: IdeaPlan | null } {
  if (plans.length === 0) return { plan1: null, plan2: null }
  const latestTime = plans[0]?.created_at
  const round = plans.filter((p) => p.created_at === latestTime)
  return {
    plan1: round.find((p) => p.plan_index === 1) ?? null,
    plan2: round.find((p) => p.plan_index === 2) ?? null,
  }
}

export function priorityClass(priority: string | null | undefined): string {
  if (priority === 'P0') return 'badge-priority badge-p0'
  if (priority === 'P1') return 'badge-priority badge-p1'
  if (priority === 'P2') return 'badge-priority badge-p2'
  return 'badge'
}
