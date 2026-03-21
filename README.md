# Copilot Desktop CE

A lightweight, high-performance desktop wrapper for Microsoft Copilot with advanced productivity features and browser-style navigation.

## 🌟 Why this exists

This project was created as a standalone desktop application to provide a more robust and seamless experience for Microsoft Copilot. Standard browser environments often have security restrictions that can limit the flexibility of custom integrations—particularly regarding deep keyboard control and cross-origin interactions. By moving to a dedicated environment, we can offer a more native-feeling workspace that avoids some of these common extension-based limitations.

## 🚀 Features

- **Library:** Quick access to your full chat history and saved items.
- **Tasks PREVIEW:** Integrated task management for tracking your to-dos directly within Copilot.
- **Discover:** Stay updated with the latest trends and trending searches.
- **Shopping:** Get smart recommendations and price comparisons while you browse.
- **Imagine:** A dedicated space for creating AI-generated images with ease.
- **Labs:** Access to cutting-edge experimental features before they roll out to everyone.
- **Standard Shortcuts:** Full support for `Cmd+A` (Select All), `Cmd+C` (Copy), `Cmd+X` (Cut), and `Cmd+V` (Paste).
- **Global Keyboard Shortcuts:** Access search, settings, and new chats instantly.
- **Browser-style Search (Cmd+F):** Real-time text search with match highlighting and a result counter.
- **Navigation (Cmd+[ / Cmd+]):** Familiar back/forward history navigation.
- **Iframe Support:** Shortcuts work even when you are focused inside the chat input or other frames.
- **Official Branding:** Integrated with the official Copilot icon for a native look and feel.

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| `Cmd/Ctrl + Shift + O` | **New Chat** (Alternative: `Cmd+N`) |
| `Cmd/Ctrl + U` | **Voice / Talk** (Deep integration, avoids `Cmd+V` conflict) |
| `Cmd/Ctrl + K` or `/` | **Focus Search / Chat Input** |
| `Cmd/Ctrl + L` | **Library** |
| `Cmd/Ctrl + T` | **Tasks PREVIEW** |
| `Cmd/Ctrl + D` | **Discover** |
| `Cmd/Ctrl + S` | **Shopping** |
| `Cmd/Ctrl + I` | **Imagine** |
| `Cmd/Ctrl + B` | **Labs** |
| `Cmd/Ctrl + F` | **Find in Page** (Browser-style search bar) |
| `Cmd/Ctrl + ,` | **Settings** |
| `Cmd/Ctrl + .` | **Toggle Sidebar** |
| `Cmd/Ctrl + [` | **Go Back** in history |
| `Cmd/Ctrl + ]` | **Go Forward** in history |

## 🔗 Deep Linking (URL Scheme)

You can trigger Copilot from other apps (like Apple Reminders, Shortcuts, or Raycast) using the `copilot://` URL scheme.

**Example Usage:**
- `copilot://chat?q=What is the weather?`
- `copilot://sydney?q=Summarize my day` (Mobile-compatible format)

## 🛠️ Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/YOUR_USERNAME/copilot-desktop-community.git
   cd copilot-desktop-community
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Run in development mode:**
   ```bash
   npm start
   ```

4. **Build the standalone app:**
   ```bash
   npm run build
   ```
   The built app will be available in the `dist/` directory.

## 🤝 Contributing

This is a community-driven project! If Microsoft changes their UI and a shortcut stops working, please open an issue or submit a Pull Request with the updated CSS selector in `content.js`.

## 📜 License

MIT License - see the [LICENSE](LICENSE) file for details.

---
*Disclaimer: This project is not affiliated with, authorized, maintained, sponsored or endorsed by Microsoft or any of its affiliates or subsidiaries.*
