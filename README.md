# CapturaLibros

Aplicación de escritorio moderna y premium para la captura, recorte y renombrado inteligente de archivos PDF de libros.

## Tecnologías Utilizadas

- **Electron:** Proceso principal y de precarga.
- **Vite + Vanilla JS:** Entorno de desarrollo rápido y lógica frontend.
- **CSS Custom Properties (Vanilla):** Diseño estilo glassmorphism con soporte nativo de modo oscuro.
- **pnpm:** Gestor de paquetes ultrarrápido.
- **pdf-lib:** Procesamiento y recorte local de archivos PDF.

## Requisitos

- [Node.js](https://nodejs.org/) (v18 o superior recomendado)
- [pnpm](https://pnpm.io/) (`npm install -g pnpm`)

## Ejecución en Desarrollo

1. Asegúrate de tener las dependencias instaladas:
   ```bash
   pnpm install
   ```

2. Inicia el servidor de desarrollo de Vite (deja este proceso activo):
   ```bash
   pnpm run dev
   ```

3. Inicia la aplicación de Electron en otra terminal:
   ```bash
   pnpm start
   ```