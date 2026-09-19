-- =============================================================================
-- KHATA LEDGER ENTERPRISE - SUPABASE POSTGRESQL DATABASE SCHEMA
-- Target Database: postgresql://postgres:Devansh2004passw@db.hobqauofjovwdttvqmpt.supabase.co:5432/postgres
-- =============================================================================

-- Enable UUID Extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- -----------------------------------------------------------------------------
-- 1. USERS TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(100) NOT NULL DEFAULT 'ACCOUNTANT',
    avatar_url TEXT,
    phone VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- -----------------------------------------------------------------------------
-- 2. WORKSPACES TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.workspaces (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'INR',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- -----------------------------------------------------------------------------
-- 3. PARTIES TABLE (CUSTOMERS & SUPPLIERS)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.parties (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    email VARCHAR(255),
    type VARCHAR(50) NOT NULL DEFAULT 'CUSTOMER', -- 'CUSTOMER' or 'SUPPLIER'
    address TEXT,
    opening_balance NUMERIC(15, 2) DEFAULT 0.00,
    current_balance NUMERIC(15, 2) DEFAULT 0.00,
    version INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- -----------------------------------------------------------------------------
-- 4. TRANSACTIONS TABLE (YOU GAVE / YOU GOT)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    party_id UUID NOT NULL REFERENCES public.parties(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL, -- 'GAVE' (Debit / Receivable) or 'GOT' (Credit / Payable)
    amount NUMERIC(15, 2) NOT NULL,
    payment_mode VARCHAR(50) DEFAULT 'CASH', -- 'CASH', 'UPI', 'BANK_TRANSFER', 'CHEQUE'
    category VARCHAR(100) DEFAULT 'GENERAL',
    notes TEXT,
    date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    version INTEGER DEFAULT 1,
    sync_status VARCHAR(50) DEFAULT 'SYNCHRONIZED',
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- -----------------------------------------------------------------------------
-- 5. ATTACHMENTS TABLE (RECEIPTS & INVOICES)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.attachments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_id UUID NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
    filename VARCHAR(255) NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    size_bytes BIGINT NOT NULL,
    sha256 VARCHAR(64) NOT NULL,
    storage_path TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- -----------------------------------------------------------------------------
-- 6. USER PREFERENCES TABLE (THEME & LANGUAGE)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_preferences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    theme VARCHAR(20) DEFAULT 'dark', -- 'dark' or 'light'
    language VARCHAR(10) DEFAULT 'EN', -- 'EN' or 'HI'
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- -----------------------------------------------------------------------------
-- 7. SYNC LOGS & BACKUPS AUDIT TRAIL TABLES
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sync_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    device_id VARCHAR(255) NOT NULL,
    items_count INTEGER NOT NULL,
    conflicts_resolved INTEGER DEFAULT 0,
    status VARCHAR(50) NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.backups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    filename VARCHAR(255) NOT NULL,
    size_bytes BIGINT NOT NULL,
    type VARCHAR(50) NOT NULL, -- 'AUTOMATED' or 'MANUAL'
    status VARCHAR(50) NOT NULL, -- 'SUCCESS' or 'FAILED'
    checksum VARCHAR(64),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.user_backups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    workspace_id UUID NOT NULL,
    backup_name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL DEFAULT 'MANUAL',
    data_json TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- -----------------------------------------------------------------------------
-- PERFORMANCE INDEXES
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_workspaces_user_id ON public.workspaces(user_id);
CREATE INDEX IF NOT EXISTS idx_parties_workspace_id ON public.parties(workspace_id);
CREATE INDEX IF NOT EXISTS idx_transactions_workspace_id ON public.transactions(workspace_id);
CREATE INDEX IF NOT EXISTS idx_transactions_party_id ON public.transactions(party_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON public.transactions(date);
CREATE INDEX IF NOT EXISTS idx_attachments_transaction_id ON public.attachments(transaction_id);

-- -----------------------------------------------------------------------------
-- ROW LEVEL SECURITY (RLS) POLICIES FOR SUPABASE
-- -----------------------------------------------------------------------------
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

-- Allow public service access policy
CREATE POLICY "Allow public read/write service access" ON public.users FOR ALL USING (true);
CREATE POLICY "Allow public read/write service access" ON public.workspaces FOR ALL USING (true);
CREATE POLICY "Allow public read/write service access" ON public.parties FOR ALL USING (true);
CREATE POLICY "Allow public read/write service access" ON public.transactions FOR ALL USING (true);
CREATE POLICY "Allow public read/write service access" ON public.attachments FOR ALL USING (true);
CREATE POLICY "Allow public read/write service access" ON public.user_preferences FOR ALL USING (true);
