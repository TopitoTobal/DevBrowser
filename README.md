# DevBrowser

Navegador web para desarrolladores construido con [Tauri v2](https://tauri.app), React, TypeScript y Tailwind CSS.

## Requisitos

- [Node.js](https://nodejs.org) 18+
- [Rust](https://rustup.rs) (stable)
- Windows: Visual Studio Build Tools con workload "Desktop development with C++"

## Desarrollo

```sh
npm install
npm run tauri dev
```

## Compilar

```sh
npm run tauri build
```

## Estructura

```
src/          Frontend (React + TypeScript + Tailwind)
src-tauri/    Backend nativo (Rust + Tauri v2)
```
