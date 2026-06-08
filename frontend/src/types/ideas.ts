export type IdeaCategory = {
  id: string
  parent_id: string | null
  name: string
  sort_order: number
  is_active: boolean
}

export type IdeaRecord = {
  id: string
  title: string
  status: string
  category_id: string | null
  priority: string | null
  priority_manual: number | null
  adopted_plan_index: number | null
  created_at: string
  updated_at: string
}

export type IdeaMessage = {
  id: string
  idea_id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  metadata: { priority?: string; priority_reason?: string; category_id?: string } | null
  created_at: string
}

export type IdeaPlan = {
  id: string
  idea_id: string
  plan_index: number
  title: string
  problem_points: string[]
  actions: string[]
  next_step: string
  created_at: string
}

export type IdeasSubTab = 'capture' | 'pending' | 'categories' | 'map' | 'goals'

