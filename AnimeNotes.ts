/// <reference path="./plugin.d.ts" />
/// <reference path="./system.d.ts" />
/// <reference path="./app.d.ts" />
/// <reference path="./core.d.ts" />

// =====================
// Data structures
// =====================

interface Note {
    id: number;
    title: string;
    note: string;
    coverImage: string;
}

// =====================
// Plugin Initialization
// =====================

function init() {
    $ui.register((ctx: $ui.Context) => {
        // =====================
        // Constants and States
        // =====================

        const ICON_URL = "https://raw.githubusercontent.com/faddix/anime-notes/main/src/notepad.png";
        const STORAGE_KEY = "anime-notes";

        const currentMediaId = ctx.state<number | null>(null);
        const titleFieldRef = ctx.fieldRef("");
        const noteFieldRef = ctx.fieldRef("");
        const tray = ctx.newTray({ iconUrl: ICON_URL, withContent: true });

        const allNotes = ctx.state<Note[]>([]);
        const isViewingAllNotes = ctx.state<boolean>(false);
        const searchQuery = ctx.state<string>("");
        const editMap = ctx.state<Record<number, string>>({});
        const fieldRefMap = ctx.state<Record<number, any>>({});
        const deletedNoteIds = ctx.state<Set<number>>(new Set());
        const viewMode = ctx.state<string>("local");

        const MODE: string = $getUserPreference("mode") || "dual-view";
        const ENABLE_VIEW_MODE_TOGGLE: boolean = MODE === "dual-view";
        const PUSH_MODE: string = MODE === "local-anilist-synced" ? "push" : "local-only";
        const FETCH_MODE: string = MODE === "local-anilist-synced" ? "if-empty" : (MODE === "anilist-only" ? "always" : "on-demand");
        const IS_ANILIST_ONLY: boolean = MODE === "anilist-only";
        const IS_LOCAL_ONLY: boolean = MODE === "local-only";

        // =====================
        // Helper Functions
        // =====================

        function getShouldSaveDirectlyToAniList(): boolean {
            return IS_ANILIST_ONLY || (ENABLE_VIEW_MODE_TOGGLE && viewMode.get() === "anilist");
        }

        async function buildNotesArray(data: Record<number, any>, sourceType: 'local' | 'anilist'): Promise<Note[]> {
            const notes: Note[] = [];

            if (sourceType === 'anilist') {
                for (const mediaIdStr in data) {
                    const mediaId = parseInt(mediaIdStr);
                    const noteText = data[mediaId];

                    if (noteText !== undefined && noteText !== null) {
                        let entry: $app.Anime_Entry | null = null;
                        try {
                            entry = await ctx.anime.getAnimeEntry(mediaId);
                        } catch {}

                        const title = entry?.media?.title?.userPreferred ?? `Anime #${mediaId}`;
                        const coverImage = entry?.media?.coverImage?.medium ?? entry?.media?.coverImage?.large ?? "";

                        notes.push({
                            id: mediaId,
                            title,
                            note: noteText === '""' ? "" : noteText,
                            coverImage,
                        });
                    }
                }
            } else {
                for (const key in data) {
                    const id = parseInt(key);
                    const rawText = data[id];

                    let text: string;
                    if (rawText === null || rawText === undefined) text = "";
                    else if (typeof rawText === "string") text = rawText;
                    else text = JSON.stringify(rawText);

                    if (text === '""') text = "";

                    let entry: $app.Anime_Entry | null = null;
                    try {
                        entry = await ctx.anime.getAnimeEntry(id);
                    } catch {}

                    const title = entry?.media?.title?.userPreferred ?? `Anime #${id}`;
                    const coverImage = entry?.media?.coverImage?.medium ?? entry?.media?.coverImage?.large ?? "";
                    notes.push({
                        id,
                        title,
                        note: text,
                        coverImage,
                    });
                }
            }

            return notes.sort((a, b) => a.title.toLowerCase().localeCompare(b.title.toLowerCase()));
        }

        function setupNotesState(notes: Note[], shouldOpen: boolean) {
            const initialEdits: Record<number, string> = {};
            const newFieldRefMap: Record<number, any> = {};
            const existingRefs = fieldRefMap.get() || {};

            try {
                for (const note of notes) {
                    initialEdits[note.id] = note.note;
                    if (existingRefs[note.id]) {
                        newFieldRefMap[note.id] = existingRefs[note.id];
                        try { newFieldRefMap[note.id].setValue(note.note); } catch {}
                    } else {
                        newFieldRefMap[note.id] = ctx.fieldRef(note.note);
                    }
                }
            } catch {
                fieldRefMap.set(existingRefs);
                editMap.set(initialEdits);
                allNotes.set(notes);
                searchQuery.set("");
                deletedNoteIds.set(new Set());
                isViewingAllNotes.set(true);
                if (shouldOpen) tray.open();
                return false;
            }

            editMap.set(initialEdits);
            fieldRefMap.set(newFieldRefMap);
            searchQuery.set("");
            deletedNoteIds.set(new Set());
            isViewingAllNotes.set(true);
            if (shouldOpen) tray.open();
            return true;
        }

        async function getCurrentAnime(): Promise<$app.AL_BaseAnime | null> {
            const id = currentMediaId.get();
            if (!id) return null;
            const media = (await ctx.anime.getAnimeEntry(id)).media;
            return media || null;
        }

        // =====================
        // AniList Integration
        // =====================

        async function fetchAniListNote(mediaId: number): Promise<string | null> {
            const token = $database.anilist.getToken();
            if (!token) {
                ctx.toast.error("⚠️ No AniList token found — notes won't be pushed.");
                return null;
            }

            const query = `
                query ($mediaId: Int, $name: String) {
                    MediaList(mediaId: $mediaId, userName: $name) {
                        notes
                    }
                }`;
            try {
                const name = $database.anilist.getUsername();
                const result = await $anilist.customQuery({ query, variables: { mediaId, name } }, token);
                return result.MediaList?.notes ?? null;
            } catch {
                return null;
            }
        }

        async function saveAniListNote(mediaId: number, note: string) {
            const token = $database.anilist.getToken();
            if (!token) {
                ctx.toast.error("⚠️ No AniList token found — notes won't be pushed.");
                return;
            }

            const mutation = `
                mutation ($mediaId: Int, $notes: String) {
                    SaveMediaListEntry(mediaId: $mediaId, notes: $notes) {
                        id
                        notes
                    }
                }`;
            try {
                await $anilist.customQuery({ query: mutation, variables: { mediaId, notes: note } }, token);
                ctx.toast.success("✨ Note pushed to AniList!");
            } catch {
                ctx.toast.error("⚠️ Failed to push note to AniList");
            }
        }

        async function deleteAniListNote(mediaId: number) {
            const token = $database.anilist.getToken();
            if (!token) {
                ctx.toast.error("⚠️ No AniList token found — notes won't be pushed.");
                return;
            }

            const mutation = `
                mutation ($mediaId: Int, $notes: String) {
                    SaveMediaListEntry(mediaId: $mediaId, notes: $notes) {
                        id
                        notes
                    }
                }`;
            try {
                await $anilist.customQuery({ query: mutation, variables: { mediaId, notes: "" } }, token);
                ctx.toast.success("🗑️ Note deleted from AniList!");
            } catch {
                ctx.toast.error("⚠️ Failed to delete note from AniList");
            }
        }

        async function getAniListNotesMap(): Promise<Record<number, string>> {
            const token = $database.anilist.getToken();
            const aniListNotesMap: Record<number, string> = {};
            if (!token) {
                return aniListNotesMap;
            }
            const name = $database.anilist.getUsername();
            const query = `
                query ($userName: String, $type: MediaType) {
                    MediaListCollection(userName: $userName, type: $type, notes_like: "%_%") {
                        lists {
                            entries {
                                notes
                                media {
                                    id
                                }
                            }
                        }
                    }
                }`;
            try {
                const result = await $anilist.customQuery({ query, variables: { userName: name, type: "ANIME" } }, token);
                const lists = result.MediaListCollection?.lists || [];
                for (const list of lists) {
                    for (const entry of list.entries) {
                        const mediaId = entry.media.id;
                        const notes = entry.notes;
                        if (mediaId && notes !== undefined && notes !== null) {
                            aniListNotesMap[mediaId] = notes === '""' ? "" : notes;
                        }
                    }
                }
            } catch {
                // silent fail
            }
            return aniListNotesMap;
        }

        // =====================
        // Note Loading and Sync
        // =====================

        async function fetchAllAniListNotes() {
            const storedNotes = $storage.get(STORAGE_KEY) || {};
            ctx.toast.info("🔄 Fetching AniList notes…");
            const aniListNotesMap = await getAniListNotesMap();

            if (ENABLE_VIEW_MODE_TOGGLE) {
                return Object.values(aniListNotesMap);
            }

            // Merge AniList notes with stored notes - add new entries & update existing
            const updatedNotes = { ...storedNotes, ...aniListNotesMap };
            $storage.set(STORAGE_KEY, updatedNotes);
            await loadAllNotes();
            ctx.toast.success("✨ All AniList notes updated!");
        }

        async function pushAllAniListNotes() {
            const storedNotes = $storage.get(STORAGE_KEY) || {};
            const notesList = Object.keys(storedNotes).map(id => parseInt(id));
            if (notesList.length === 0) {
                ctx.toast.info("⚠️ No local notes to push.");
                return;
            }
            ctx.toast.info("☁️ Pushing all notes to AniList…");
            for (const id of notesList) {
                try {
                    const note = storedNotes[id];
                    if (note && note.trim().length > 0) {
                        await saveAniListNote(id, note);
                    }
                } catch { }
            }
            ctx.toast.success("✨ All notes pushed to AniList!");
        }

        async function loadAllNotes(shouldOpen: boolean = true) {
            try {
                const storedNotes = $storage.get(STORAGE_KEY) || {};
                const notes = await buildNotesArray(storedNotes, 'local');
                allNotes.set(notes);
                setupNotesState(notes, shouldOpen);
            } catch { }
        }

        async function loadAllAniListNotes(shouldOpen: boolean = true, showToast: boolean = true) {
            try {
                if (showToast) ctx.toast.info("🔄 Loading AniList notes...");
                const aniListNotesMap = await getAniListNotesMap();
                const notes = await buildNotesArray(aniListNotesMap, 'anilist');
                allNotes.set(notes);
                setupNotesState(notes, shouldOpen);
                if (showToast) ctx.toast.success("✨ AniList notes loaded!");
            } catch { }
        }

        // =====================
        // Note Display Helpers
        // =====================

        async function refreshSingleNoteView() {
            const id = currentMediaId.get();
            if (!id) {
                noteFieldRef.setValue("");
                return;
            }
            if (viewMode.get() === "anilist" || IS_ANILIST_ONLY) {
                try {
                    const aniListNote = await fetchAniListNote(id);
                    noteFieldRef.setValue(aniListNote === '""' || aniListNote === null ? "" : aniListNote);
                } catch {
                    noteFieldRef.setValue("");
                }
            } else {
                const notes = $storage.get(STORAGE_KEY) || {};
                const val = notes[id];
                noteFieldRef.setValue((typeof val === "string" && val !== '""') ? val : "");
            }
        }

        async function updateTray(anime: $app.AL_BaseAnime) {
            currentMediaId.set(anime.id);
            titleFieldRef.setValue(`✏️ Notes for: ${anime.title?.userPreferred}`);

            isViewingAllNotes.set(false);
            await refreshSingleNoteView();
        }

        // =====================
        // Tray Render Logic
        // =====================

        tray.render(() => {
            if (isViewingAllNotes.get()) {
                const notes = allNotes.get();
                const query = searchQuery.get().trim().toLowerCase();

                const filteredNotes = query.length > 0 ? notes.filter(item => {
                    const title = String(item.title).toLowerCase();
                    const noteText = String(item.note).toLowerCase();
                    return title.includes(query) || noteText.includes(query);
                }) : notes;

                const filteredIds = new Set(filteredNotes.map(n => n.id));

                const noteStacks = notes.map(note => {
                    const isVisible = filteredIds.has(note.id);
                    const isDeleted = deletedNoteIds.get().has(note.id);
                    const edits = editMap.get();
                    const currentValue = edits[note.id] ?? note.note;

                    const imageDiv = tray.div([], {
                        style: {
                            width: "11.25vh",
                            height: "18vh",
                            'min-width': "60px",
                            'min-height': "96px",
                            backgroundImage: note.coverImage ? `url(${note.coverImage})` : "",
                            backgroundSize: "cover",
                            backgroundPosition: "center",
                            borderRadius: "8px",
                            marginRight: "12px",
                            flexShrink: "0",
                        },
                    });

                    const openButton = tray.button(`${note.title}`, {
                        onClick: ctx.eventHandler(`open-${note.id}`, async () => {
                            try { 
                                await ctx.screen.navigateTo("/entry", { id: String(note.id) }); 
                            } catch {}
                            isViewingAllNotes.set(false);
                            await refreshSingleNoteView();
                            tray.open();
                        }),
                        style: {
                            display: "inline-block",
                            whiteSpace: "normal",
                            wordBreak: "break-word",
                            textAlign: "left",
                            padding: "0",
                            height: "auto",
                            fontWeight: "700",
                            fontSize: "max(12px, 1.8vh)",
                            lineHeight: "1.2",
                            marginBottom: "8px",
                            background: "none",
                        },
                    });

                    const editField = tray.input({
                        label: "Note",
                        fieldRef: fieldRefMap.get()[note.id],
                        textarea: true,
                        onChange: ctx.eventHandler(`update-${note.id}`, val => {
                            let v: any = val;
                            if (v && typeof v === "object") {
                                if ("value" in v) v = v.value;
                                else if ("target" in v && v.target && "value" in v.target) v = v.target.value;
                            }
                            const map = editMap.get() || {};
                            map[note.id] = String(v || "");
                            editMap.set(map);
                        }),
                        style: {
                            height: "auto",
                            fontSize: "max(10px, 1.6vh)",
                            marginBottom: "0px",
                            background: "none",
                            width: "100%",
                        },
                    });

                    const saveButton = tray.button("💾 Save", {
                        intent: "primary",
                        onClick: ctx.eventHandler(`save-${note.id}`, async () => {
                            const map = editMap.get();
                            const noteText = map[note.id];
                            if (getShouldSaveDirectlyToAniList()) {
                                await saveAniListNote(note.id, noteText);
                            } else {
                                const notes = $storage.get(STORAGE_KEY) || {};
                                notes[note.id] = noteText;
                                $storage.set(STORAGE_KEY, notes);
                                if (PUSH_MODE === "push") await saveAniListNote(note.id, noteText);
                                ctx.toast.success(`Saved note for ${note.title}`);
                            }
                            if (currentMediaId.get() === note.id) {
                                noteFieldRef.setValue(noteText);
                            }
                        }),
                        style: { paddingLeft: ".5rem", paddingRight: ".5rem" },
                    });

                    const saveToAniListButton = (PUSH_MODE === "local-only" && !ENABLE_VIEW_MODE_TOGGLE && !IS_ANILIST_ONLY) ? tray.button("☁️ Save to AniList", {
                        onClick: ctx.eventHandler(`save-anilist-${note.id}`, async () => {
                            const map = editMap.get();
                            await saveAniListNote(note.id, map[note.id]);
                        }),
                        style: { paddingLeft: ".5rem", paddingRight: ".5rem" },
                    }) : null;

                    const fetchFromAniListButton = (!ENABLE_VIEW_MODE_TOGGLE && FETCH_MODE === "on-demand") ? tray.button("🔄 Fetch from AniList", {
                        onClick: ctx.eventHandler(`fetch-anilist-${note.id}`, async () => {
                            const token = $database.anilist.getToken();
                            if (!token) {
                                ctx.toast.error("⚠️ No AniList token found");
                                return;
                            }
                            try {
                                const fetchedNote = await fetchAniListNote(note.id);
                                if (fetchedNote && fetchedNote.trim().length > 0) {
                                    const refs = fieldRefMap.get();
                                    if (refs[note.id]) refs[note.id].setValue(fetchedNote);
                                    const map = editMap.get();
                                    map[note.id] = fetchedNote;
                                    editMap.set(map);
                                    ctx.toast.success("✨ Note fetched from AniList!");
                                } else {
                                    ctx.toast.info("No AniList note found for this anime");
                                }
                            } catch {
                                ctx.toast.error("❌ Failed to fetch note");
                            }
                        }),
                        style: { paddingLeft: ".5rem", paddingRight: ".5rem" },
                    }) : null;

                    const deleteButton = tray.button("🗑 Delete", {
                        intent: "alert",
                        onClick: ctx.eventHandler(`delete-${note.id}`, async () => {
                            if (ENABLE_VIEW_MODE_TOGGLE && viewMode.get() === "anilist") {
                                await deleteAniListNote(note.id);
                                deletedNoteIds.set(current => new Set(current).add(note.id));
                            } else {
                                const notes = $storage.get(STORAGE_KEY);
                                delete notes[note.id];
                                $storage.set(STORAGE_KEY, notes);
                                if (currentMediaId.get() === note.id) noteFieldRef.setValue("");
                                deletedNoteIds.set(current => new Set(current).add(note.id));
                            }
                        }),
                        style: { paddingLeft: ".5rem", paddingRight: ".5rem" },
                    });

                    const primaryButtons = [saveButton, deleteButton];
                    const anilistButtons: any[] = [];
                    if (saveToAniListButton) anilistButtons.push(saveToAniListButton);
                    if (fetchFromAniListButton) anilistButtons.push(fetchFromAniListButton);

                    const buttonItems = [
                        tray.flex(primaryButtons, { style: { gap: "8px", marginTop: "8px" } }),
                    ];
                    if (anilistButtons.length > 0) {
                        buttonItems.push(tray.flex(anilistButtons, { style: { gap: "8px", marginTop: "8px" } }));
                    }

                    return tray.stack({
                        items: [
                            tray.flex([
                                imageDiv,
                                tray.stack([
                                    openButton,
                                    editField,
                                    ...buttonItems,
                                ], { style: { flex: "1" } }),
                            ], { style: { gap: "12px", alignItems: "flex-start" } }),
                        ],
                        style: {
                            display: isVisible && !isDeleted ? 'flex' : 'none',
                            paddingBottom: "14px",
                            borderBottom: "1px solid #333",
                            paddingTop: "8px",
                        },
                    });
                });

                const backButton = tray.button("🔙 Back", {
                    onClick: ctx.eventHandler("back-to-single", async () => {
                        isViewingAllNotes.set(false);
                        await refreshSingleNoteView();
                        tray.open();
                    }),
                });

                const viewModeButton = ENABLE_VIEW_MODE_TOGGLE ? tray.button(viewMode.get() === "local" ? "🔄 Switch to AniList View" : "🔄 Switch to Local View", {
                    onClick: ctx.eventHandler("toggle-view-mode", async () => {
                        const currentMode = viewMode.get();
                        const newMode = currentMode === "local" ? "anilist" : "local";
                        viewMode.set(newMode);

                        tray.close();

                        const minDelayPromise = new Promise(resolve => ctx.setTimeout(() => resolve(undefined), 350));

                        if (newMode === "anilist") await Promise.all([loadAllAniListNotes(false), minDelayPromise]);
                        else await Promise.all([loadAllNotes(false), minDelayPromise]);

                        await refreshSingleNoteView();

                        tray.open();
                    }),
                }) : null;

                const viewModeHeader = ENABLE_VIEW_MODE_TOGGLE ? tray.text(viewMode.get() === "local" ? "📝 Local Notes:" : "☁️ AniList Notes:", {
                    style: {
                        fontSize: "max(14px, 2vh)",
                        fontWeight: "600",
                        marginBottom: "8px",
                        color: viewMode.get() === "local" ? "#4CAF50" : "#2196F3"
                    }
                }) : null;

                const searchInput = tray.input({
                    label: "🔍 Search",
                    value: searchQuery.get(),
                    placeholder: "Filter notes...",
                    onChange: ctx.eventHandler("search-change", (newValue) => {
                        let val: any = newValue;
                        if (val && typeof val === "object") {
                            if ("value" in val) val = val.value;
                            else if ("target" in val && val.target && "value" in val.target) val = val.target.value;
                        }
                        searchQuery.set(String(val || ""));
                    }),
                });

                const fetchAllButton = (ENABLE_VIEW_MODE_TOGGLE || IS_ANILIST_ONLY) ? null : tray.button("🔄 Fetch All", {
                    onClick: ctx.eventHandler("fetch-all-anilist", async () => {
                        tray.close();
                        await fetchAllAniListNotes();
                        tray.open();
                    }),
                });

                const pushAllButton = (ENABLE_VIEW_MODE_TOGGLE || IS_ANILIST_ONLY) ? null : tray.button("☁️ Push All", {
                    intent: "warning",
                    onClick: ctx.eventHandler("sync-all-anilist", async () => {
                        await pushAllAniListNotes();
                    }),
                });

                const visibleNoteCount = notes.filter(n => !deletedNoteIds.get().has(n.id) && filteredIds.has(n.id)).length;

                const leftButtons = [backButton];
                const rightButtons: any[] = [];
                if (viewModeButton) rightButtons.push(viewModeButton);

                const bulkButtons: any[] = [];
                if (fetchAllButton) bulkButtons.push(fetchAllButton);
                if (pushAllButton) bulkButtons.push(pushAllButton);

                if (bulkButtons.length > 0) rightButtons.push(tray.flex(bulkButtons, { style: { gap: "8px" } }));

                const items = [
                    tray.flex([
                        tray.flex(leftButtons, { style: { gap: "8px", alignItems: "center" } }),
                        tray.flex(rightButtons, { style: { gap: "8px", alignItems: "center", marginLeft: "auto" } })
                    ], { style: { justifyContent: "space-between", alignItems: "center" } }),
                ];

                if (viewModeHeader) items.push(viewModeHeader);

                items.push(
                    tray.flex([searchInput], {
                        style: { marginTop: "8px", width: "100%" },
                    }),
                    ...(visibleNoteCount === 0 && query.length > 0 ? [tray.text("No matching notes found.")] : noteStacks)
                );

                return tray.stack({ items });
            }

            if (!currentMediaId.get()) {
                return tray.stack({
                    items: [
                        tray.text("✏️ Click on an anime to add/edit notes 📋"),
                        tray.button("📚 View All Notes", {
                            onClick: ctx.eventHandler("view-all", async () => {
                                if (IS_ANILIST_ONLY) await loadAllAniListNotes();
                                else if (ENABLE_VIEW_MODE_TOGGLE && viewMode.get() === "anilist") await loadAllAniListNotes();
                                else await loadAllNotes();
                                await refreshSingleNoteView();
                            }),
                        }),
                    ],
                });
            }

            const saveButton = tray.button("💾 Save", {
                intent: "primary",
                onClick: "save",
            });

            const saveToAniListButton = (PUSH_MODE === "local-only" && !ENABLE_VIEW_MODE_TOGGLE && !IS_ANILIST_ONLY) ? tray.button("☁️ Save to AniList", {
                onClick: ctx.eventHandler("save-single-anilist", async () => {
                    const id = currentMediaId.get();
                    if (!id) return;
                    const note = noteFieldRef.current;
                    await saveAniListNote(id, note);
                }),
            }) : null;

            const fetchButton = (!ENABLE_VIEW_MODE_TOGGLE && FETCH_MODE === "on-demand") ? tray.button("🔄 Fetch from AniList", {
                onClick: ctx.eventHandler("fetch-single-anilist", async () => {
                    const id = currentMediaId.get();
                    if (!id) return;
                    const note = await fetchAniListNote(id);
                    if (!note) {
                        ctx.toast.info("No note found on AniList for this anime.");
                        return;
                    }
                    noteFieldRef.setValue(note);
                    const notes = $storage.get(STORAGE_KEY);
                    notes[id] = note;
                    $storage.set(STORAGE_KEY, notes);
                    ctx.toast.success("Fetched note from AniList.");
                }),
            }) : null;

            const viewAllButton = tray.button("📚 View All Notes", {
                onClick: ctx.eventHandler("view-all", async () => {
                    if (ENABLE_VIEW_MODE_TOGGLE && viewMode.get() === "anilist") await loadAllAniListNotes();
                    else await loadAllNotes();
                    await refreshSingleNoteView();
                }),
            });

            const viewModeButton = ENABLE_VIEW_MODE_TOGGLE ? tray.button(viewMode.get() === "local" ? "🔄 Switch to AniList View" : "🔄 Switch to Local View", {
                onClick: ctx.eventHandler("toggle-single-view-mode", async () => {
                    const currentMode = viewMode.get();
                    const newMode = currentMode === "local" ? "anilist" : "local";
                    viewMode.set(newMode);
                    await refreshSingleNoteView();
                    tray.open();
                }),
            }) : null;

            const viewModeHeader = ENABLE_VIEW_MODE_TOGGLE ? tray.text(viewMode.get() === "local" ? `📝 Local Notes for: ${titleFieldRef.current.replace("✏️ Notes for: ", "")}` : `☁️ AniList Notes for: ${titleFieldRef.current.replace("✏️ Notes for: ", "")}`, {
                style: {
                    fontSize: "max(14px, 2vh)",
                    fontWeight: "600",
                    marginBottom: "8px",
                    'white-space': "pre-wrap",
                    'word-break': "keep-all",
                    color: viewMode.get() === "local" ? "#4CAF50" : "#2196F3"
                }
            }) : null;

            const mainButtons = [saveButton];
            if (saveToAniListButton) mainButtons.push(saveToAniListButton);
            if (fetchButton) mainButtons.push(fetchButton);

            const leftButtons: any[] = [];
            const rightButtons = [viewAllButton];
            if (viewModeButton) leftButtons.push(viewModeButton);

            const items = [
                tray.flex([
                    tray.flex(leftButtons, { style: { gap: "8px", alignItems: "center" } }),
                    tray.flex(rightButtons, { style: { gap: "8px", alignItems: "center", marginLeft: "auto" } })
                ], { style: { justifyContent: "space-between", alignItems: "center", marginBottom: "8px" } }),
            ];

            if (viewModeHeader) items.push(viewModeHeader);

            items.push(
                tray.input({
                    label: ENABLE_VIEW_MODE_TOGGLE ? "" : titleFieldRef.current,
                    fieldRef: noteFieldRef,
                    textarea: true,
                    style: { "word-break": "none" }
                }),
                tray.flex(mainButtons, { style: { gap: "8px", marginTop: "8px" } })
            );

            return tray.stack({ items });
        });

        tray.onClick(async () => {
            const anime = await getCurrentAnime();
            if (anime) updateTray(anime);
        });

        ctx.registerEventHandler("save", async () => {
            const id = currentMediaId.get();
            if (!id) return;
            const note = noteFieldRef.current;
            if (getShouldSaveDirectlyToAniList()) {
                await saveAniListNote(id, note);
            } else {
                const notes = $storage.get(STORAGE_KEY) || {};
                notes[id] = note;
                $storage.set(STORAGE_KEY, notes);
                if (PUSH_MODE === "push") await saveAniListNote(id, note);
                const anime = await getCurrentAnime();
                if (anime) ctx.toast.success(`Saved note for ${anime.title?.userPreferred ?? "Unknown"}`);
            }
        });

        ctx.registerEventHandler("cancel", () => {
            tray.close();
        });

        function handleButtonPress(event: { media: $app.AL_BaseAnime }) {
            const anime = event.media;
            currentMediaId.set(anime.id);
            updateTray(anime);
            tray.open();
        }

        const animePageButton = ctx.action.newAnimePageButton({
            label: "📝 Add/Edit Note",
            intent: "primary",
        });
        animePageButton.onClick(handleButtonPress);

        const animePageDropdown = ctx.action.newAnimePageDropdownItem({
            label: "📝 Notes",
        });
        animePageDropdown.onClick(event => ctx.setTimeout(() => handleButtonPress(event), 400));

        const mediaCardEntry = ctx.action.newMediaCardContextMenuItem({
            label: "📝 Add/Edit Note",
            for: "anime",
        });
        mediaCardEntry.mount();
        mediaCardEntry.onClick(handleButtonPress);

        ctx.screen.onNavigate(async (e: { pathname: string; searchParams: Record<string, string> }) => {
            if (e.pathname === "/entry" && e.searchParams.id) {
                const id = parseInt(e.searchParams.id);
                currentMediaId.set(id);
                try {
                    const entry = await ctx.anime.getAnimeEntry(id);
                    const media = entry?.media || null;
                    if (media) await updateTray(media);
                } catch { }
            } else {
                currentMediaId.set(null);
            }

            const body = await ctx.dom.queryOne("body");
            if (!body) return null;
            const width = await body.getComputedStyle("width");
            if (!width) return;
            if (parseInt(width) > 526) {
                animePageButton.mount();
                animePageDropdown.unmount();
            } else {
                animePageButton.unmount();
                animePageDropdown.mount();
            }
        });

        ctx.screen.loadCurrent();
    });
}
