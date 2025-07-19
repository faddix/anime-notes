/// <reference path="./plugin.d.ts" />
/// <reference path="./system.d.ts" />
/// <reference path="./app.d.ts" />

function init() {
    $ui.register((ctx) => {
        const currentMediaId = ctx.state<number | null>(null);
        const titleFieldRef = ctx.fieldRef("initial title");
        const noteFieldRef = ctx.fieldRef("initial note");
        const STORAGE_KEY = "anime-notes";
        
        const tray = ctx.newTray({
            iconUrl: "https://raw.githubusercontent.com/faddix/anime-notes/main/src/notepad.png",
            withContent: true
        });
        
        tray.render(() => {
            if (!currentMediaId.get())
                return tray.text("✏️ Click on an anime to add/edit notes 📋");
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

        function updateTray(anime : $app.AL_BaseAnime) {
            currentMediaId.set(anime.id);
            titleFieldRef.setValue(`✏️ Notes for: 📺 ${anime.title?.userPreferred}`);
            
            const notes = $storage.get(STORAGE_KEY) || {};
            const existingNote = notes[anime.id];
            noteFieldRef.setValue(existingNote || '');
            tray.open();
        };

        async function getCurrentAnime(): Promise<$app.AL_BaseAnime | undefined> {
            return (await ctx.anime.getAnimeEntry(currentMediaId.get() || 0)).media;
        }
        const handleButtonPress = (event) => {
            const anime = event.media;
            currentMediaId.set(anime.id);
            updateTray(anime);
        }

        tray.onClick(() => {
            getCurrentAnime().then(anime => {
                if(anime) updateTray(anime);
            });
        });

        ctx.registerEventHandler("save", () => {
            if (currentMediaId.get()) {
                const notes = $storage.get(STORAGE_KEY) || {};
                notes[currentMediaId.get() || 0] = noteFieldRef.current;
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

        ctx.screen.onNavigate((e) => {
            if (e.pathname === "/entry" && !!e.searchParams.id) {
                const id = parseInt(e.searchParams.id);
                if (currentMediaId.get() !== id) {
                    currentMediaId.set(id);
                }
            } else {
                currentMediaId.set(null);
            }
        });
        ctx.screen.loadCurrent();
    });
}
