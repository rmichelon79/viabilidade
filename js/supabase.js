// ─── Cliente Supabase — Plataforma Sopra (login único) ──────────────────────
// Carregado via ESM (o app já roda como type="module").
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

export const SB_URL = 'https://cgnuelmiacweybmvlbcm.supabase.co'
// anon key — pública por design (vai no front mesmo). RLS protege os dados.
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNnbnVlbG1pYWN3ZXlibXZsYmNtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcyMDM0ODMsImV4cCI6MjA5Mjc3OTQ4M30.l02F-jt6CSgZf7wd5Dz0IY6jB9gCLzM6Iny7EsZLNSw'

export const SBC = createClient(SB_URL, SB_KEY, {
  auth: { persistSession: true, autoRefreshToken: true },
})
