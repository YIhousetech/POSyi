// app/dashboard/page.tsx
'use client'
import { useEffect, useState } from 'react'
import { TrendingUp, ShoppingBag, AlertTriangle, CreditCard, RefreshCw } from 'lucide-react'
import { getDashboardStats, getMonthlySales } from '@/lib/db'
import { BottomNav } from '@/components/BottomNav'
import { formatCurrency } from '@/lib/utils'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { format, parseISO } from 'date-fns'
import { id } from 'date-fns/locale'

export default function DashboardPage() {
  const [stats, setStats] = useState<any>(null)
  const [chartData, setChartData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const now = new Date()

  const load = async () => {
    setLoading(true)
    try {
      const [s, c] = await Promise.all([
        getDashboardStats(),
        getMonthlySales(now.getFullYear(), now.getMonth() + 1),
      ])
      setStats(s)
      setChartData(c.map(d => ({ ...d, label: format(parseISO(d.date), 'd MMM', { locale: id }) })))
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const statCards = stats ? [
    {
      label: 'Pendapatan Hari Ini',
      value: formatCurrency(stats.today_revenue),
      icon: TrendingUp,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10 border-emerald-500/20',
    },
    {
      label: 'Transaksi',
      value: stats.today_transactions,
      icon: ShoppingBag,
      color: 'text-amber-400',
      bg: 'bg-amber-500/10 border-amber-500/20',
    },
    {
      label: 'Hutang Belum Lunas',
      value: formatCurrency(stats.total_unpaid_debt),
      icon: CreditCard,
      color: 'text-red-400',
      bg: 'bg-red-500/10 border-red-500/20',
    },
    {
      label: 'Stok Hampir Habis',
      value: stats.low_stock_count,
      icon: AlertTriangle,
      color: 'text-orange-400',
      bg: 'bg-orange-500/10 border-orange-500/20',
    },
  ] : []

  return (
    <div className="min-h-screen bg-slate-950 pb-safe max-w-lg mx-auto">
      <div className="px-4 pt-safe">
        {/* Header */}
        <div className="flex items-center justify-between py-4">
          <div>
            <h1 className="text-xl font-black text-slate-100">Dashboard</h1>
            <p className="text-xs text-slate-500">
              {format(now, 'EEEE, d MMMM yyyy', { locale: id })}
            </p>
          </div>
          <button onClick={load} className="w-9 h-9 bg-slate-900 rounded-xl flex items-center justify-center text-slate-400 hover:text-amber-400 transition-colors">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 gap-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="card p-4 h-24 animate-pulse bg-slate-900" />
            ))}
          </div>
        ) : (
          <>
            {/* Stat Cards */}
            <div className="grid grid-cols-2 gap-3">
              {statCards.map(({ label, value, icon: Icon, color, bg }) => (
                <div key={label} className={`card border p-4 ${bg}`}>
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 ${bg}`}>
                    <Icon size={16} className={color} />
                  </div>
                  <p className={`text-lg font-black ${color}`}>{value}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{label}</p>
                </div>
              ))}
            </div>

            {/* Sales Chart */}
            <div className="card p-4 mt-4">
              <h2 className="font-bold text-sm text-slate-300 mb-4">
                Penjualan — {format(now, 'MMMM yyyy', { locale: id })}
              </h2>
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={180}>
                  <AreaChart data={chartData} margin={{ top: 4, right: 0, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.07)" />
                    <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#64748b', fontSize: 9 }} axisLine={false} tickLine={false}
                      tickFormatter={v => v >= 1000000 ? `${(v / 1000000).toFixed(1)}jt` : v >= 1000 ? `${(v / 1000).toFixed(0)}rb` : v} />
                    <Tooltip
                      contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 12, fontSize: 12 }}
                      labelStyle={{ color: '#94a3b8' }}
                      formatter={(v: any) => [formatCurrency(v), 'Penjualan']}
                    />
                    <Area type="monotone" dataKey="revenue" stroke="#f59e0b" strokeWidth={2}
                      fill="url(#salesGradient)" dot={{ fill: '#f59e0b', r: 3 }} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-40 flex items-center justify-center text-slate-600 text-sm">
                  Belum ada data bulan ini
                </div>
              )}
            </div>

            {/* Low Stock Alert */}
            {stats?.low_stock_products?.length > 0 && (
              <div className="card p-4 mt-4 mb-4 border-orange-500/20 bg-orange-500/5">
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle size={16} className="text-orange-400" />
                  <h2 className="font-bold text-sm text-orange-400">Peringatan Stok</h2>
                </div>
                <div className="space-y-2">
                  {stats.low_stock_products.map((p: any) => (
                    <div key={p.id} className="flex items-center justify-between py-1.5 border-b border-slate-800/50 last:border-0">
                      <span className="text-sm text-slate-300 truncate flex-1">{p.name}</span>
                      <span className={`badge ml-2 ${p.stock === 0 ? 'bg-red-500/20 text-red-400' : 'bg-orange-500/20 text-orange-400'}`}>
                        {p.stock} {p.unit}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
      <BottomNav />
    </div>
  )
}
