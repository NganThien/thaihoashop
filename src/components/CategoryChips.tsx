// Dãy nút lọc theo nhóm món (vuốt ngang được trên điện thoại)
import type { Category } from '../types'

export type CategoryFilter = 'all' | 'none' | number

interface Props {
  categories: Category[]
  value: CategoryFilter
  onChange: (v: CategoryFilter) => void
  showUncategorized?: boolean
}

export default function CategoryChips({ categories, value, onChange, showUncategorized }: Props) {
  const chip = (key: CategoryFilter, label: string) => (
    <button
      key={String(key)}
      type="button"
      onClick={() => onChange(key)}
      className={`chip ${value === key ? 'chip-on' : 'chip-off'}`}
    >
      {label}
    </button>
  )

  return (
    <div className="-mx-3 flex gap-2 overflow-x-auto px-3 pb-1 md:mx-0 md:flex-wrap md:px-0">
      {chip('all', 'Tất cả')}
      {categories.map((c) => chip(c.id, c.name))}
      {showUncategorized && chip('none', 'Chưa phân nhóm')}
    </div>
  )
}

/** Lọc danh sách món theo nhóm đang chọn */
export function matchCategory(categoryId: number | null, filter: CategoryFilter): boolean {
  if (filter === 'all') return true
  if (filter === 'none') return categoryId === null
  return categoryId === filter
}
