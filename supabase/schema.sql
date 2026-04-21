-- ============================================
-- POS & INVENTORY SYSTEM - SUPABASE SCHEMA
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. PROFILES (extends Supabase auth.users)
-- ============================================
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'kasir' CHECK (role IN ('admin', 'kasir')),
  phone TEXT,
  avatar_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 2. CATEGORIES
-- ============================================
CREATE TABLE public.categories (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  color TEXT DEFAULT '#6366f1',
  icon TEXT DEFAULT 'package',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 3. PRODUCTS
-- ============================================
CREATE TABLE public.products (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  barcode TEXT UNIQUE,
  description TEXT,
  buy_price DECIMAL(15,2) NOT NULL DEFAULT 0,
  sell_price DECIMAL(15,2) NOT NULL DEFAULT 0,
  stock INTEGER NOT NULL DEFAULT 0,
  min_stock INTEGER NOT NULL DEFAULT 5,
  unit TEXT DEFAULT 'pcs',
  image_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast barcode/name search
CREATE INDEX idx_products_barcode ON public.products(barcode);
CREATE INDEX idx_products_name ON public.products USING gin(to_tsvector('indonesian', name));

-- ============================================
-- 4. CUSTOMERS
-- ============================================
CREATE TABLE public.customers (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT UNIQUE,
  email TEXT,
  address TEXT,
  points INTEGER DEFAULT 0,
  total_spent DECIMAL(15,2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 5. TRANSACTIONS
-- ============================================
CREATE TABLE public.transactions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  invoice_number TEXT UNIQUE NOT NULL,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  cashier_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  subtotal DECIMAL(15,2) NOT NULL DEFAULT 0,
  discount_amount DECIMAL(15,2) DEFAULT 0,
  tax_amount DECIMAL(15,2) DEFAULT 0,
  total_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
  paid_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
  change_amount DECIMAL(15,2) DEFAULT 0,
  payment_method TEXT DEFAULT 'cash' CHECK (payment_method IN ('cash', 'transfer', 'qris', 'debt')),
  status TEXT DEFAULT 'completed' CHECK (status IN ('completed', 'cancelled', 'debt')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_transactions_created ON public.transactions(created_at DESC);
CREATE INDEX idx_transactions_invoice ON public.transactions(invoice_number);

-- ============================================
-- 6. TRANSACTION ITEMS
-- ============================================
CREATE TABLE public.transaction_items (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  transaction_id UUID REFERENCES public.transactions(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  product_barcode TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  buy_price DECIMAL(15,2) NOT NULL DEFAULT 0,
  sell_price DECIMAL(15,2) NOT NULL DEFAULT 0,
  discount_per_item DECIMAL(15,2) DEFAULT 0,
  subtotal DECIMAL(15,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_transaction_items_txn ON public.transaction_items(transaction_id);

-- ============================================
-- 7. DEBTS (HUTANG PIUTANG)
-- ============================================
CREATE TABLE public.debts (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE NOT NULL,
  original_amount DECIMAL(15,2) NOT NULL,
  remaining_amount DECIMAL(15,2) NOT NULL,
  due_date DATE,
  status TEXT DEFAULT 'unpaid' CHECK (status IN ('unpaid', 'partial', 'paid')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 8. DEBT PAYMENTS
-- ============================================
CREATE TABLE public.debt_payments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  debt_id UUID REFERENCES public.debts(id) ON DELETE CASCADE NOT NULL,
  cashier_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  amount DECIMAL(15,2) NOT NULL,
  payment_method TEXT DEFAULT 'cash',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 9. STOCK ADJUSTMENTS (STOCK OPNAME)
-- ============================================
CREATE TABLE public.stock_adjustments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
  adjusted_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  stock_before INTEGER NOT NULL,
  stock_after INTEGER NOT NULL,
  adjustment INTEGER NOT NULL,
  reason TEXT DEFAULT 'opname' CHECK (reason IN ('opname', 'damage', 'return', 'correction', 'purchase')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- FUNCTIONS & TRIGGERS
-- ============================================

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_products_updated BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_customers_updated BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_debts_updated BEFORE UPDATE ON public.debts FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Auto-generate invoice number
CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS TEXT AS $$
DECLARE
  v_date TEXT := TO_CHAR(NOW(), 'YYYYMMDD');
  v_count INTEGER;
  v_invoice TEXT;
BEGIN
  SELECT COUNT(*) + 1 INTO v_count FROM public.transactions WHERE DATE(created_at) = CURRENT_DATE;
  v_invoice := 'INV-' || v_date || '-' || LPAD(v_count::TEXT, 4, '0');
  RETURN v_invoice;
END;
$$ LANGUAGE plpgsql;

-- Reduce stock on transaction
CREATE OR REPLACE FUNCTION reduce_stock_on_transaction()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.products
  SET stock = stock - NEW.quantity
  WHERE id = NEW.product_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_reduce_stock AFTER INSERT ON public.transaction_items FOR EACH ROW EXECUTE FUNCTION reduce_stock_on_transaction();

-- Update customer total_spent
CREATE OR REPLACE FUNCTION update_customer_stats()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.customer_id IS NOT NULL AND NEW.status = 'completed' THEN
    UPDATE public.customers
    SET total_spent = total_spent + NEW.total_amount,
        points = points + FLOOR(NEW.total_amount / 10000)
    WHERE id = NEW.customer_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_customer_stats AFTER INSERT ON public.transactions FOR EACH ROW EXECUTE FUNCTION update_customer_stats();

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transaction_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debt_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_adjustments ENABLE ROW LEVEL SECURITY;

-- Helper: get current user role
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS TEXT AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- Profiles: users see own, admin sees all
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT USING (id = auth.uid() OR get_my_role() = 'admin');
CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE USING (id = auth.uid() OR get_my_role() = 'admin');
CREATE POLICY "profiles_insert" ON public.profiles FOR INSERT WITH CHECK (id = auth.uid());

-- Products: authenticated users can read, admin can write
CREATE POLICY "products_select" ON public.products FOR SELECT TO authenticated USING (true);
CREATE POLICY "products_insert" ON public.products FOR INSERT TO authenticated WITH CHECK (get_my_role() = 'admin');
CREATE POLICY "products_update" ON public.products FOR UPDATE TO authenticated USING (get_my_role() = 'admin');
CREATE POLICY "products_delete" ON public.products FOR DELETE TO authenticated USING (get_my_role() = 'admin');

-- Categories: same as products
CREATE POLICY "categories_select" ON public.categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "categories_write" ON public.categories FOR ALL TO authenticated USING (get_my_role() = 'admin');

-- Customers: authenticated users can read/write
CREATE POLICY "customers_all" ON public.customers FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Transactions: kasir can insert, admin sees all, kasir sees own
CREATE POLICY "transactions_select" ON public.transactions FOR SELECT TO authenticated USING (cashier_id = auth.uid() OR get_my_role() = 'admin');
CREATE POLICY "transactions_insert" ON public.transactions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "transactions_update" ON public.transactions FOR UPDATE TO authenticated USING (get_my_role() = 'admin');

-- Transaction items: follows transaction access
CREATE POLICY "txn_items_select" ON public.transaction_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "txn_items_insert" ON public.transaction_items FOR INSERT TO authenticated WITH CHECK (true);

-- Debts
CREATE POLICY "debts_all" ON public.debts FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "debt_payments_all" ON public.debt_payments FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Stock adjustments: admin only for insert, all can read
CREATE POLICY "stock_adj_select" ON public.stock_adjustments FOR SELECT TO authenticated USING (true);
CREATE POLICY "stock_adj_insert" ON public.stock_adjustments FOR INSERT TO authenticated WITH CHECK (get_my_role() = 'admin');

-- ============================================
-- SEED DATA
-- ============================================
INSERT INTO public.categories (name, color, icon) VALUES
  ('Makanan', '#f59e0b', 'utensils'),
  ('Minuman', '#06b6d4', 'coffee'),
  ('Snack', '#f97316', 'cookie'),
  ('Kebersihan', '#10b981', 'sparkles'),
  ('Rokok', '#6b7280', 'cigarette'),
  ('Lainnya', '#8b5cf6', 'package');
