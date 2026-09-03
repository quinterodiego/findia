export interface RawCategoryRow {
  rowIndex: number
  id: string
  userId: string
  name: string
  color: string
  icon: string
  type: string
  isDefault: string
  createdAt: string
}

export interface RawSubcategoryRow {
  rowIndex: number
  id: string
  userId: string
  categoryId: string
  name: string
  icon: string
  isDefault: string
  createdAt: string
}

export interface CategoriesSnapshot {
  categories: RawCategoryRow[]
  subcategories: RawSubcategoryRow[]
}

export interface ValidationIssue {
  severity: 'CRITICAL' | 'WARNING'
  code: string
  entity: 'category' | 'subcategory'
  rowIndex?: number
  message: string
}

export interface ValidationResult {
  issues: ValidationIssue[]
  criticalCount: number
  warningCount: number
  importable: boolean
}

export interface TransformedCategory {
  id: string
  userId: string
  name: string
  color: string
  icon: string
  type: string
  isDefault: boolean
  createdAt: Date
}

export interface TransformedSubcategory {
  id: string
  userId: string
  categoryId: string
  name: string
  icon: string
  isDefault: boolean
  createdAt: Date
}

export interface TransformedBatch {
  categories: TransformedCategory[]
  subcategories: TransformedSubcategory[]
}
