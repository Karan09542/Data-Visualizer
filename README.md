# 🌌 Data Visualizer

### *Visual Developer Workspace, Executable Node Canvas & Multi-Tool Studio*

[![React 19](https://img.shields.io/badge/React-19.0-61dafb?style=flat-square&logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178c6?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6.2-646cff?style=flat-square&logo=vite)](https://vitejs.dev/)
[![Tailwind CSS v4](https://img.shields.io/badge/TailwindCSS-4.1-38bdf8?style=flat-square&logo=tailwindcss)](https://tailwindcss.com/)
[![WebAssembly / Pyodide](https://img.shields.io/badge/Pyodide-Python_in_WASM-3776ab?style=flat-square&logo=python)](https://pyodide.org/)
[![PWA Ready](https://img.shields.io/badge/PWA-Offline_Ready-5A0FC8?style=flat-square&logo=pwa)](https://web.dev/progressive-web-apps/)
[![Client-Side Privacy](https://img.shields.io/badge/Privacy-100%25_Client--Side-10b981?style=flat-square)](https://github.com/)

---

## 🌟 Overview

**Data Visualizer** is a high-performance visual tree visualizer, developer playground, and graph-based execution environment. It transforms static hierarchical data (**JSON, YAML, CSV**) into **living, executable logical nodes** that can be queried, edited, connected, and run in real-time.

Running **100% client-side** in your browser with zero server storage, it combines isolated background Web Workers (**Pyodide WebAssembly**), client-side JavaScript/TypeScript sandboxes, live REST API nodes, dynamic mathematical formula graphing, WebRTC encrypted peer-to-peer file sharing, and a rich media & image processing suite.

---

## 🚀 Key Features & Superpowers

### 1. 🧩 Multi-Node Sandbox System
* **🐍 Python Execution Nodes (Pyodide in Web Workers)**:
  * Runs genuine Python in isolated background Web Workers with zero main-thread freezing.
  * **Virtual DOM & Download Shim**: Intercepts `Blob` and `.click()` calls inside workers to seamlessly trigger native browser downloads.
  * **Dynamic Package Resolution**: Analyzes imports on-the-fly with `micropip` (NumPy, SymPy, Pandas, etc.) with an interactive missing package installer modal.
  * **Inline Charts & Graphics**: Intercepts `matplotlib` figures and renders graphics directly within node output viewports.
* **⚡ JavaScript & TypeScript Nodes**:
  * Execute sandboxed scripts to transform JSON trees, calculate metrics, and orchestrate canvas workflows.
  * Dedicated per-node terminal console with isolated logging.
* **🌐 Live REST API Nodes**:
  * Test `GET`, `POST`, `PUT`, `DELETE` endpoints directly on canvas with live URL and header editors.
  * Automatic response schema mapping: transforms raw JSON payloads into interactive visual graph branches.
* **🗄️ JSON & YAML Primitives**:
  * Deeply nested tree explorer with in-place key/value editing, type switching, branch collapsing, and search.

---

### 2. 👁️ Three Viewing Perspectives
Switch between perspectives depending on your analytical or developmental needs:
1. **Interactive Graph Canvas**: Fluid node-link visualization powered by D3 and vector layout algorithms with 50+ customizable themes, custom edge curves, and minimap navigation.
2. **Schema View**: High-level structural architecture summary displaying field types, cardinality, and schemas without UI clutter.
3. **Table Mode**: Converts nested arrays, collections, and CSVs into high-density, sortable, paginated spreadsheet grids.

---

### 3. 📐 Dynamic Math & Calculus Grapher (Mafs)
* Plot mathematical formulas, LaTeX equations, parametric curves, and step-by-step calculus.
* Real-time interactive coordinate sliders, movable point gizmos, vector fields, and trigonometric plots.

---

### 4. 🔒 WebRTC P2P Encrypted File Sharing
* Direct device-to-device transfers using WebRTC DataChannels and QR code pairing.
* End-to-end encrypted with zero intermediary server storage.
* Stream-to-disk capability for large files without memory exhaustion.

---

### 5. 🛠️ Integrated Quick Utilities Studio
A native micro-tool suite built right into the app—no external websites or cloud services required:
* **Advanced Crop Studio**: Pixel-perfect cropping with predefined aspect ratios (YouTube, Instagram, TikTok, LinkedIn), custom shapes (circle, star, rounded, polygon), live rotation, mobile drawer resize controls, and high-res PNG/JPEG/WebP export.
* **AI & Image Studio**: Neural Style Transfer, Background Remover, Image Upscaler, Low-Light Enhancer, and Image Depth Estimator.
* **Document & Media Utilities**:
  * PDF Viewer & Merger, Image-to-PDF compiler
  * Image Slicer & Sticker Maker
  * Audio Waveform Visualizer & Media Player
  * 3D Model Viewer (`.glb` / `.gltf` powered by Google `<model-viewer>` & Three.js)
* **Developer Essentials**:
  * JWT Decoder & Token Inspector
  * Cryptographic Hash Generator (SHA-256, MD5, SHA-512)
  * Base64 Encoder / Decoder & Color Palette Thief

---

### 6. 🎓 Learning Games
Build your own vocabulary and practice it with games. Open it with **Learn** in the toolbar (the graduation cap on phones).
* **My Words**: add words with a meaning and an example sentence, organize them into sets, paste whole lists from notes or a spreadsheet, and track mastery per word.
* **Crossword**: meanings become clues. Swipe or tap the letters on a letter wheel to spell the answer and it drops into its place in the grid, or switch to typing with a keyboard. Each word is checked as you finish it, with letter hints or a full reveal when you're stuck.
* **Results & Review**: score, time and a word-by-word breakdown after every game, plus one tap to practice the words you missed.
* **Offline-first**: everything is saved automatically to the Origin Private File System, with IndexedDB as a fallback, and stays in sync across open tabs.
* **Pluggable**: game rules live in `src/learning/games/` apart from the UI, so new games (matching, fill-in-the-blank, unscramble) register alongside the crossword.

---

## 🛡️ Architectural & Privacy Guarantees

| Guarantee | How It Works |
| :--- | :--- |
| **100% Client-Side** | Zero remote database. Your code, API keys, JSON data, and uploaded files never leave your browser sandbox. |
| **WebAssembly Sandboxing** | Pyodide and heavy computation run in dedicated Web Workers with execution timeouts to prevent UI locking. |
| **Safe Preview Sandboxing** | Rendered outputs and external previews run inside hardened `SafeIframe` instances with restricted attributes. |
| **Offline & PWA Ready** | Full Progressive Web App support with service worker caching, IndexedDB (Dexie) persistence, and auto-save. |

---

## 💻 Tech Stack

* **Frontend Framework**: [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
* **Build Tool**: [Vite 6](https://vitejs.dev/) with `@tailwindcss/vite`
* **Styling**: [Tailwind CSS v4](https://tailwindcss.com/) + Vanilla CSS design system
* **Visual Graph Engine**: [D3.js](https://d3js.org/), [XYFlow / ReactFlow](https://reactflow.dev/), [Dagre](https://github.com/dagrejs/dagre)
* **Code Sandboxes**: [Pyodide](https://pyodide.org/) (Python WebAssembly in Web Workers), [Monaco Editor](https://microsoft.github.io/monaco-editor/)
* **Math Graphing**: [Mafs](https://mafs.dev/) + [KaTeX](https://katex.org/) + [MathJS](https://mathjs.org/)
* **Media & 3D**: [Three.js](https://threejs.org/), [@google/model-viewer](https://modelviewer.dev/), [Fabric.js](http://fabricjs.com/)
* **State & Storage**: [Zustand](https://github.com/pmndrs/zustand), [Dexie.js (IndexedDB)](https://dexie.org/)
* **PWA & Caching**: [vite-plugin-pwa](https://vite-pwa-org.netlify.app/), Workbox

---

## 🏁 Getting Started

### Prerequisites
* **Node.js**: v18.0.0 or higher
* **npm** or **pnpm** / **yarn**

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/your-username/data-visualizer.git
   cd data-visualizer/Data-Visualizer
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment Variables** *(Optional - for AI assistant features)*:
   Create a `.env.local` file in the root directory:
   ```env
   GEMINI_API_KEY=your_gemini_api_key_here
   ```

4. **Launch Development Server**:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📦 Available Scripts

| Command | Description |
| :--- | :--- |
| `npm run dev` | Starts the local Vite development server at `http://localhost:3000` |
| `npm run build` | Compiles and bundles production assets + PWA Service Worker |
| `npm run preview` | Locally serves the production build for testing |
| `npm run lint` | Performs strict TypeScript type checks (`tsc --noEmit`) |
| `npm run clean` | Cleans previous build artifacts (`rm -rf dist`) |

---

## 📂 Project Structure

```text
Data-Visualizer/
├── src/
│   ├── ai/                      # AI Assistants, prompt templates, and models
│   ├── components/
│   │   ├── utilities/           # Quick Tools (ImageCropUtil, StyleTransfer, PDF, etc.)
│   │   ├── nodes/               # Graph canvas nodes (Python, JS, API, JSON primitives)
│   │   └── ui/                  # Reusable UI components (Modals, Selects, Buttons)
│   ├── learning/                # Learning Games: vocabulary, game modules, storage, panel UI
│   ├── pages/                   # Route views (Home workspace, About, Examples, Terms)
│   ├── workers/                 # Web Workers (pyWorker.ts for isolated Pyodide execution)
│   ├── services/                # WebRTC, P2P data channels, storage, and API clients
│   ├── store/                   # Zustand state stores (workspace, nodes, settings)
│   ├── types/                   # TypeScript interfaces and schema declarations
│   ├── App.tsx                  # Root application orchestrator
│   └── main.tsx                 # App mount & router configuration
├── public/                      # Static assets, icons, manifest.json
├── package.json                 # Dependencies & scripts
└── vite.config.ts               # Vite configuration with Tailwind CSS v4 & PWA
```

---

## 📄 License

This project is licensed under the **MIT License**.
