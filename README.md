# Copilot Desktop (Community Edition)

A lightweight, high-performance desktop wrapper for Microsoft Copilot with advanced productivity features and browser-style navigation.

## 🌟 Why this exists

This project was created as a standalone desktop application to provide a more robust and seamless experience for Microsoft Copilot. Standard browser environments often have security restrictions that can limit the flexibility of custom integrations—particularly regarding deep keyboard control and cross-origin interactions. By moving to a dedicated environment, we can offer a more native-feeling workspace that avoids some of these common extension-based limitations.

## 🚀 Features

- **Global Keyboard Shortcuts:** Access search, settings, and new chats instantly.
- **Browser-style Search (Cmd+F):** Real-time text search with match highlighting and a result counter.
- **Navigation (Cmd+[ / Cmd+]):** Familiar back/forward history navigation.
- **Iframe Support:** Shortcuts work even when you are focused inside the chat input or other frames.
- **Official Branding:** Integrated with the official Copilot icon for a native look and feel.

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| `Cmd/Ctrl + Shift + O` | **New Chat** (Alternative: `Cmd+N`) |
| `Cmd/Ctrl + K` or `/` | **Focus Search / Chat Input** |
| `Cmd/Ctrl + F` | **Find in Page** (Browser-style search bar) |
| `Cmd/Ctrl + ,` | **Settings** |
| `Cmd/Ctrl + .` | **Toggle Sidebar** |
| `Cmd/Ctrl + [` | **Go Back** in history |
| `Cmd/Ctrl + ]` | **Go Forward** in history |

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
