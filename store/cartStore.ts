// store/cartStore.ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface CartItem {
  id: string
  product_id: string
  name: string
  barcode?: string
  sell_price: number
  buy_price: number
  quantity: number
  discount: number
  subtotal: number
}

export interface CartCustomer {
  id: string
  name: string
  phone?: string
  points?: number
}

interface CartState {
  items: CartItem[]
  customer: CartCustomer | null
  discount: number
  paymentMethod: 'cash' | 'transfer' | 'qris' | 'debt'
  paidAmount: number
  notes: string

  // Actions
  addItem: (product: Omit<CartItem, 'quantity' | 'subtotal'>) => void
  removeItem: (productId: string) => void
  updateQuantity: (productId: string, qty: number) => void
  updateItemDiscount: (productId: string, discount: number) => void
  setCustomer: (customer: CartCustomer | null) => void
  setDiscount: (discount: number) => void
  setPaymentMethod: (method: CartState['paymentMethod']) => void
  setPaidAmount: (amount: number) => void
  setNotes: (notes: string) => void
  clearCart: () => void

  // Computed
  getSubtotal: () => number
  getTotal: () => number
  getChange: () => number
  getItemCount: () => number
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      customer: null,
      discount: 0,
      paymentMethod: 'cash',
      paidAmount: 0,
      notes: '',

      addItem: (product) => {
        const existing = get().items.find(i => i.product_id === product.product_id)
        if (existing) {
          set(state => ({
            items: state.items.map(i =>
              i.product_id === product.product_id
                ? { ...i, quantity: i.quantity + 1, subtotal: (i.quantity + 1) * (i.sell_price - i.discount) }
                : i
            )
          }))
        } else {
          set(state => ({
            items: [...state.items, {
              ...product,
              quantity: 1,
              discount: 0,
              subtotal: product.sell_price
            }]
          }))
        }
      },

      removeItem: (productId) => set(state => ({
        items: state.items.filter(i => i.product_id !== productId)
      })),

      updateQuantity: (productId, qty) => {
        if (qty <= 0) { get().removeItem(productId); return }
        set(state => ({
          items: state.items.map(i =>
            i.product_id === productId
              ? { ...i, quantity: qty, subtotal: qty * (i.sell_price - i.discount) }
              : i
          )
        }))
      },

      updateItemDiscount: (productId, discount) => set(state => ({
        items: state.items.map(i =>
          i.product_id === productId
            ? { ...i, discount, subtotal: i.quantity * (i.sell_price - discount) }
            : i
        )
      })),

      setCustomer: (customer) => set({ customer }),
      setDiscount: (discount) => set({ discount }),
      setPaymentMethod: (paymentMethod) => set({ paymentMethod }),
      setPaidAmount: (paidAmount) => set({ paidAmount }),
      setNotes: (notes) => set({ notes }),

      clearCart: () => set({
        items: [],
        customer: null,
        discount: 0,
        paymentMethod: 'cash',
        paidAmount: 0,
        notes: ''
      }),

      getSubtotal: () => get().items.reduce((sum, i) => sum + i.subtotal, 0),
      getTotal: () => {
        const subtotal = get().getSubtotal()
        return Math.max(0, subtotal - get().discount)
      },
      getChange: () => get().paidAmount - get().getTotal(),
      getItemCount: () => get().items.reduce((sum, i) => sum + i.quantity, 0),
    }),
    {
      name: 'kasirku-cart',
      partialize: (state) => ({ items: state.items, customer: state.customer }),
    }
  )
)
