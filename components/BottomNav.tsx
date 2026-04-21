// components/BottomNav.tsx
'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ShoppingCart, LayoutDashboard, Package, Users, FileText } from 'lucide-react'
import { useCartStore } from '@/store/cartStore'
import { clsx } from 'clsx'

const navItems = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/pos', icon: ShoppingCart, label: 'Kasir', badge: true },
  { href: '/products', icon: Package, label: 'Produk' },
  { href: '/customers', icon: Users, label: 'Pelanggan' },
  { href: '/reports', icon: FileText, label: 'Laporan' },
]

export function BottomNav() {
  const pathname = usePathname()
  const itemCount = useCartStore(s => s.getItemCount())

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-slate-900/95 backdrop-blur-md 
                    border-t border-slate-800 bottom-nav max-w-lg mx-auto">
      <div className="flex items-center justify-around px-2 py-2">
        {navItems.map(({ href, icon: Icon, label, badge }) => {
          const active = pathname.startsWith(href)
          return (
            <Link key={href} href={href} className="flex-1">
              <div className={clsx(
                'flex flex-col items-center gap-1 py-1.5 px-2 rounded-xl transition-all duration-200',
                active ? 'text-amber-400' : 'text-slate-500 hover:text-slate-300'
              )}>
                <div className="relative">
                  <Icon size={22} strokeWidth={active ? 2.5 : 1.8} />
                  {badge && itemCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 bg-amber-500 text-slate-950 
                                     text-[9px] font-black rounded-full w-4 h-4 flex items-center 
                                     justify-center leading-none">
                      {itemCount > 9 ? '9+' : itemCount}
                    </span>
                  )}
                </div>
                <span className={clsx(
                  'text-[10px] font-medium leading-none',
                  active ? 'text-amber-400' : ''
                )}>
                  {label}
                </span>
              </div>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
