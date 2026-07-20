import { describe, expect, it } from 'vitest'
import { isAdminRole, isMasterAdmin } from './roles'

describe('isAdminRole', () => {
  it('is true for admin and master_admin', () => {
    expect(isAdminRole('admin')).toBe(true)
    expect(isAdminRole('master_admin')).toBe(true)
  })

  it('is false for medic and missing roles', () => {
    expect(isAdminRole('medic')).toBe(false)
    expect(isAdminRole(null)).toBe(false)
    expect(isAdminRole(undefined)).toBe(false)
  })
})

describe('isMasterAdmin', () => {
  it('is true only for master_admin', () => {
    expect(isMasterAdmin('master_admin')).toBe(true)
    expect(isMasterAdmin('admin')).toBe(false)
    expect(isMasterAdmin('medic')).toBe(false)
    expect(isMasterAdmin(null)).toBe(false)
  })
})
