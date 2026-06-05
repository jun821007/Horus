import { useCallback, useEffect, useMemo, useState } from 'react'
import { apiDelete, apiGet, apiPatch, apiPost } from '../lib/api'
import type { IdeaCategory } from '../types/ideas'

type Props = {
  onMessage: (text: string, err?: boolean) => void
}

type TreeNode = IdeaCategory & { depth: number }

function buildTree(categories: IdeaCategory[]): TreeNode[] {
  const sorted = [...categories].sort((a, b) => a.sort_order - b.sort_order)
  const result: TreeNode[] = []

  const walk = (parentId: string | null, depth: number) => {
    sorted.filter((c) => c.parent_id === parentId).forEach((c) => {
      result.push({ ...c, depth })
      walk(c.id, depth + 1)
    })
  }
  walk(null, 0)
  return result
}

export function IdeaCategorySettings({ onMessage }: Props) {
  const [categories, setCategories] = useState<IdeaCategory[]>([])
  const [newName, setNewName] = useState('')
  const [newParentId, setNewParentId] = useState<string>('')

  const load = useCallback(async () => {
    const res = await apiGet<{ ok: boolean; items: IdeaCategory[] }>('/api/ideas/categories?active=0')
    setCategories(res.items)
  }, [])

  useEffect(() => { void load().catch(() => setCategories([])) }, [load])

  const tree = useMemo(() => buildTree(categories), [categories])

  const addCategory = async () => {
    const name = newName.trim()
    if (!name) return
    try {
      await apiPost('/api/ideas/categories', {
        name,
        parent_id: newParentId || null,
      })
      setNewName('')
      await load()
      onMessage('分類已新增')
    } catch (e) {
      onMessage(String(e), true)
    }
  }

  const move = async (cat: IdeaCategory, dir: -1 | 1) => {
    try {
      await apiPatch(`/api/ideas/categories/${cat.id}`, { sort_order: cat.sort_order + dir })
      await load()
    } catch (e) {
      onMessage(String(e), true)
    }
  }

  const toggle = async (cat: IdeaCategory) => {
    try {
      await apiPatch(`/api/ideas/categories/${cat.id}`, { is_active: !cat.is_active })
      await load()
    } catch (e) {
      onMessage(String(e), true)
    }
  }

  const remove = async (id: string) => {
    if (!window.confirm('確定刪除此分類？')) return
    try {
      await apiDelete(`/api/ideas/categories/${id}`)
      await load()
      onMessage('已刪除')
    } catch (e) {
      onMessage(String(e), true)
    }
  }

  const addChild = (parentId: string) => {
    const name = window.prompt('子分類名稱')
    if (!name?.trim()) return
    void apiPost('/api/ideas/categories', { name: name.trim(), parent_id: parentId })
      .then(() => load())
      .then(() => onMessage('子分類已新增'))
      .catch((e) => onMessage(String(e), true))
  }

  return (
    <section className="pixel-panel ideas-categories">
      <h2>分類設定</h2>
      <div className="inline-form">
        <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="新分類名稱" />
        <select value={newParentId} onChange={(e) => setNewParentId(e.target.value)}>
          <option value="">（頂層）</option>
          {tree.filter((c) => c.depth < 2).map((c) => (
            <option key={c.id} value={c.id}>{'—'.repeat(c.depth)}{c.name}</option>
          ))}
        </select>
        <button type="button" className="btn btn-gold" onClick={() => void addCategory()}>新增</button>
      </div>
      <ul className="ideas-cat-tree">
        {tree.map((cat) => (
          <li key={cat.id} style={{ paddingLeft: `${cat.depth * 16}px` }}>
            <span style={{ opacity: cat.is_active ? 1 : 0.45 }}>{cat.name}</span>
            <div className="row-actions">
              <button type="button" className="btn mini" onClick={() => void move(cat, -1)}>↑</button>
              <button type="button" className="btn mini" onClick={() => void move(cat, 1)}>↓</button>
              {cat.depth < 2 ? (
                <button type="button" className="btn mini" onClick={() => addChild(cat.id)}>+ 子分類</button>
              ) : null}
              <button type="button" className="btn mini" onClick={() => void toggle(cat)}>
                {cat.is_active ? '停用' : '啟用'}
              </button>
              <button type="button" className="btn mini" onClick={() => void remove(cat.id)}>刪除</button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
