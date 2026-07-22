export type UserRole = 'master_admin' | 'admin' | 'medic'

export interface User {
  id: string
  email: string
  name: string
  role: UserRole
  brigade: string | null
  organization_id: string
  created_at: string
}

export interface Vehicle {
  id: string
  number: string
  name: string | null
  is_active: boolean
}

export interface Bag {
  id: string
  number: string
  description: string | null
  is_active: boolean
}

export type ConsumableUnit = 'pcs' | 'pair' | 'ml' | 'l' | 'g' | 'kg' | 'pack' | 'vial' | 'amp'

// Known category codes offered by the picker. `category` itself stays a free-text
// column in the DB, so values outside this set are valid and just aren't translatable.
export type ConsumableCategory = 'ppe' | 'dressings' | 'instruments' | 'solutions' | 'medications' | 'other'

// Funding source the item was procured through — splits the main warehouse
// into 3 tabs. Same free-text-in-DB convention as category/unit above.
export type ConsumableSource = 'state_procurement' | 'charity' | 'other'

export interface Consumable {
  id: string
  code: string | null
  name: string
  category: string
  unit: ConsumableUnit
  source: string
  qty_in_stock: number
  qty_minimum: number
  description: string | null
  is_active: boolean
}

export interface Call {
  id: string
  call_number: string
  date: string
  description: string | null
  vehicle_id: string
  bag_id: string
  user_id: string
  created_at: string
  vehicle?: Vehicle
  bag?: Bag
  user?: User
  writeoffs?: Writeoff[]
}

export interface Writeoff {
  id: string
  call_id: string
  consumable_id: string
  quantity: number
  created_at: string
  consumable?: Consumable
}

export interface WriteoffInput {
  consumable_id: string
  quantity: number
}

export type StockMovementType = 'opening_balance' | 'increase' | 'decrease'

export interface StockMovement {
  id: string
  consumable_id: string
  movement_type: StockMovementType
  quantity_delta: number
  quantity_before: number
  quantity_after: number
  user_id: string | null
  created_at: string
  consumable?: Pick<Consumable, 'name' | 'unit' | 'category'>
  user?: Pick<User, 'name'> | null
}

export interface CallFormData {
  call_number: string
  date: string
  time: string
  description: string
  vehicle_id: string
  bag_id: string
  writeoffs: WriteoffInput[]
}
