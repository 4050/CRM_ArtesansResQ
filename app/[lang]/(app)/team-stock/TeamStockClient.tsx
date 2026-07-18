'use client'

import type { Dictionary } from '@/app/[lang]/dictionaries'
import type { TeamStockRow } from '@/lib/data/team-stock'
import StockTable, { type StockItem } from '@/components/stock/StockTable'

interface Props {
  dict: Dictionary
  items: TeamStockRow[]
}

function toStockItem(row: TeamStockRow): StockItem {
  return {
    id: row.id,
    code: row.consumable?.code ?? null,
    name: row.consumable?.name ?? '',
    category: row.consumable?.category ?? 'other',
    unit: row.consumable?.unit ?? 'pcs',
    qty_in_stock: row.qty_in_stock,
    qty_minimum: row.consumable?.qty_minimum ?? 0,
  }
}

export default function TeamStockClient({ dict, items }: Props) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{dict.teamStock.title}</h1>
        <p className="text-sm text-slate-500 mt-1">{dict.teamStock.subtitle}</p>
      </div>

      <StockTable
        dict={dict}
        items={items.map(toStockItem)}
        labels={{
          searchPlaceholder: dict.teamStock.searchPlaceholder,
          allCategories: dict.teamStock.allCategories,
          code: dict.teamStock.code,
          name: dict.teamStock.name,
          category: dict.teamStock.category,
          unit: dict.teamStock.unit,
          stock: dict.teamStock.stock,
          minimum: dict.teamStock.minimum,
          noneFound: dict.teamStock.noneFound,
        }}
      />
    </div>
  )
}
