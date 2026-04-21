// app/reports/page.tsx
'use client'
import { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight, TrendingUp, Receipt, ArrowDownLeft } from 'lucide-react'
import { getTransactions, getMonthlySales } from '@/lib/db'
import { BottomNav } from '@/components/BottomNav'
import { formatCurrency } from '@/lib/utils'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { format, parseISO, startOfMonth, endOfMonth } from 'date-fns'
import { id as idLocale } from 'date-fns/locale'

export default function ReportsPage() {
  const [date, setDate] = useState(new Date())
  const [transactions, setTransactions] = useState<any[]>([])
  const [chartData, setChartData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try {
      const [txns, chart] = await Promise.all([
        getTransactions(100),
        getMonthlySales(date.getFullYear(), date.getMonth() + 1),
      ])
      const start = startOfMonth(date)
      const end = endOfMonth(date)
      const filtered = txns.filter(t => {
        const d = new Date(t.created_at)
        return d >= start && d <= end && t.status === 'completed'
      })
      setTransactions(filtered)
      setChartData(chart.map(d => ({
        ...d,
        label: format(parseISO(d.date), 'd', { locale: idLocale }),
      })))
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [date])

  const prevMonth = () => setDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))
  const nextMonth = () => setDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))

  const totalRevenue = transactions.reduce((s, t) => s + t.total_amount, 0)
  const totalTxn = transactions.length
  const avgTxn = totalTxn > 0 ? totalRevenue / totalTxn : 0

  const paymentBreakdown = transactions.reduce((acc: Record<string, number>, t) => {
    acc[t.payment_method] = (acc[t.payment_method] ?? 0) + t.total_amount
    return acc
  }, {})

  const paymentLabels: Record<string, string> = { cash: 'Tunai', transfer: 'Transfer', qris: 'QRIS', debt: 'Hutang' }
  const paymentColors: Record<string, string> = { cash: 'text-emerald-400', transfer: 'text-blue-400', qris: 'text-purple-400', debt: 'text-red-400' }

  return (
    <div className="min-h-screen bg-slate-950 pb-safe max-w-lg mx-auto">
      <div className="sticky top-0 z-30 bg-slate-950/95 backdrop-blur border-b border-slate-800/60 px-4 pt-safe">
        <div className="flex items-center justify-between py-3">
          <h1 className="font-black text-slate-100 text-lg">Laporan</h1>
          <div className="flex items-center gap-2 bg-slate-900 rounded-xl px-2 py-1.5">
            <button onClick={prevMonth} className="p-1 text-slate-500 hover:text-slate-300 transition-colors">
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm font-medium text-slate-300 min-w-[100px] text-center">
              {format(date, 'MMM yyyy', { locale: idLocale })}
            </span>
            <button onClick={nextMonth} className="p-1 text-slate-500 hover:text-slate-300 transition-colors">
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      <div className="px-4 pt-4 space-y-4">
        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Pendapatan', value: formatCurrency(totalRevenue), icon: TrendingUp, color: 'text-amber-400' },
            { label: 'Transaksi', value: totalTxn, icon: Receipt, color: 'text-blue-400' },
            { label: 'Rata-rata', value: formatCurrency(avgTxn), icon: ArrowDownLeft, color: 'text-emerald-400' },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="card p-3">
              <Icon size={14} className={`${color} mb-1.5`} />
              <p className={`text-sm font-black ${color}`}>{value}</p>
              <p className="text-[10px] text-slate-600 mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* Chart */}
        <div className="card p-4">
          <h2 className="text-sm font-bold text-slate-400 mb-4">Penjualan Harian</h2>
          {loading ? (
            <div className="h-40 flex items-center justify-center text-slate-600 text-sm">Loading...</div>
          ) : chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={chartData} margin={{ top: 4, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.07)" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 9 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#64748b', fontSize: 9 }} axisLine={false} tickLine={false}
                  tickFormatter={v => v >= 1000000 ? `${(v / 1000000).toFixed(1)}jt` : v >= 1000 ? `${(v / 1000).toFixed(0)}rb` : v} />
                <Tooltip
                  contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 12, fontSize: 11 }}
                  formatter={(v: any) => [formatCurrency(v), 'Penjualan']}
                  cursor={{ fill: 'rgba(245,158,11,0.1)' }}
                />
                <Bar dataKey="revenue" fill="#f59e0b" radius={[4, 4, 0, 0]} maxBarSize={24} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-40 flex items-center justify-center text-slate-600 text-sm">Belum ada data</div>
          )}
        </div>

        {/* Payment Breakdown */}
        {Object.keys(paymentBreakdown).length > 0 && (
          <div className="card p-4">
            <h2 className="text-sm font-bold text-slate-400 mb-3">Metode Pembayaran</h2>
            <div className="space-y-2">
              {Object.entries(paymentBreakdown).map(([method, amount]) => (
                <div key={method} className="flex items-center justify-between">
                  <span className={`text-sm font-medium ${paymentColors[method] ?? 'text-slate-400'}`}>
                    {paymentLabels[method] ?? method}
                  </span>
                  <span className="text-sm font-bold text-slate-300">{formatCurrency(amount as number)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent Transactions */}
        <div>
          <h2 className="text-sm font-bold text-slate-400 mb-2">Transaksi Bulan Ini ({totalTxn})</h2>
          {loading ? (
            [...Array(3)].map((_, i) => <div key={i} className="card h-14 mb-2 animate-pulse" />)
          ) : transactions.length === 0 ? (
            <div className="text-center py-8 text-slate-600 text-sm">Belum ada transaksi</div>
          ) : transactions.slice(0, 30).map(t => (
            <div key={t.id} className="card p-3 mb-2 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-300">{t.invoice_number}</p>
                <p className="text-[10px] text-slate-600">
                  {format(parseISO(t.created_at), 'd MMM, HH:mm', { locale: idLocale })}
                  {t.customers && ` • ${t.customers.name}`}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-amber-400">{formatCurrency(t.total_amount)}</p>
                <p className="text-[10px] text-slate-600">{paymentLabels[t.payment_method] ?? t.payment_method}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <BottomNav />
    </div>
  )
}
