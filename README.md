# YEM Pipeline Dashboard — v2

Dashboard profesional de visibilidad del pipeline de Young Engineers Miraflores. Arquitectura modular, multi-página, sin build step. Se hostea estático en GitHub Pages y se conecta directo a Supabase con RLS read-only.

## Características

- **4 vistas** con sidebar de navegación:
  - 📊 **Overview** — KPIs, leads urgentes, timeline 30d, salud del bot, feed de actividad reciente.
  - 🎯 **Pipeline** — Vista Kanban con columnas por etapa (New → Qualifying → Active → Trial Slot → Ready to Enroll → Human).
  - 👥 **Leads** — Tabla completa con filtros (búsqueda, etapa, programa, solo-humano), sort por cualquier columna, export CSV.
  - 📈 **Analytics** — Métricas profundas: evolución de leads, embudo de conversión, distribución de intents, carga por agente, resumen por programa, selector de período (7/30/90/365 días).

- **Drawer de detalle de lead** (sliding panel) con 3 tabs:
  - 💬 Conversación completa (historial WhatsApp).
  - ℹ️ Info estructurada del lead.
  - 📋 Timeline de actividad (interacciones, agentes, intents).
  - Acciones rápidas: abrir WhatsApp Web, copiar teléfono, copiar resumen.

- **Auto-refresh cada 30s** + botón manual de refresh.
- **Estado en vivo** (indicador en sidebar: conectando / en vivo / error).
- **Export CSV** de leads filtrados con un click.
- **Toasts** de feedback.
- **Diseño dark mode** profesional con Inter font, design tokens consistentes.
- **Responsive** hasta tablet (mobile ok pero pensado para desktop).

## Estructura

```
dashboard/
├── index.html              ← shell (sidebar, topbar, drawer)
├── config.js               ← tus credenciales (NO commitear si fuera privado)
├── styles/
│   ├── base.css            ← tokens, reset, tipografía, layout
│   └── components.css      ← cards, tablas, modales, kanban, etc.
├── js/
│   ├── main.js             ← entry point, gate, polling, router setup
│   ├── api.js              ← wrapper de Supabase
│   ├── state.js            ← pub/sub state
│   ├── router.js           ← hash router
│   ├── utils.js            ← formatters, helpers, CSV export
│   └── pages/
│       ├── overview.js
│       ├── pipeline.js
│       ├── leads.js
│       ├── analytics.js
│       └── lead-detail.js  ← drawer (componente, no página)
├── rls_policies.sql        ← (aplicar en Supabase antes de exponer la anon key)
└── README.md
```

Todo es ES modules nativos (no necesita build/bundle). GitHub Pages sirve esto perfectamente.

## Setup (15 minutos)

### 1. Aplica las RLS en Supabase
Si NO lo hiciste antes, corre `rls_policies.sql` en Supabase SQL editor. CRÍTICO antes de exponer la anon key.

### 2. Configura `config.js`
Reemplaza los 3 valores:
- `SUPABASE_URL` → tu Project URL
- `SUPABASE_ANON_KEY` → tu anon key
- `DASHBOARD_PASSWORD` → la clave que comparte sólo Marcel y vos

### 3. Sube a GitHub
- Crea repo público `yem-dashboard` en GitHub
- Sube TODOS los archivos de la carpeta `dashboard/` excepto `rls_policies.sql` (ese va sólo en Supabase, no en el repo)
- Estructura del repo:
  ```
  yem-dashboard/
  ├── index.html
  ├── config.js
  ├── styles/base.css
  ├── styles/components.css
  ├── js/main.js
  ├── js/api.js
  ├── js/state.js
  ├── js/router.js
  ├── js/utils.js
  └── js/pages/...
  ```

### 4. Activa GitHub Pages
Settings → Pages → branch `main` → folder `/ (root)` → Save.

### 5. Compartí con Marcel
URL: `https://tuusuario.github.io/yem-dashboard/` + la clave.

## Cómo usa Marcel el dashboard

**Diario:**
1. Abre la URL, entra la clave (queda guardada hasta cerrar el navegador).
2. Mira el **Overview**: los KPIs del estado actual, qué leads están calientes esperando acción, qué está haciendo el bot.
3. Click en cualquier lead urgente → drawer con TODA la conversación → click "Abrir WhatsApp" → atiende directo.

**Semanal:**
4. Va a **Pipeline** para ver el flujo Kanban: cuántos leads en cada etapa, dónde se atascan.
5. Va a **Analytics** para ver la evolución de leads, embudo de conversión, qué programas convierten más.
6. Exporta CSV desde **Leads** si necesita compartir con su equipo o hacer análisis externo.

## Seguridad

- La anon key de Supabase queda visible en el JS público. Esto es **seguro siempre que las RLS read-only estén aplicadas** (ver `rls_policies.sql`).
- El password del gate NO es seguridad real, solo es para evitar que cualquiera que encuentre la URL vea data. Si querés seguridad real, agregamos Supabase Auth con login real.

## Tecnologías

- **HTML/CSS vanilla** — sin frameworks, sin build step.
- **JS ES modules** — sintaxis moderna `import/export`, soportada nativamente en navegadores modernos.
- **Supabase JS client** (vía CDN) — para queries a Supabase.
- **Chart.js** (vía CDN) — para gráficos.
- **Inter** + **JetBrains Mono** (Google Fonts) — tipografía.

## Para extender

- Agregar una página nueva: crea `js/pages/mi-pagina.js` con función `render()`, regístrala en `main.js` con `registerRoute("mi-pagina", miPagina.render)`, y agrega un `<a>` en el sidebar de `index.html` con `data-route="mi-pagina"`.
- Agregar un KPI nuevo: edita `js/pages/overview.js` función `renderKPIs`.
- Agregar una columna a la tabla: edita `js/pages/leads.js` (función `renderTable`) y, opcionalmente, agrega header con `sortable` en `render()`.
- Cambiar el threshold de "lead activo" (de 7 días a otro): edita la constante en `js/pages/overview.js` función `renderKPIs`.

## Troubleshooting

Si el dashboard no carga datos:
1. Abrí DevTools (F12) → Console. Cualquier error rojo te dice qué pasa.
2. Errores comunes:
   - `invalid jwt` / `401` → anon key mal copiada en config.js
   - `permission denied for table leads` → no aplicaste rls_policies.sql en Supabase
   - `config.js no se cargo` → archivo `config.js` no está en el root del repo o tiene otro nombre
3. Si el sidebar no responde a clicks de navegación: refrescá con Ctrl+Shift+R (caché del navegador).
