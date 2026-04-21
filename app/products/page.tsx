// app/products/page.tsx
'use client'
import { useState, useEffect } from 'react'
import { Plus, Search, Package, Edit2, AlertTriangle, X, Save } from 'lucide-react'
import { getProducts, upsertProduct, adjustStock } from '@/lib/db'
import { BottomNav } from '@/components/BottomNav'
import { formatCurrency } from '@/lib/utils'
import { clsx } from 'clsx'

type Tab = 'list' | 'add' | 'opname'

const emptyProduct = {
  name: '', barcode: '', description: '', buy_price: 0,
  sell_price: 0, stock: 0, min_stock: 5, unit: 'pcs', is_active: true
}

export default function ProductsPage() {
  const [tab, setTab] = useState<Tab>('list')
  const [products, setProducts] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(emptyProduct)
  const [editId, setEditId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [opnameTarget, setOpnameTarget] = useState<any>(null)
  const [newStock, setNewStock] = useState('')

  const load = async () => {
    setLoading(true)
    try { setProducts(await getProducts()) }
    catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.barcode && p.barcode.includes(search))
  )

  const handleSave = async () => {
    if (!form.name || form.sell_price <= 0) {
      alert('Nama dan harga jual wajib diisi')
      return
    }
    setSaving(true)
    try {
      await upsertProduct(editId ? { id: editId, ...form } : form)
      await load()
      setTab('list')
      setForm(emptyProduct)
      setEditId(null)
    } catch (e: any) { alert('Gagal: ' + e.message) }
    finally { setSaving(false) }
  }

  const handleEdit = (p: any) => {
    setEditId(p.id)
    setForm({ name: p.name, barcode: p.barcode || '', description: p.description || '',
      buy_price: p.buy_price, sell_price: p.sell_price, stock: p.stock,
      min_stock: p.min_stock, unit: p.unit, is_active: p.is_active })
    setTab('add')
  }

  const handleOpname = async () => {
    if (!opnameTarget || !newStock) return
    setSaving(true)
    try {
      await adjustStock(opnameTarget.id, Number(newStock), 'opname', '', 'SYSTEM')
      await load()
      setOpnameTarget(null)
    } catch (e: any) { alert('Gagal: ' + e.message) }
    finally { setSaving(false) }
  }

  const tabs = [
    { id: 'list', label: 'Daftar' },
    { id: 'add', label: editId ? 'Edit' : 'Tambah' },
    { id: 'opname', label: 'Stock Opname' },
  ]

  return (
    <div className="min-h-screen bg-slate-950 pb-safe max-w-lg mx-auto">
      <div className="sticky top-0 z-30 bg-slate-950/95 backdrop-blur border-b border-slate-800/60 px-4 pt-safe">
        <h1 className="font-black text-slate-100 py-3 text-lg">Manajemen Produk</h1>
        <div className="flex gap-1 pb-3">
          {tabs.map(t => (
            <button key={t.id} onClick={() => { setTab(t.id as Tab); if (t.id !== 'add') { setForm(emptyProduct); setEditId(null) } }}
              className={clsx('flex-1 py-2 text-xs font-semibold rounded-xl transition-all',
                tab === t.id ? 'bg-amber-500 text-slate-950' : 'bg-slate-900 text-slate-500 hover:text-slate-300'
              )}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 pt-4">
        {/* LIST */}
        {tab === 'list' && (
          <div className="space-y-3">
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input className="input pl-9 text-sm" placeholder="Cari produk..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            {loading ? (
              [...Array(5)].map((_, i) => <div key={i} className="card h-20 animate-pulse" />)
            ) : filtered.length === 0 ? (
              <div className="text-center py-10 text-slate-600">
                <Package className="mx-auto mb-2 opacity-20" size={32} />
                {search ? 'Produk tidak ditemukan' : 'Belum ada produk'}
              </div>
            ) : filtered.map(p => (
              <div key={p.id} className={clsx('card p-3 flex items-center gap-3',
                p.stock <= p.min_stock && 'border-orange-500/20')}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm text-slate-200 truncate">{p.name}</p>
                    {p.stock <= p.min_stock && <AlertTriangle size={12} className="text-orange-400 shrink-0" />}
                  </div>
                  {p.barcode && <p className="text-xs text-slate-600 font-mono">{p.barcode}</p>}
                  <div className="flex gap-3 mt-1">
                    <span className="text-xs text-slate-500">Beli: {formatCurrency(p.buy_price)}</span>
                    <span className="text-xs text-amber-400 font-medium">Jual: {formatCurrency(p.sell_price)}</span>
                    <span className={clsx('text-xs font-medium', p.stock === 0 ? 'text-red-400' : p.stock <= p.min_stock ? 'text-orange-400' : 'text-slate-400')}>
                      Stok: {p.stock} {p.unit}
                    </span>
                  </div>
                </div>
                <button onClick={() => handleEdit(p)} className="w-9 h-9 bg-slate-800 hover:bg-amber-500/20 rounded-xl flex items-center justify-center text-slate-400 hover:text-amber-400 transition-colors shrink-0">
                  <Edit2 size={15} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* ADD/EDIT FORM */}
        {tab === 'add' && (
          <div className="space-y-3">
            {[
              { label: 'Nama Produk *', key: 'name', type: 'text', placeholder: 'Contoh: Aqua 600ml' },
              { label: 'Barcode', key: 'barcode', type: 'text', placeholder: 'Scan atau ketik barcode' },
              { label: 'Harga Beli (Rp) *', key: 'buy_price', type: 'number', placeholder: '0' },
              { label: 'Harga Jual (Rp) *', key: 'sell_price', type: 'number', placeholder: '0' },
              { label: 'Stok Awal', key: 'stock', type: 'number', placeholder: '0' },
              { label: 'Stok Minimal (Alert)', key: 'min_stock', type: 'number', placeholder: '5' },
              { label: 'Satuan', key: 'unit', type: 'text', placeholder: 'pcs, botol, kg...' },
            ].map(f => (
              <div key={f.key}>
                <label className="text-xs text-slate-500 mb-1 block">{f.label}</label>
                <input
                  className="input text-sm"
                  type={f.type}
                  placeholder={f.placeholder}
                  value={(form as any)[f.key]}
                  onChange={e => setForm(prev => ({ ...prev, [f.key]: f.type === 'number' ? Number(e.target.value) : e.target.value }))}
                />
              </div>
            ))}
            {form.buy_price > 0 && form.sell_price > 0 && (
              <div className="card p-3 bg-emerald-500/5 border-emerald-500/20">
                <p className="text-xs text-slate-500">Margin Keuntungan</p>
                <p className="text-emerald-400 font-bold">
                  {formatCurrency(form.sell_price - form.buy_price)} ({((form.sell_price - form.buy_price) / form.sell_price * 100).toFixed(1)}%)
                </p>
              </div>
            )}
            <button onClick={handleSave} disabled={saving}
              className="btn-primary w-full py-4 flex items-center justify-center gap-2">
              <Save size={16} />{saving ? 'Menyimpan...' : editId ? 'Update Produk' : 'Simpan Produk'}
            </button>
          </div>
        )}

        {/* STOCK OPNAME */}
        {tab === 'opname' && (
          <div className="space-y-3">
            <p className="text-xs text-slate-500">Pilih produk dan masukkan stok aktual hasil hitungan fisik</p>
            {opnameTarget && (
              <div className="card p-4 border-amber-500/30 bg-amber-500/5 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-bold text-slate-200">{opnameTarget.name}</p>
                    <p className="text-xs text-slate-500">Stok sistem: {opnameTarget.stock} {opnameTarget.unit}</p>
                  </div>
                  <button onClick={() => setOpnameTarget(null)} className="text-slate-500"><X size={18} /></button>
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Stok Aktual (Fisik)</label>
                  <input type="number" className="input text-xl font-bold text-amber-400 text-center"
                    placeholder={String(opnameTarget.stock)} value={newStock}
                    onChange={e => setNewStock(e.target.value)} autoFocus />
                </div>
                {newStock && Number(newStock) !== opnameTarget.stock && (
                  <div className={clsx('rounded-xl p-3 text-sm text-center font-medium',
                    Number(newStock) > opnameTarget.stock ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400')}>
                    Selisih: {Number(newStock) > opnameTarget.stock ? '+' : ''}{Number(newStock) - opnameTarget.stock} {opnameTarget.unit}
                  </div>
                )}
                <button onClick={handleOpname} disabled={saving || !newStock}
                  className="btn-primary w-full py-3 disabled:opacity-50">
                  {saving ? 'Menyimpan...' : 'Simpan Opname'}
                </button>
              </div>
            )}
            <div className="space-y-2">
              {products.filter(p => p.is_active).map(p => (
                <button key={p.id} onClick={() => { setOpnameTarget(p); setNewStock('') }}
                  className={clsx('w-full text-left card p-3 hover:border-amber-500/30 transition-colors active:scale-[0.99]',
                    opnameTarget?.id === p.id && 'border-amber-500/40 bg-amber-500/5')}>
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-sm text-slate-200">{p.name}</p>
                    <span className={clsx('badge', p.stock <= 0 ? 'bg-red-500/20 text-red-400' : p.stock <= p.min_stock ? 'bg-orange-500/20 text-orange-400' : 'bg-slate-800 text-slate-400')}>
                      {p.stock} {p.unit}
                    </span>
                  </div>
                  {p.barcode && <p className="text-xs text-slate-600 font-mono mt-0.5">{p.barcode}</p>}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  )
}
