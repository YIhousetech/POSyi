// app/pos/page.tsx
'use client'
import { useState, useCallback, useRef, useEffect } from 'react'
import { Search, X, Plus, Minus, ShoppingCart, ChevronRight, Tag, User, Trash2, Receipt } from 'lucide-react'
import { useCartStore, CartItem } from '@/store/cartStore'
import { searchProducts, searchCustomers, createTransaction } from '@/lib/db'
import { generateReceiptPDF } from '@/lib/generateReceiptPDF'
import { BottomNav } from '@/components/BottomNav'
import { formatCurrency } from '@/lib/utils'
import { clsx } from 'clsx'

type ViewMode = 'search' | 'cart' | 'checkout'

export default function POSPage() {
  const [view, setView] = useState<ViewMode>('search')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [customerQuery, setCustomerQuery] = useState('')
  const [customerResults, setCustomerResults] = useState<any[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [lastTransaction, setLastTransaction] = useState<any>(null)
  const searchTimer = useRef<NodeJS.Timeout>()

  const {
    items, customer, discount, paymentMethod, paidAmount,
    addItem, removeItem, updateQuantity, setCustomer,
    setDiscount, setPaymentMethod, setPaidAmount, clearCart,
    getSubtotal, getTotal, getChange, getItemCount
  } = useCartStore()

  const subtotal = getSubtotal()
  const total = getTotal()
  const change = getChange()
  const itemCount = getItemCount()

  // Debounced product search
  const handleSearch = useCallback((value: string) => {
    setQuery(value)
    clearTimeout(searchTimer.current)
    if (!value.trim()) { setResults([]); return }

    searchTimer.current = setTimeout(async () => {
      setIsSearching(true)
      try {
        const data = await searchProducts(value)
        setResults(data)
      } catch (e) { console.error(e) }
      finally { setIsSearching(false) }
    }, 300)
  }, [])

  // Customer search
  const handleCustomerSearch = useCallback(async (value: string) => {
    setCustomerQuery(value)
    if (!value.trim()) { setCustomerResults([]); return }
    const data = await searchCustomers(value)
    setCustomerResults(data)
  }, [])

  const handleAddToCart = (product: any) => {
    addItem({
      id: `${product.id}-${Date.now()}`,
      product_id: product.id,
      name: product.name,
      barcode: product.barcode,
      sell_price: product.sell_price,
      buy_price: product.buy_price,
      discount: 0,
    })
    // Haptic feedback (mobile)
    if ('vibrate' in navigator) navigator.vibrate(30)
  }

  const handleCheckout = async () => {
    if (items.length === 0) return
    setIsProcessing(true)

    try {
      // TODO: get real cashier ID from auth
      const cashierId = 'REPLACE_WITH_AUTH_UID'

      const txn = await createTransaction({
        customer_id: customer?.id,
        cashier_id: cashierId,
        items: items.map(i => ({
          product_id: i.product_id,
          product_name: i.name,
          product_barcode: i.barcode,
          quantity: i.quantity,
          buy_price: i.buy_price,
          sell_price: i.sell_price,
          discount_per_item: i.discount,
          subtotal: i.subtotal,
        })),
        subtotal,
        discount_amount: discount,
        total_amount: total,
        paid_amount: paidAmount,
        change_amount: change,
        payment_method: paymentMethod,
      })

      setLastTransaction({ ...txn, items })
      clearCart()
      setView('search')
    } catch (e: any) {
      alert('Gagal menyimpan transaksi: ' + e.message)
    } finally {
      setIsProcessing(false)
    }
  }

  const handlePrintReceipt = () => {
    if (!lastTransaction) return
    generateReceiptPDF({
      invoice_number: lastTransaction.invoice_number,
      created_at: lastTransaction.created_at,
      cashier_name: 'Kasir',
      customer_name: customer?.name,
      items: lastTransaction.items,
      subtotal: lastTransaction.subtotal,
      discount_amount: lastTransaction.discount_amount,
      total_amount: lastTransaction.total_amount,
      paid_amount: lastTransaction.paid_amount,
      change_amount: lastTransaction.change_amount,
      payment_method: lastTransaction.payment_method,
      store_name: 'TOKO RETAIL KU',
      store_address: 'Jl. Contoh No. 1, Kota',
      store_phone: '0812-3456-7890',
      paper_width: '80mm',
    }, 'download')
  }

  const paymentMethods = [
    { id: 'cash', label: 'Tunai', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
    { id: 'transfer', label: 'Transfer', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
    { id: 'qris', label: 'QRIS', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
    { id: 'debt', label: 'Hutang', color: 'bg-red-500/20 text-red-400 border-red-500/30' },
  ]

  return (
    <div className="min-h-screen bg-slate-950 pb-safe max-w-lg mx-auto">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-slate-950/95 backdrop-blur border-b border-slate-800/60 px-4 pt-safe">
        <div className="flex items-center gap-3 py-3">
          <div className="flex-1">
            <h1 className="font-bold text-slate-100">Kasir</h1>
            {customer && (
              <p className="text-xs text-amber-400 flex items-center gap-1">
                <User size={10} />{customer.name}
              </p>
            )}
          </div>
          {/* View Toggle */}
          <div className="flex bg-slate-900 rounded-xl p-0.5 gap-0.5">
            {[
              { v: 'search', icon: Search, label: 'Cari' },
              { v: 'cart', icon: ShoppingCart, label: 'Keranjang' },
              { v: 'checkout', icon: ChevronRight, label: 'Bayar' },
            ].map(({ v, icon: Icon, label }) => (
              <button key={v} onClick={() => setView(v as ViewMode)}
                className={clsx(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                  view === v ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-slate-300'
                )}>
                <Icon size={12} />{label}
                {v === 'cart' && itemCount > 0 && (
                  <span className="bg-slate-950 text-amber-400 rounded-full text-[9px] w-4 h-4 
                                   flex items-center justify-center font-black">
                    {itemCount}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Total bar - always visible */}
        {itemCount > 0 && (
          <div className="flex items-center justify-between py-2 px-0 border-t border-slate-800/40">
            <span className="text-xs text-slate-500">{itemCount} item</span>
            <span className="text-base font-black text-amber-400">{formatCurrency(total)}</span>
          </div>
        )}
      </div>

      {/* ── VIEW: SEARCH ── */}
      {view === 'search' && (
        <div className="px-4 pt-4 space-y-4">
          {/* Last Transaction Success */}
          {lastTransaction && (
            <div className="card p-4 border-emerald-500/30 bg-emerald-500/5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-emerald-400 font-medium">✓ Transaksi Berhasil</p>
                  <p className="font-bold text-slate-100">{lastTransaction.invoice_number}</p>
                  <p className="text-xs text-slate-400">{formatCurrency(lastTransaction.total_amount)}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={handlePrintReceipt} className="btn-ghost text-xs py-2 px-3 flex items-center gap-1.5">
                    <Receipt size={14} />Struk
                  </button>
                  <button onClick={() => setLastTransaction(null)} className="text-slate-500">
                    <X size={18} />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Search Box */}
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              className="input pl-9 pr-9 text-sm"
              placeholder="Cari nama produk atau scan barcode..."
              value={query}
              onChange={e => handleSearch(e.target.value)}
              autoComplete="off"
            />
            {query && (
              <button onClick={() => { setQuery(''); setResults([]) }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">
                <X size={16} />
              </button>
            )}
          </div>

          {/* Results */}
          {isSearching && (
            <div className="text-center py-8 text-slate-500 text-sm">Mencari...</div>
          )}

          {results.length > 0 && (
            <div className="space-y-2">
              {results.map(p => (
                <ProductCard key={p.id} product={p} onAdd={() => handleAddToCart(p)} />
              ))}
            </div>
          )}

          {!isSearching && query && results.length === 0 && (
            <div className="text-center py-10 text-slate-500 text-sm">
              <Package className="mx-auto mb-2 opacity-30" size={32} />
              Produk tidak ditemukan
            </div>
          )}

          {!query && (
            <div className="text-center py-10 text-slate-600 text-sm">
              <Search className="mx-auto mb-2 opacity-20" size={32} />
              Ketik nama produk atau scan barcode
            </div>
          )}
        </div>
      )}

      {/* ── VIEW: CART ── */}
      {view === 'cart' && (
        <div className="px-4 pt-4 space-y-3">
          {items.length === 0 ? (
            <div className="text-center py-16 text-slate-600">
              <ShoppingCart className="mx-auto mb-3 opacity-20" size={40} />
              <p>Keranjang kosong</p>
              <button onClick={() => setView('search')} className="btn-ghost mt-4 text-sm px-6">
                Mulai Belanja
              </button>
            </div>
          ) : (
            <>
              {items.map(item => (
                <CartItemCard key={item.product_id} item={item} />
              ))}
              <div className="card p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <Tag size={14} className="text-slate-500" />
                  <span className="text-sm text-slate-400">Diskon Global</span>
                </div>
                <input
                  type="number"
                  className="input text-sm"
                  placeholder="0"
                  value={discount || ''}
                  onChange={e => setDiscount(Number(e.target.value))}
                />
              </div>
              <SummaryBar subtotal={subtotal} discount={discount} total={total} />
              <button onClick={() => setView('checkout')} className="btn-primary w-full flex items-center justify-center gap-2 py-4">
                Lanjut ke Pembayaran <ChevronRight size={18} />
              </button>
            </>
          )}
        </div>
      )}

      {/* ── VIEW: CHECKOUT ── */}
      {view === 'checkout' && (
        <div className="px-4 pt-4 space-y-4">
          {/* Customer Select */}
          <div className="card p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-300">
              <User size={16} className="text-amber-400" />Pelanggan (opsional)
            </div>
            {customer ? (
              <div className="flex items-center justify-between bg-slate-800/50 rounded-xl p-3">
                <div>
                  <p className="font-medium text-slate-200">{customer.name}</p>
                  <p className="text-xs text-slate-500">{customer.phone} • {customer.points ?? 0} poin</p>
                </div>
                <button onClick={() => setCustomer(null)} className="text-slate-500 hover:text-red-400">
                  <X size={18} />
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <input
                  className="input text-sm"
                  placeholder="Cari nama / no. HP..."
                  value={customerQuery}
                  onChange={e => handleCustomerSearch(e.target.value)}
                />
                {customerResults.map(c => (
                  <button key={c.id} onClick={() => { setCustomer(c); setCustomerResults([]) }}
                    className="w-full text-left bg-slate-800/50 hover:bg-slate-800 rounded-xl p-3 transition-colors">
                    <p className="font-medium text-sm text-slate-200">{c.name}</p>
                    <p className="text-xs text-slate-500">{c.phone}</p>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Payment Method */}
          <div className="card p-4 space-y-3">
            <p className="text-sm font-medium text-slate-300">Metode Pembayaran</p>
            <div className="grid grid-cols-2 gap-2">
              {paymentMethods.map(m => (
                <button key={m.id}
                  onClick={() => setPaymentMethod(m.id as any)}
                  className={clsx(
                    'border rounded-xl py-3 text-sm font-semibold transition-all',
                    paymentMethod === m.id ? m.color + ' border-current' : 'border-slate-700 text-slate-500 hover:border-slate-600'
                  )}>
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Amount Input */}
          {paymentMethod === 'cash' && (
            <div className="card p-4 space-y-3">
              <p className="text-sm font-medium text-slate-300">Uang Diterima</p>
              <input
                type="number"
                className="input text-xl font-bold text-amber-400 text-right"
                placeholder={String(total)}
                value={paidAmount || ''}
                onChange={e => setPaidAmount(Number(e.target.value))}
              />
              {/* Quick Amount Buttons */}
              <div className="grid grid-cols-3 gap-2">
                {[total, ...getQuickAmounts(total)].slice(0, 6).map(amt => (
                  <button key={amt} onClick={() => setPaidAmount(amt)}
                    className="bg-slate-800 hover:bg-slate-700 rounded-lg py-2 text-xs font-medium text-slate-300 transition-colors">
                    {formatCurrency(amt)}
                  </button>
                ))}
              </div>
              {paidAmount >= total && (
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 flex items-center justify-between">
                  <span className="text-sm text-emerald-400">Kembalian</span>
                  <span className="text-lg font-black text-emerald-400">{formatCurrency(change)}</span>
                </div>
              )}
            </div>
          )}

          <SummaryBar subtotal={subtotal} discount={discount} total={total} />

          <button
            onClick={handleCheckout}
            disabled={isProcessing || items.length === 0 || (paymentMethod === 'cash' && paidAmount < total)}
            className="btn-success w-full py-4 text-base disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
            {isProcessing ? 'Memproses...' : `Bayar ${formatCurrency(total)}`}
          </button>
        </div>
      )}

      <BottomNav />
    </div>
  )
}

// ─── SUB COMPONENTS ───────────────────────────────────────────────────────────

function ProductCard({ product, onAdd }: { product: any; onAdd: () => void }) {
  const inCart = useCartStore(s => s.items.some(i => i.product_id === product.id))
  const cartItem = useCartStore(s => s.items.find(i => i.product_id === product.id))
  const { updateQuantity, removeItem } = useCartStore()

  return (
    <div className="card p-3 flex items-center gap-3 active:scale-[0.99] transition-transform">
      <div className="w-12 h-12 bg-slate-800 rounded-xl flex items-center justify-center text-slate-400 shrink-0">
        <Package size={20} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm text-slate-200 truncate">{product.name}</p>
        <p className="text-xs text-slate-500">{product.unit} • Stok: {product.stock}</p>
        <p className="text-sm font-bold text-amber-400">{formatCurrency(product.sell_price)}</p>
      </div>
      {inCart ? (
        <div className="flex items-center gap-2">
          <button onClick={() => cartItem && updateQuantity(product.id, cartItem.quantity - 1)}
            className="w-8 h-8 bg-slate-800 hover:bg-red-500/20 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-400 transition-colors">
            <Minus size={14} />
          </button>
          <span className="w-6 text-center font-bold text-slate-200 text-sm">{cartItem?.quantity}</span>
          <button onClick={() => cartItem && updateQuantity(product.id, cartItem.quantity + 1)}
            className="w-8 h-8 bg-amber-500/20 hover:bg-amber-500/30 rounded-lg flex items-center justify-center text-amber-400 transition-colors">
            <Plus size={14} />
          </button>
        </div>
      ) : (
        <button onClick={onAdd}
          className="w-9 h-9 bg-amber-500/20 hover:bg-amber-500/30 rounded-xl flex items-center justify-center text-amber-400 transition-colors shrink-0">
          <Plus size={18} />
        </button>
      )}
    </div>
  )
}

function CartItemCard({ item }: { item: CartItem }) {
  const { updateQuantity, removeItem } = useCartStore()

  return (
    <div className="card p-3">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm text-slate-200 truncate">{item.name}</p>
          <p className="text-xs text-slate-500">{formatCurrency(item.sell_price)} / pcs</p>
          <p className="text-sm font-bold text-amber-400">{formatCurrency(item.subtotal)}</p>
        </div>
        <button onClick={() => removeItem(item.product_id)} className="text-slate-600 hover:text-red-400 transition-colors p-1">
          <Trash2 size={15} />
        </button>
      </div>
      <div className="flex items-center justify-between mt-2">
        <div className="flex items-center gap-3">
          <button onClick={() => updateQuantity(item.product_id, item.quantity - 1)}
            className="w-8 h-8 bg-slate-800 hover:bg-red-500/10 rounded-lg flex items-center justify-center text-slate-400 transition-colors">
            <Minus size={14} />
          </button>
          <span className="font-bold text-slate-200 w-6 text-center">{item.quantity}</span>
          <button onClick={() => updateQuantity(item.product_id, item.quantity + 1)}
            className="w-8 h-8 bg-slate-800 hover:bg-amber-500/20 rounded-lg flex items-center justify-center text-amber-400 transition-colors">
            <Plus size={14} />
          </button>
        </div>
        <span className="text-xs text-slate-500">{formatCurrency(item.sell_price)} × {item.quantity}</span>
      </div>
    </div>
  )
}

function SummaryBar({ subtotal, discount, total }: { subtotal: number; discount: number; total: number }) {
  return (
    <div className="card p-3 space-y-1.5">
      <div className="flex justify-between text-sm text-slate-400">
        <span>Subtotal</span><span>{formatCurrency(subtotal)}</span>
      </div>
      {discount > 0 && (
        <div className="flex justify-between text-sm text-red-400">
          <span>Diskon</span><span>-{formatCurrency(discount)}</span>
        </div>
      )}
      <div className="flex justify-between text-base font-black text-slate-100 pt-1 border-t border-slate-800">
        <span>TOTAL</span><span className="text-amber-400">{formatCurrency(total)}</span>
      </div>
    </div>
  )
}

function getQuickAmounts(total: number): number[] {
  const base = [5000, 10000, 20000, 50000, 100000]
  const rounded = Math.ceil(total / 10000) * 10000
  const roundedMore = rounded + 10000
  return [...new Set([rounded, roundedMore, ...base])].filter(v => v > total).sort((a, b) => a - b).slice(0, 5)
}

// Importing Package icon at top but let's make sure it's available
function Package(props: any) {
  return <svg {...props} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>
}
