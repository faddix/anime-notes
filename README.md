# 📝 Anime Notes — A Seanime Plugin

Easily jot down personal notes on your anime library! This plugin adds quick-access note-taking capabilities to anime entries in Seanime. Whether you're waiting for a season to finish, watching in dub/sub, or just want to keep track of thoughts — this lightweight utility makes it simple.

---

## ✨ Features

* 📝 **Add/edit notes per anime** — Click any anime to add personal notes with full rich text support
* 🔄 **Flexible storage modes** — Choose between local-only, AniList-only, or dual-view modes
* 🔀 **View mode switching** — Toggle between local and AniList notes in dual-view mode
* 🔍 **Search & filter** — Quickly find specific notes with built-in search functionality
* 📚 **Bulk management** — View all notes, sync with AniList, fetch missing data
* 🔄 **Real-time sync** — Automatic saving and sync options with AniList integration
* 💾 **Persistent storage** — Local storage with optional AniList cloud backup
* 🎨 **Responsive design** — Optimized for both desktop and mobile interfaces

---

## ⚙️ How to Use

1. **Install the plugin** through Seanime Extensions Marketplace.
2. Navigate to:
   * 🔘 An anime page and click **“📝 Add/Edit Note”** (on mobile click on the 3 dots to open the menu and click on **“📝 Notes”** );
   * 📚 Your library → right-click an anime card → select **“📝 Add/Edit Note”** from the context menu;
   * 🔔 Click the tray icon while on an anime page to open notes for that anime directly.
3. Write your note and press **📂 Save**.
4. To discard changes, click outside the tray

---

## ⚙️ Configuration Preferences

The plugin behavior can be customized through Seanime's plugin settings interface. Choose your preferred storage mode:

### Storage Mode (default: "Local & AniList")

- **Local only** — Notes are stored locally in your browser only, with no AniList integration
- **AniList only** — Notes are stored on AniList only, with no local storage
- **Local & AniList** — Dual view mode allowing you to switch between separate local notes and AniList notes

---

### 🛠️ Known Issues

⚠️ **When hosting Seanime from the desktop app**, using the mobile version concurrently may cause unexpected behavior, as the plugin cannot reliably distinguish between the two open windows.

✅ **Recommended workaround**: Host the instance using the **server version** instead, and ensure all other tabs are closed.

---

## 💡 Use Cases

* Leaving a note about where you left off if you're taking a break from the show
* Marking shows you want to binge once fully released
* Listing preferred streaming platforms or quality (e.g., Blu-ray, web)
* Keeping track of shows you recommended to friends or plan to rewatch
* Making comparisons between different seasons or adaptations
* Leave quick reviews of shows you've watched

---

## 📂 Data Storage

All your notes are stored **locally** in your browser using `$storage` under the key `anime-notes`. No data is sent externally.
You can optionally upload your notes to your AniList account.

---

## ⌨️ Development Notes

To run or modify this plugin locally for development, clone the repository and refer to the [Seanime plugin development guide](https://seanime.gitbook.io/seanime-extensions/plugins/introduction) for setup and deployment.

---

## 📬 Feedback or Issues

Open an issue on [GitHub](https://github.com/faddix/anime-notes/issues) or reach out through the Seanime [Discord community](https://discord.gg/3AuhRGqUqh).
