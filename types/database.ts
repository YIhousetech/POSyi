// types/database.ts
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          full_name: string
          role: 'admin' | 'kasir'
          phone: string | null
          avatar_url: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['profiles']['Row'], 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>
      }
      products: {
        Row: {
          id: string
          category_id: string | null
          name: string
          barcode: string | null
          description: string | null
          buy_price: number
          sell_price: number
          stock: number
          min_stock: number
          unit: string
          image_url: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['products']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['products']['Insert']>
      }
      customers: {
        Row: {
          id: string
          name: string
          phone: string | null
          email: string | null
          address: string | null
          points: number
          total_spent: number
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['customers']['Row'], 'id' | 'created_at' | 'updated_at' | 'points' | 'total_spent'>
        Update: Partial<Database['public']['Tables']['customers']['Insert']>
      }
      transactions: {
        Row: {
          id: string
          invoice_number: string
          customer_id: string | null
          cashier_id: string | null
          subtotal: number
          discount_amount: number
          tax_amount: number
          total_amount: number
          paid_amount: number
          change_amount: number
          payment_method: 'cash' | 'transfer' | 'qris' | 'debt'
          status: 'completed' | 'cancelled' | 'debt'
          notes: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['transactions']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['transactions']['Insert']>
      }
      transaction_items: {
        Row: {
          id: string
          transaction_id: string
          product_id: string | null
          product_name: string
          product_barcode: string | null
          quantity: number
          buy_price: number
          sell_price: number
          discount_per_item: number
          subtotal: number
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['transaction_items']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['transaction_items']['Insert']>
      }
      debts: {
        Row: {
          id: string
          transaction_id: string | null
          customer_id: string
          original_amount: number
          remaining_amount: number
          due_date: string | null
          status: 'unpaid' | 'partial' | 'paid'
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['debts']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['debts']['Insert']>
      }
      debt_payments: {
        Row: {
          id: string
          debt_id: string
          cashier_id: string | null
          amount: number
          payment_method: string
          notes: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['debt_payments']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['debt_payments']['Insert']>
      }
      stock_adjustments: {
        Row: {
          id: string
          product_id: string
          adjusted_by: string | null
          stock_before: number
          stock_after: number
          adjustment: number
          reason: 'opname' | 'damage' | 'return' | 'correction' | 'purchase'
          notes: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['stock_adjustments']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['stock_adjustments']['Insert']>
      }
      categories: {
        Row: {
          id: string
          name: string
          color: string
          icon: string
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['categories']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['categories']['Insert']>
      }
    }
    Functions: {
      generate_invoice_number: { Args: Record<never, never>; Returns: string }
      get_my_role: { Args: Record<never, never>; Returns: string }
    }
  }
}
