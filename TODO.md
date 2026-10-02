# Progreso del proyecto

> Lista para retomar el trabajo. Los issues oficiales están en GitHub:
> https://github.com/TopitoTobal/DevBrowser/issues

## Estado actual (última sesión: 02-10-2026)

Issues #1 a #4 completados.

### ✅ Infraestructura de calidad (tests + lint + formato + CI)
Sin issue asociado. Añadida para sostener el crecimiento del proyecto.
- Vitest + Testing Library (jsdom): 24 tests sobre `src/lib/url.ts`
  (`normalizeUrl`, `urlLabel`) y el reducer de `src/context/TabsContext.tsx`
  (`npm test`). Se exportaron `reducer`, `initialState` y los tipos
  `TabsState`/`TabsAction` del contexto para poder testearlos.
- ESLint 10 (flat config) + typescript-eslint + eslint-plugin-react-hooks:
  `npm run lint`. Se desactiva `react-hooks/set-state-in-effect` porque
  AddressBar/BrowserView sincronizan intencionadamente estado local con props
  dentro de efectos.
- Prettier 3: `npm run format` / `npm run format:check`. `TODO.md` está en
  `.prettierignore` (se mantiene a mano).
- CI (`.github/workflows/ci.yml`): job frontend (lint + format + tests +
  build) en ubuntu y job backend (cargo clippy `-D warnings`) en windows.
- Bug corregido: el efecto del AddressBar no tenía `activeTab?.url` en sus
  dependencias, así que la barra no reflejaba navegaciones externas al tab
  (p. ej. los botones del issue #4). Ahora sí se sincroniza.

### ✅ Issue #1 — Setup inicial con Tauri v2 + React + TypeScript + Tailwind
COMPLETADO y pusheado (commit `87d8832`).
- Tauri v2 con plantilla React/TypeScript
- Tailwind CSS v4 configurado (plugin de Vite)
- Verificado: compila y abre ventana nativa
- Entorno listo: Node v24, Rust 1.98, VS Build Tools instalados

### ✅ Issue #2 — Barra de navegación y pestañas
COMPLETADO.
- [x] Tipos: `src/types.ts`
- [x] Estado global: `src/context/TabsContext.tsx` (contexto + reducer,
      acciones: new-tab, close-tab, set-active-tab, navigate)
- [x] Componente `src/components/TabBar.tsx` (pestañas activas, cerrar, botón +)
- [x] Componente `src/components/AddressBar.tsx` (input de URL que navega al
      presionar Enter; atrás/adelante/recargar se activan en el issue #3)
- [x] Conectar todo en `src/App.tsx` con el layout del navegador
- [x] Verificado con `npm run build`

### ✅ Issue #3 — Contenedor Webview
COMPLETADO.
- Webviews nativos por pestaña (Tauri v2 multi-webview con feature `unstable`):
  crear, navegar, mostrar/ocultar al cambiar de pestaña, cerrar al eliminarla
  (`src-tauri/src/lib.rs`, comandos `webview_*`)
- Sincronización de bounds del área de contenido con `ResizeObserver`
- Protocolo https:// por defecto (`src/lib/url.ts`); validación http/https
  también en Rust, y bloqueo de esquemas no permitidos vía `on_navigation`
- Manejo básico de errores: URL inválida marcada en la barra, errores de
  invoke mostrados en overlay; errores de red los renderiza WebView2 nativo
- Botones atrás/adelante/recargar conectados a los webviews
- Indicador de carga (barra superior) con eventos `page-load`
- Detección automática de servidores locales en la barra de direcciones:
  `:3000` / `3000` → `http://localhost:3000`; hosts/IPs locales
  (localhost, 127.x, 192.168.x, 10.x, 172.16-31.x, *.local, sin puntos)
  usan http; dominio con puerto explícito también usa http

### ✅ Issue #4 — Escaneo periódico de servidores locales
COMPLETADO.
- `src-tauri/src/lib.rs`: comando async `scan_local_servers(known: Vec<u16>)`,
  handshake TCP a 127.0.0.1 con `tokio::time::timeout(150ms)` y `JoinSet`
  (26 puertos comunes + los conocidos del ciclo anterior), dedup y ordenado
- `src-tauri/Cargo.toml`: `tokio = { version = "1", features = ["net", "time"] }`
  (1.53 ya era transitivo de Tauri, no suma tiempo de compilación)
- `src/lib/native.ts`: wrapper `scanLocalServers(known)`
- `src/hooks/useLocalServers.ts`: escaneo cada 5 s, cache = resultado anterior,
  pausa con `document.hidden`, reanuda y refresca en `visibilitychange`, ignora
  errores (modo navegador sin bridge de Tauri) y evita `setState` si no cambió
- `src/components/BrowserView.tsx`: sección "Servidores locales" en la página
  de nueva pestaña; clic → `navigate` a `http://localhost:<puerto>`. El escaneo
  solo corre mientras la página de inicio está visible
- Tests: 3 en Rust (`cargo test`, incluido en CI) que verifican la fusión de
  puertos, el descarte de puertos inválidos y que el handshake detecta un puerto
  real con listener; 24 en frontend

## Notas técnicas
- El Webview real se integra por pestaña; cada pestaña conserva su estado al
  cambiar entre ellas (se oculta/muestra en vez de recargar)
- Los webviews remotos no tienen permisos IPC (capabilities solo aplican a la
  ventana `main`)
- `Logo.png` está en la raíz; más adelante se puede usar como icono de la app
  con `npx tauri icon Logo.png`

## Comandos

```powershell
cd C:\Users\sexon\Desktop\Browdev

# Abrir la app en modo desarrollo (ventana nativa)
npm run tauri dev

# Solo frontend en el navegador (más rápido para UI)
npm run dev        # http://localhost:1420

# Verificar que todo compila
npm run build

# Tests, lint y formato
npm test
npm run lint
npm run format:check

# Tests y lint del backend Rust
cd src-tauri
cargo test
cargo clippy --all-targets -- -D warnings
cargo fmt
cd ..

# Compilar ejecutable final
npm run tauri build
```
