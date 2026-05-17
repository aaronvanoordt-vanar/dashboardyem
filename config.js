// ====================================================================
// CONFIGURACION DEL DASHBOARD — EDITA ESTAS 3 LINEAS
// ====================================================================
// 1. SUPABASE_URL: tu URL de Supabase (algo como https://xxxx.supabase.co)
// 2. SUPABASE_ANON_KEY: la anon key publica de tu proyecto Supabase
//    (esta puede ir hardcoded porque las RLS la protegen — ver rls_policies.sql)
// 3. DASHBOARD_PASSWORD: clave simple para gate inicial (no es seguridad real,
//    solo evita que alguien que descubra la URL vea los datos accidentalmente)
// ====================================================================

const SUPABASE_URL       = "https://onyxefefimpiougoedii.supabase.co";
const SUPABASE_ANON_KEY  ="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ueXhlZmVmaW1waW91Z29lZGlpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1MjIyNzksImV4cCI6MjA5MTA5ODI3OX0.Rs0B1XkeQh1IwE6B2WNWG1TO80U-T9cF684Y5UfhqdI";
const DASHBOARD_PASSWORD = "yem2026";  // Cambialo a algo que solo Marcel y tu sepan

// ====================================================================
