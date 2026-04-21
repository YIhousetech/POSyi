// lib/db.ts - Database query helpers
import { supabase } from './supabase/client'

// ─── PRODUCTS ─────────────────────────────────────────────────────────────────

export async function searchProducts(query: string) {
  const db = supabase()
  const { data, error } = await db
    .from('products')
    .select('id, name, barcode, sell_price, buy_price, stock, unit, category_id')
    .eq('is_active', true)
    .or(`name.ilike.%${query}%,barcode.eq.${query}`)
    .order('name')
    .limit(20)

  if (error) throw error
  return data ?? []
}

export async function getProducts() {
  const db = supabase()
  const { data, error } = await db
    .from('products')
    .select('*, categories(name, color)')
    .eq('is_active', true)
    .order('name')

  if (error) throw error
  return data ?? []
}

export async function getLowStockProducts(threshold?: number) {
  const db = supabase()
  const { data, error } = await db
    .from('products')
    .select('id, name, stock, min_stock, unit')
    .eq('is_active', true)
    .filter('stock', 'lte', threshold !== undefined ? threshold : 'min_stock')
    .order('stock')
    .limit(20)

  if (error) throw error
  return data ?? []
}

export async function upsertProduct(product: any) {
  const db = supabase()
  const { data, error } = await db
    .from('products')
    .upsert(product)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function adjustStock(
  productId: string,
  newStock: number,
  reason: string,
  notes: string,
  adjustedBy: string
) {
  const db = supabase()

  // Get current stock
  const { data: product } = await db
    .from('products')
    .select('stock')
    .eq('id', productId)
    .single()

  if (!product) throw new Error('Produk tidak ditemukan')

  const adjustment = newStock - product.stock

  // Update stock
  const { error: updateError } = await db
    .from('products')
    .update({ stock: newStock })
    .eq('id', productId)

  if (updateError) throw updateError

  // Log adjustment
  const { error: logError } = await db
    .from('stock_adjustments')
    .insert({
      product_id: productId,
      adjusted_by: adjustedBy,
      stock_before: product.stock,
      stock_after: newStock,
      adjustment,
      reason,
      notes
    })

  if (logError) throw logError
  return { stock_before: product.stock, stock_after: newStock, adjustment }
}

// ─── TRANSACTIONS ─────────────────────────────────────────────────────────────

export async function createTransaction(
  cartData: {
    customer_id?: string
    cashier_id: string
    items: Array<{
      product_id: string
      product_name: string
      product_barcode?: string
      quantity: number
      buy_price: number
      sell_price: number
      discount_per_item: number
      subtotal: number
    }>
    subtotal: number
    discount_amount: number
    total_amount: number
    paid_amount: number
    change_amount: number
    payment_method: string
    notes?: string
  }
) {
  const db = supabase()

  // Generate invoice number
  const { data: invoiceData } = await db.rpc('generate_invoice_number')
  const invoice_number = invoiceData || `INV-${Date.now()}`

  const status = cartData.payment_method === 'debt' ? 'debt' : 'completed'

  // Insert transaction
  const { data: transaction, error: txnError } = await db
    .from('transactions')
    .insert({
      invoice_number,
      customer_id: cartData.customer_id || null,
      cashier_id: cartData.cashier_id,
      subtotal: cartData.subtotal,
      discount_amount: cartData.discount_amount,
      total_amount: cartData.total_amount,
      paid_amount: cartData.paid_amount,
      change_amount: cartData.change_amount,
      payment_method: cartData.payment_method,
      status,
      notes: cartData.notes,
    })
    .select()
    .single()

  if (txnError) throw txnError

  // Insert items
  const itemsToInsert = cartData.items.map(item => ({
    transaction_id: transaction.id,
    ...item,
  }))

  const { error: itemsError } = await db
    .from('transaction_items')
    .insert(itemsToInsert)

  if (itemsError) throw itemsError

  // If debt, create debt record
  if (status === 'debt' && cartData.customer_id) {
    await db.from('debts').insert({
      transaction_id: transaction.id,
      customer_id: cartData.customer_id,
      original_amount: cartData.total_amount,
      remaining_amount: cartData.total_amount,
      status: 'unpaid',
    })
  }

  return transaction
}

export async function getTransactions(limit = 50, offset = 0) {
  const db = supabase()
  const { data, error } = await db
    .from('transactions')
    .select(`
      *,
      customers(name, phone),
      profiles(full_name)
    `)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) throw error
  return data ?? []
}

export async function getTransactionById(id: string) {
  const db = supabase()
  const { data, error } = await db
    .from('transactions')
    .select(`
      *,
      customers(name, phone),
      profiles(full_name),
      transaction_items(*)
    `)
    .eq('id', id)
    .single()

  if (error) throw error
  return data
}

// ─── CUSTOMERS ────────────────────────────────────────────────────────────────

export async function searchCustomers(query: string) {
  const db = supabase()
  const { data, error } = await db
    .from('customers')
    .select('id, name, phone, points, total_spent')
    .or(`name.ilike.%${query}%,phone.ilike.%${query}%`)
    .limit(10)

  if (error) throw error
  return data ?? []
}

export async function getCustomerDebts(customerId: string) {
  const db = supabase()
  const { data, error } = await db
    .from('debts')
    .select('*, transactions(invoice_number, created_at)')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data ?? []
}

export async function payDebt(
  debtId: string,
  amount: number,
  cashierId: string,
  paymentMethod = 'cash',
  notes = ''
) {
  const db = supabase()

  const { data: debt } = await db
    .from('debts')
    .select('remaining_amount')
    .eq('id', debtId)
    .single()

  if (!debt) throw new Error('Data hutang tidak ditemukan')

  const newRemaining = Math.max(0, debt.remaining_amount - amount)
  const newStatus = newRemaining === 0 ? 'paid' : 'partial'

  const { error: updateError } = await db
    .from('debts')
    .update({ remaining_amount: newRemaining, status: newStatus })
    .eq('id', debtId)

  if (updateError) throw updateError

  await db.from('debt_payments').insert({
    debt_id: debtId,
    cashier_id: cashierId,
    amount,
    payment_method: paymentMethod,
    notes,
  })

  return { new_remaining: newRemaining, status: newStatus }
}

// ─── DASHBOARD STATS ──────────────────────────────────────────────────────────

export async function getDashboardStats(date?: string) {
  const db = supabase()
  const today = date || new Date().toISOString().split('T')[0]
  const startOfDay = `${today}T00:00:00`
  const endOfDay = `${today}T23:59:59`

  const [txns, products, debts] = await Promise.all([
    db.from('transactions')
      .select('total_amount, status')
      .gte('created_at', startOfDay)
      .lte('created_at', endOfDay),

    db.from('products')
      .select('id, name, stock, min_stock')
      .eq('is_active', true)
      .filter('stock', 'lte', 'min_stock'),

    db.from('debts')
      .select('remaining_amount')
      .eq('status', 'unpaid'),
  ])

  const completedTxns = (txns.data ?? []).filter(t => t.status === 'completed')
  const todayRevenue = completedTxns.reduce((s, t) => s + t.total_amount, 0)
  const todayTransactions = completedTxns.length
  const totalDebt = (debts.data ?? []).reduce((s, d) => s + d.remaining_amount, 0)
  const lowStockCount = (products.data ?? []).filter(p => p.stock <= p.min_stock).length

  return {
    today_revenue: todayRevenue,
    today_transactions: todayTransactions,
    total_unpaid_debt: totalDebt,
    low_stock_count: lowStockCount,
    low_stock_products: products.data?.slice(0, 5) ?? [],
  }
}

export async function getMonthlySales(year: number, month: number) {
  const db = supabase()
  const start = `${year}-${String(month).padStart(2, '0')}-01`
  const end = new Date(year, month, 0).toISOString().split('T')[0]

  const { data, error } = await db
    .from('transactions')
    .select('created_at, total_amount, status')
    .gte('created_at', start)
    .lte('created_at', `${end}T23:59:59`)
    .eq('status', 'completed')
    .order('created_at')

  if (error) throw error

  // Group by date
  const grouped: Record<string, number> = {}
  for (const t of data ?? []) {
    const day = t.created_at.split('T')[0]
    grouped[day] = (grouped[day] ?? 0) + t.total_amount
  }

  return Object.entries(grouped).map(([date, revenue]) => ({ date, revenue }))
}
