/// <reference path="./plugin.d.ts" />
/// <reference path="./system.d.ts" />
/// <reference path="./app.d.ts" />

function init() {
    $ui.register((ctx) => {
        const titleFieldRef = ctx.fieldRef("initial title");
        const noteFieldRef = ctx.fieldRef("initial note");
        let currentAnimeId = null;
        const STORAGE_KEY = "anime-notes";
        
        const tray = ctx.newTray({
            iconUrl: "https://raw.githubusercontent.com/faddix/anime-notes/main/src/notepad.png",
            withContent: true
        });
        
        tray.render(() => {
            return;
        });
    
        const handleButtonPress = (event) => {
            const anime = event.media;
            currentAnimeId = anime.id;
            titleFieldRef.setValue(`✏️ Notes for: 📺 ${anime.title?.userPreferred || ''}`);
            
            const notes = $storage.get(STORAGE_KEY) || {};
            const existingNote = notes[anime.id];
            noteFieldRef.setValue(existingNote || '');

            tray.render(() => {
                return [
                    tray.input({
                        label: titleFieldRef.current,
                        fieldRef: noteFieldRef
                    }),
                    tray.button("💾 Save", {
                        intent: "primary",
                        onClick: "save"
                    }),
                    tray.button("❌ Cancel", {
                        onClick: "cancel"
                    })
                ];
            });
            
            tray.open();
        }

        // New handler for tray click
        tray.onClick(() => {
            tray.render(() => {
                return tray.text("✏️ Click on an anime to add/edit notes 📋");
            });
        });

        ctx.registerEventHandler("save", () => {
            if (currentAnimeId) {
                const notes = $storage.get(STORAGE_KEY) || {};
                notes[currentAnimeId] = noteFieldRef.current;
                $storage.set(STORAGE_KEY, notes);
                ctx.toast.success("✨ Note saved successfully!");
                tray.close();
            }
        });

        ctx.registerEventHandler("cancel", () => {
            tray.close();
        });

        const animePageButton = ctx.action.newAnimePageButton({
            label: "📝 Add/Edit Note",
            intent: "primary"
        });

        animePageButton.mount();
        animePageButton.onClick(handleButtonPress);

        const mediaCardEntry = ctx.action.newMediaCardContextMenuItem({
            label: "📝 Add/Edit Note",
            for: "anime"
        });

        mediaCardEntry.mount();
        mediaCardEntry.onClick(handleButtonPress);
    });
}
