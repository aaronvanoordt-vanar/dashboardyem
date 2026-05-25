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
// SEND MESSAGE FROM DASHBOARD (opcional)
// Para que Marcel pueda enviar respuestas desde el dashboard:
// 1. Importa SEND_MESSAGE_WORKFLOW.json en n8n
// 2. En el nodo "Auth Check" reemplaza REEMPLAZAR_POR_TOKEN_SECRETO por una clave secreta larga
// 3. Pegá la misma clave aqui en SEND_AUTH_TOKEN
// 4. Pegá la Production URL del webhook en SEND_WEBHOOK_URL
// Si no querés enviar mensajes desde el dashboard, dejá ambos en string vacio.
// ====================================================================
const SEND_WEBHOOK_URL = "https://yemiraflores.app.n8n.cloud/webhook/yem-send-message"; // ej: https://tu-n8n.com/webhook/yem-send-message
const SEND_AUTH_TOKEN  = "marcel_send_2026_x8s9k2lm"; // la misma clave secreta que pongas en el workflow

// ====================================================================
