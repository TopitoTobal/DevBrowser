# Progreso del proyecto

> Lista para retomar el trabajo. Los issues oficiales están en GitHub:
> https://github.com/TopitoTobal/DevBrowser/issues

## Estado actual (última sesión: 02-10-2026)

GitHub #1–#3 completados y cerrados. GitHub #4–#23 pendientes (ver "Pendientes"
abajo). Ojo con la numeración: este TODO tuvo su propia #4 ("escaneo periódico"),
que **no** corresponde al issue #4 de GitHub ("workspace").

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

### ✅ Escaneo periódico de servidores locales (task del TODO, sin issue en GitHub)
COMPLETADO (commit `ed86c51`).
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

## Pendientes (GitHub #4–#23)

Sincronizado con `gh issue list` el 02-10-2026. Todos están `OPEN` y sin labels.

### Red / navegación
- [#4](https://github.com/TopitoTobal/DevBrowser/issues/4) workspace — espacios
  aislados por proyecto con pestañas, storage y cookies propias
- [#5](https://github.com/TopitoTobal/DevBrowser/issues/5) aislamiento de cookies —
  mismo sitio con 3-4 roles a la vez sin incógnito
- [#10](https://github.com/TopitoTobal/DevBrowser/issues/10) soporte https local —
  generar e instalar certificados SSL locales para evitar avisos de conexión
  insegura (**hecho, ver arriba**)
- [#15](https://github.com/TopitoTobal/DevBrowser/issues/15) contenedores y remotos —
  source maps y rutas correctas con Docker / Dev Containers / SSH / WSL
- [#18](https://github.com/TopitoTobal/DevBrowser/issues/18) proxy de red — mockear
  JSON, modificar headers, simular errores y latencia

### DevTools / debug
- [#6](https://github.com/TopitoTobal/DevBrowser/issues/6) render simultáneo —
  móvil/tablet/desktop lado a lado con scroll sincronizado
- [#7](https://github.com/TopitoTobal/DevBrowser/issues/7) inspector de layout —
  medir distancias, CSS computed, variables, contraste WCAG
- [#8](https://github.com/TopitoTobal/DevBrowser/issues/8) terminal integrada —
  panel inferior para `npm run dev`, git, logs
- [#11](https://github.com/TopitoTobal/DevBrowser/issues/11) jump to source —
  Cmd/Ctrl+Click sobre un elemento abre el editor en la línea exacta
- [#12](https://github.com/TopitoTobal/DevBrowser/issues/12) source mapping preciso —
  stack traces con rutas de origen en Vite/Next/Turbopack/Webpack
- [#13](https://github.com/TopitoTobal/DevBrowser/issues/13) detección de proyecto —
  sugerir abrir el dev server cuando arranca en un puerto
- [#14](https://github.com/TopitoTobal/DevBrowser/issues/14) terminal de proceso —
  stdout/stderr del servidor local en una pestaña lateral
- [#22](https://github.com/TopitoTobal/DevBrowser/issues/22) accesibilidad WCAG —
  marcar contraste, ARIA faltante y estructura HTML inválida
- [#23](https://github.com/TopitoTobal/DevBrowser/issues/23) monitoreo de recursos —
  memoria del WebView y alertas de leaks en la barra de estado

### Producto / UX
- [#9](https://github.com/TopitoTobal/DevBrowser/issues/9) captura de bugs —
  screenshots/grabaciones con contexto listo para un issue
- [#16](https://github.com/TopitoTobal/DevBrowser/issues/16) contexto de error para IA —
  mandar error a editor/asistente con DOM y logs adjuntos
- [#17](https://github.com/TopitoTobal/DevBrowser/issues/17) extensiones de usuario —
  APIs de web extensions y WASM
- [#19](https://github.com/TopitoTobal/DevBrowser/issues/19) paleta de comandos —
  Cmd/Ctrl+K para limpiar datos, cambiar User-Agent, saltar a rutas
- [#20](https://github.com/TopitoTobal/DevBrowser/issues/20) lector documentación offline —
  buscar firmas y APIs sin abrir Google
- [#21](https://github.com/TopitoTobal/DevBrowser/issues/21) inspector de estado global —
  Redux/Zustand/Pinia/React Context en pestaña nativa

Orden sugerido por dependencia: #13 (ya casi listo, solo falta sugerir abrir) →
#4 (workspace) → #5 → #12 → #11.

### ✅ GitHub #10 — Soporte HTTPS local
COMPLETADO.
- `src-tauri/src/certs.rs`: CA propia generada con `rcgen` (Ed25519), instalada
  en el almacén **ROOT del usuario** con `certutil -user` (sin admin ni UAC) y
  desinstalable. Comandos `local_ca_status`, `local_ca_install`,
  `local_ca_remove`
- Emite un certificado hoja para `localhost`, `*.localhost`, `127.0.0.1` y
  `::1` en `app_data_dir()/certs/localhost.{crt,key}` (PEM, listo para
  `server.https` de Vite); la UI copia el snippet de configuración
- Tarjeta "HTTPS local" en la página de nueva pestaña con estados
  Sin CA / Sin confiar / Confiable, botón de desinstalar y **confirmación
  explícita** antes de tocar el almacén de certificados
- Idempotente: si la CA existe se reutiliza y solo se renueva el leaf; antes de
  instalar borra CAs previas con el mismo CN (si no, Windows encadena el leaf
  contra la CA vieja y el handshake falla)
- **Limitación conocida**: el leaf es estático y no cubre IPs de LAN ni hosts
  inventados; para eso haría falta emitir un cert por host (como mkcert)
- Verificación: se comprobó end-to-end que un `https://localhost` servido con
  el leaf generado es aceptado por el verificador de Windows. Rutas manuales en
  `cargo test -- --ignored` (`local_ca_install_smoke` / `local_ca_remove_smoke`,
  excluidas de CI porque mutan el almacén del sistema)
- Tests: 9 en Rust (2 de ellos manuales) + 31 en frontend

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

# Smoke manual de la CA local (muta el almacén de certificados del usuario)
cargo test -- --ignored
cd ..

# Compilar ejecutable final
npm run tauri build
```
