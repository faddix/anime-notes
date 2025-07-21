# 📝 Anime Notes — A Seanime Plugin

Easily jot down personal notes on your anime library! This plugin adds quick-access note-taking capabilities to anime entries in Seanime. Whether you're waiting for a season to finish, watching in dub/sub, or just want to keep track of thoughts — this lightweight utility makes it simple.

---

## ✨ Features

* 📝 **Add/edit notes per anime**
* 📌 **Notes are saved locally**

---

## ⚙️ How to Use

1. **Install the plugin** through Seanime Extensions Marketplace.
2. Navigate to:
   * 🔘 An anime page and click **“📝 Add/Edit Note”** (on mobile click on the 3 dots to open the menu and click on **“📝 Notes”** );
   * 📚 Your library → right-click an anime card → select **“📝 Add/Edit Note”** from the context menul;
   * 🔔 Click the tray icon while on an anime page to open notes for that anime directly.
3. Write your note and press **📂 Save**.
4. To discard changes, press **❌ Cancel**.

---

Yes, that wording is clear and helpful! Here's a slightly refined version with improved flow and clarity:

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

---

## 📂 Data Storage

All your notes are stored **locally** in your browser using `$storage` under the key `anime-notes`. No data is sent externally.

---

## ⌨️ Development Notes

To run or modify this plugin locally:

```ts
/// <reference path="./plugin.d.ts" />
/// <reference path="./system.d.ts" />
/// <reference path="./app.d.ts" />

// Entry point: function init() { ... }
```

Refer to the [Seanime plugin development guide](https://seanime.gitbook.io/seanime-extensions/plugins/introduction) for setup and deployment.

---

## 📬 Feedback or Issues

Open an issue on [GitHub](https://github.com/faddix/anime-notes/issues) or reach out through the Seanime [Discord community](https://discord.gg/3AuhRGqUqh).
