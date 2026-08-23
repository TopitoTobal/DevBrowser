# Progreso del proyecto

> Lista para retomar el trabajo. Los issues oficiales están en GitHub:
> https://github.com/TopitoTobal/DevBrowser/issues

## Estado actual (última sesión: 23-08-2026)

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

# Compilar ejecutable final
npm run tauri build
```
