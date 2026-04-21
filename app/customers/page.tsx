// app/customers/page.tsx
'use client'
import { useState, useEffect } from 'react'
import { Plus, Search, User, CreditCard, ChevronRight, X, DollarSign } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { searchCustomers, getCustomerDebts, payDebt } from '@/lib/db'
import { BottomNav } from '@/components/BottomNav'
import { formatCurrency } from '@/lib/utils'
import { format, parseISO } from 'date-fns'
import { id as idLocale } from 'date-fns/locale'
import { clsx } from 'clsx'

type View = 'list' | 'detail' | 'add'

export default function CustomersPage() {
  const [view, setView] = useState<View>('list')
  const [customers, setCustomers] = useState<any[]>([])
  const [selected, setSelected] = useState<any>(null)
  const [debts, setDebts] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ name: '', phone: '', email: '', address: '' })
  const [saving, setSaving] = useState(false)
  const [payModal, setPayModal] = useState<any>(null)
  const [payAmount, setPayAmount] = useState('')

  const db = supabase()

  const loadCustomers = async () => {
    setLoading(true)
    try {
      const q = search
        ? await db.from('customers').select('*').or(`name.ilike.%${search}%,phone.ilike.%${search}%`).order('name')
        : await db.from('customers').select('*').order('name')
      setCustomers(q.data ?? [])
    } finally { setLoading(false) }
  }

  useEffect(() => { loadCustomers() }, [search])

  const openDetail = async (c: any) => {
    setSelected(c)
    const d = await getCustomerDebts(c.id)
    setDebts(d)
    setView('detail')
  }

  const handleAddCustomer = async () => {
    if (!form.name) { alert('Nama wajib diisi'); return }
    setSaving(true)
    try {
      await db.from('customers').insert(form)
      await loadCustomers()
      setView('list')
      setForm({ name: '', phone: '', email: '', address: '' })
    } catch (e: any) { alert('Gagal: ' + e.message) }
    finally { setSaving(false) }
  }

  const handlePayDebt = async () => {
    if (!payModal || !payAmount) return
    setSaving(true)
    try {
      await payDebt(payModal.id, Number(payAmount), 'SYSTEM', 'cash', '')
      const d = await getCustomerDebts(selected.id)
      setDebts(d)
      setPayModal(null)
      setPayAmount('')
    } catch (e: any) { alert('Gagal: ' + e.message) }
    finally { setSaving(false) }
  }

  const totalDebt = debts.filter(d => d.status !== 'paid').reduce((s, d) => s + d.remaining_amount, 0)

  return (
    <div className="min-h-screen bg-slate-950 pb-safe max-w-lg mx-auto">
      <div className="sticky top-0 z-30 bg-slate-950/95 backdrop-blur border-b border-slate-800/60 px-4 pt-safe">
        <div className="flex items-center justify-between py-3">
          {view !== 'list' && (
            <button onClick={() => { setView('list'); setSelected(null) }} className="w-9 h-9 bg-slate-900 rounded-xl flex items-center justify-center text-slate-400 mr-2">
              <X size={18} />
            </button>
          )}
          <h1 className="font-black text-slate-100 text-lg flex-1">
            {view === 'list' ? 'Pelanggan' : view === 'add' ? 'Tambah Pelanggan' : selected?.name}
          </h1>
          {view === 'list' && (
            <button onClick={() => setView('add')} className="w-9 h-9 bg-amber-500/20 rounded-xl flex items-center justify-center text-amber-400">
              <Plus size={18} />
            </button>
          )}
        </div>
      </div>

      <div className="px-4 pt-4">
        {/* LIST VIEW */}
        {view === 'list' && (
          <div className="space-y-3">
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input className="input pl-9 text-sm" placeholder="Cari nama atau nomor HP..."
                value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            {loading ? [...Array(5)].map((_, i) => <div key={i} className="card h-16 animate-pulse" />) :
              customers.length === 0 ? (
                <div className="text-center py-10 text-slate-600">
                  <User className="mx-auto mb-2 opacity-20" size={32} />Belum ada pelanggan
                </div>
              ) : customers.map(c => (
                <button key={c.id} onClick={() => openDetail(c)}
                  className="w-full text-left card p-3 flex items-center gap-3 hover:border-slate-700 transition-colors active:scale-[0.99]">
                  <div className="w-10 h-10 bg-slate-800 rounded-full flex items-center justify-center text-slate-400 shrink-0">
                    <User size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-slate-200">{c.name}</p>
                    <p className="text-xs text-slate-500">{c.phone || '-'}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-slate-500">Total Belanja</p>
                    <p className="text-sm font-bold text-amber-400">{formatCurrency(c.total_spent)}</p>
                  </div>
                  <ChevronRight size={16} className="text-slate-700 shrink-0" />
                </button>
              ))
            }
          </div>
        )}

        {/* ADD VIEW */}
        {view === 'add' && (
          <div className="space-y-3">
            {[
              { label: 'Nama *', key: 'name', type: 'text', placeholder: 'Nama lengkap' },
              { label: 'No. HP', key: 'phone', type: 'tel', placeholder: '08xxxxxxxxxx' },
              { label: 'Email', key: 'email', type: 'email', placeholder: 'email@contoh.com' },
              { label: 'Alamat', key: 'address', type: 'text', placeholder: 'Alamat lengkap' },
            ].map(f => (
              <div key={f.key}>
                <label className="text-xs text-slate-500 mb-1 block">{f.label}</label>
                <input className="input text-sm" type={f.type} placeholder={f.placeholder}
                  value={(form as any)[f.key]}
                  onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))} />
              </div>
            ))}
            <button onClick={handleAddCustomer} disabled={saving} className="btn-primary w-full py-4">
              {saving ? 'Menyimpan...' : 'Simpan Pelanggan'}
            </button>
          </div>
        )}

        {/* DETAIL VIEW */}
        {view === 'detail' && selected && (
          <div className="space-y-4">
            {/* Profile Card */}
            <div className="card p-4">
              <div className="flex gap-4">
                <div className="w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center">
                  <User size={28} className="text-slate-400" />
                </div>
                <div className="flex-1">
                  <p className="font-bold text-slate-100">{selected.name}</p>
                  <p className="text-sm text-slate-500">{selected.phone || '-'}</p>
                  <div className="flex gap-3 mt-2">
                    <div className="text-center">
                      <p className="text-xs text-slate-500">Total Belanja</p>
                      <p className="text-sm font-bold text-amber-400">{formatCurrency(selected.total_spent)}</p>
                    </div>
                    <div className="w-px bg-slate-800" />
                    <div className="text-center">
                      <p className="text-xs text-slate-500">Poin</p>
                      <p className="text-sm font-bold text-emerald-400">{selected.points}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Hutang Summary */}
            {totalDebt > 0 && (
              <div className="card p-4 border-red-500/20 bg-red-500/5">
                <div className="flex items-center gap-2 mb-1">
                  <CreditCard size={16} className="text-red-400" />
                  <span className="font-bold text-red-400">Total Hutang</span>
                </div>
                <p className="text-2xl font-black text-red-400">{formatCurrency(totalDebt)}</p>
              </div>
            )}

            {/* Debt List */}
            <div>
              <h3 className="font-bold text-sm text-slate-400 mb-2">Riwayat Hutang</h3>
              {debts.length === 0 ? (
                <div className="text-center py-6 text-slate-600 text-sm">Tidak ada hutang</div>
              ) : debts.map(d => (
                <div key={d.id} className={clsx('card p-3 mb-2 border',
                  d.status === 'paid' ? 'border-emerald-500/20 bg-emerald-500/5' :
                  d.status === 'partial' ? 'border-amber-500/20 bg-amber-500/5' :
                  'border-red-500/20 bg-red-500/5')}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="text-xs text-slate-500">{d.transactions?.invoice_number}</p>
                      <p className="text-xs text-slate-600">
                        {d.created_at && format(parseISO(d.created_at), 'd MMM yyyy', { locale: idLocale })}
                      </p>
                      <div className="flex gap-3 mt-1">
                        <div>
                          <p className="text-[10px] text-slate-600">Total</p>
                          <p className="text-xs font-medium text-slate-400">{formatCurrency(d.original_amount)}</p>
                        </div>
                        {d.status !== 'paid' && (
                          <div>
                            <p className="text-[10px] text-slate-600">Sisa</p>
                            <p className="text-xs font-bold text-red-400">{formatCurrency(d.remaining_amount)}</p>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className={clsx('badge text-[10px]',
                        d.status === 'paid' ? 'bg-emerald-500/20 text-emerald-400' :
                        d.status === 'partial' ? 'bg-amber-500/20 text-amber-400' :
                        'bg-red-500/20 text-red-400')}>
                        {d.status === 'paid' ? 'Lunas' : d.status === 'partial' ? 'Cicil' : 'Belum Lunas'}
                      </span>
                      {d.status !== 'paid' && (
                        <button onClick={() => { setPayModal(d); setPayAmount(String(d.remaining_amount)) }}
                          className="text-[10px] bg-amber-500/20 text-amber-400 px-2 py-1 rounded-lg flex items-center gap-1">
                          <DollarSign size={10} />Bayar
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Pay Debt Modal */}
      {payModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg bg-slate-900 rounded-2xl p-5 space-y-4 border border-slate-800">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-100">Bayar Hutang</h3>
              <button onClick={() => setPayModal(null)} className="text-slate-500"><X size={20} /></button>
            </div>
            <div className="bg-slate-800/50 rounded-xl p-3">
              <p className="text-xs text-slate-500">Sisa hutang</p>
              <p className="text-xl font-black text-red-400">{formatCurrency(payModal.remaining_amount)}</p>
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Jumlah Pembayaran</label>
              <input type="number" className="input text-xl font-bold text-center text-amber-400"
                value={payAmount} onChange={e => setPayAmount(e.target.value)} />
            </div>
            <button onClick={handlePayDebt} disabled={saving || !payAmount}
              className="btn-success w-full py-4 disabled:opacity-50">
              {saving ? 'Memproses...' : 'Konfirmasi Pembayaran'}
            </button>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  )
}
