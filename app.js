/**
 * Soundboard Web App - Classic Hardware Studio Soundboard Engine
 * Modern, zero-framework audio application loaded with 30+ meme sound effects
 * and 4 fixed classic categories with strict unique hotkey validation.
 */

// Global State
let soundCategories = {};
let masterVolume = 0.8;
let isMuted = false;
let isLocked = false;
let activeTab = "all"; // 'all', 'memes', 'classics'
const activeAudioInstances = new Set();
const lastPlayedIndices = {}; 
let categoryToDelete = null;

// Web Audio API context for synth fallback
let audioCtx = null;

// IndexedDB Audio Cache for offline / serverless custom sound files
const DB_NAME = "SoundboardAudioDB";
const STORE_NAME = "audio_blobs";

function openAudioDB() {
    return new Promise((resolve) => {
        if (!window.indexedDB) {
            resolve(null);
            return;
        }
        const request = indexedDB.open(DB_NAME, 1);
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
        };
        request.onsuccess = (e) => resolve(e.target.result);
        request.onerror = () => resolve(null);
    });
}

async function saveAudioBlob(pathKey, blob) {
    try {
        const db = await openAudioDB();
        if (!db) return;
        const tx = db.transaction(STORE_NAME, "readwrite");
        tx.objectStore(STORE_NAME).put(blob, pathKey);
    } catch (e) {
        console.warn("Failed to save audio to IndexedDB:", e);
    }
}

async function getAudioBlob(pathKey) {
    try {
        const db = await openAudioDB();
        if (!db) return null;
        return new Promise((resolve) => {
            const tx = db.transaction(STORE_NAME, "readonly");
            const req = tx.objectStore(STORE_NAME).get(pathKey);
            req.onsuccess = () => resolve(req.result || null);
            req.onerror = () => resolve(null);
        });
    } catch (e) {
        return null;
    }
}

async function removeAudioBlob(pathKey) {
    try {
        const db = await openAudioDB();
        if (!db) return;
        const tx = db.transaction(STORE_NAME, "readwrite");
        tx.objectStore(STORE_NAME).delete(pathKey);
    } catch (e) {}
}

// Built-in 4 Fixed Classic Categories + 30 Meme Sound Cards
const DEFAULT_CATEGORIES = {
    // 4 Fixed Classic Categories (STRICTLY isMeme: false)
    happy: { id: "happy", name: "Happy", key: "H", icon: "😄", isMeme: false, isFixed: true, sounds: [] },
    laugh: { id: "laugh", name: "Laugh", key: "L", icon: "😂", isMeme: false, isFixed: true, sounds: [] },
    crying: { id: "crying", name: "Crying", key: "C", icon: "😭", isMeme: false, isFixed: true, sounds: [] },
    angry: { id: "angry", name: "Angry", key: "A", icon: "😡", isMeme: false, isFixed: true, sounds: [] },

    // 30 Meme Sound Cards (STRICTLY isMeme: true)
    bruh: { id: "bruh", name: "Bruh", key: "B", icon: "🗿", isMeme: true, isFixed: false, sounds: ["sounds/memes/bruh.wav"] },
    emotional_damage: { id: "emotional_damage", name: "Emotional Damage", key: "E", icon: "💔", isMeme: true, isFixed: false, sounds: ["sounds/memes/emotional_damage.wav"] },
    vine_boom: { id: "vine_boom", name: "Vine Boom", key: "V", icon: "💥", isMeme: true, isFixed: false, sounds: ["sounds/memes/vine_boom.wav"] },
    airhorn: { id: "airhorn", name: "Airhorn", key: "N", icon: "📢", isMeme: true, isFixed: false, sounds: ["sounds/memes/airhorn.wav"] },
    fart: { id: "fart", name: "Fart Sound", key: "F", icon: "💨", isMeme: true, isFixed: false, sounds: ["sounds/memes/fart.wav"] },
    sad_violin: { id: "sad_violin", name: "Sad Violin", key: "S", icon: "🎻", isMeme: true, isFixed: false, sounds: ["sounds/memes/sad_violin.wav"] },
    wow: { id: "wow", name: "Wow!", key: "W", icon: "😮", isMeme: true, isFixed: false, sounds: ["sounds/memes/wow.wav"] },
    roblox_oof: { id: "roblox_oof", name: "Roblox Oof", key: "O", icon: "💀", isMeme: true, isFixed: false, sounds: ["sounds/memes/roblox_oof.wav"] },
    noice: { id: "noice", name: "Noice", key: "K", icon: "👌", isMeme: true, isFixed: false, sounds: ["sounds/memes/noice.wav"] },
    directed_by: { id: "directed_by", name: "Directed By", key: "D", icon: "🎬", isMeme: true, isFixed: false, sounds: ["sounds/memes/directed_by.wav"] },
    illuminati: { id: "illuminati", name: "Illuminati", key: "I", icon: "🛸", isMeme: true, isFixed: false, sounds: ["sounds/memes/illuminati.wav"] },
    coffin_dance: { id: "coffin_dance", name: "Coffin Dance", key: "X", icon: "⚰️", isMeme: true, isFixed: false, sounds: ["sounds/memes/coffin_dance.wav"] },
    fbi_open_up: { id: "fbi_open_up", name: "FBI Open Up", key: "U", icon: "🚨", isMeme: true, isFixed: false, sounds: ["sounds/memes/fbi_open_up.wav"] },
    quack: { id: "quack", name: "Quack", key: "Q", icon: "🦆", isMeme: true, isFixed: false, sounds: ["sounds/memes/quack.wav"] },
    badumtss: { id: "badumtss", name: "Ba-Dum-Tss", key: "T", icon: "🥁", isMeme: true, isFixed: false, sounds: ["sounds/memes/badumtss.wav"] },
    metal_pipe: { id: "metal_pipe", name: "Metal Pipe", key: "P", icon: "🪵", isMeme: true, isFixed: false, sounds: ["sounds/memes/metal_pipe.wav"] },
    gigachad: { id: "gigachad", name: "GigaChad", key: "G", icon: "💪", isMeme: true, isFixed: false, sounds: ["sounds/memes/gigachad.wav"] },
    taco_bell: { id: "taco_bell", name: "Taco Bell Bong", key: "Z", icon: "🔔", isMeme: true, isFixed: false, sounds: ["sounds/memes/taco_bell.wav"] },
    bonk: { id: "bonk", name: "Bonk!", key: "M", icon: "🔨", isMeme: true, isFixed: false, sounds: ["sounds/memes/bonk.wav"] },
    victory: { id: "victory", name: "Victory Horn", key: "1", icon: "🎺", isMeme: true, isFixed: false, sounds: ["sounds/memes/victory.wav"] },
    fail_horn: { id: "fail_horn", name: "Fail Horn", key: "2", icon: "📯", isMeme: true, isFixed: false, sounds: ["sounds/memes/fail_horn.wav"] },
    evil_laugh: { id: "evil_laugh", name: "Evil Laugh", key: "3", icon: "😈", isMeme: true, isFixed: false, sounds: ["sounds/memes/evil_laugh.wav"] },
    record_scratch: { id: "record_scratch", name: "Record Scratch", key: "4", icon: "🎙️", isMeme: true, isFixed: false, sounds: ["sounds/memes/record_scratch.wav"] },
    cat_meow: { id: "cat_meow", name: "Cat Meow", key: "5", icon: "🐱", isMeme: true, isFixed: false, sounds: ["sounds/memes/cat_meow.wav"] },
    dog_bark: { id: "dog_bark", name: "Dog Bark", key: "6", icon: "🐶", isMeme: true, isFixed: false, sounds: ["sounds/memes/dog_bark.wav"] },
    dramatic_chipmunk: { id: "dramatic_chipmunk", name: "Dramatic Chipmunk", key: "7", icon: "🐿️", isMeme: true, isFixed: false, sounds: ["sounds/memes/dramatic_chipmunk.wav"] },
    crickets: { id: "crickets", name: "Crickets", key: "8", icon: "🦗", isMeme: true, isFixed: false, sounds: ["sounds/memes/crickets.wav"] },
    spongebob_fail: { id: "spongebob_fail", name: "SpongeBob Fail", key: "9", icon: "🧽", isMeme: true, isFixed: false, sounds: ["sounds/memes/spongebob_fail.wav"] },
    wilhelm_scream: { id: "wilhelm_scream", name: "Wilhelm Scream", key: "0", icon: "😱", isMeme: true, isFixed: false, sounds: ["sounds/memes/wilhelm_scream.wav"] },
    yeet: { id: "yeet", name: "Yeet!", key: "R", icon: "🚀", isMeme: true, isFixed: false, sounds: ["sounds/memes/yeet.wav"] }
};

// Initialize App
document.addEventListener("DOMContentLoaded", async () => {
    await loadSettings();
    initEventListeners();
    updateTabCounts();
    updateLockUI();
    renderCategories();
});

function getAudioContext() {
    if (!audioCtx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        audioCtx = new AudioContext();
    }
    if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    return audioCtx;
}

function toggleLockState() {
    isLocked = !isLocked;
    updateLockUI();
    saveSettings();

    if (isLocked) {
        showToast("Console LOCKED 🔒 (Playback Only)");
    } else {
        showToast("Console UNLOCKED 🔓 (Editing Enabled)");
    }
}

function updateLockUI() {
    const rack = document.getElementById("studioRack");
    const lockIcon = document.getElementById("lockIcon");
    const lockText = document.getElementById("lockText");
    const lockBtn = document.getElementById("lockToggleBtn");
    const led = document.getElementById("studioLed");

    if (isLocked) {
        if (rack) rack.classList.add("console-locked");
        if (lockIcon) lockIcon.textContent = "🔒";
        if (lockText) lockText.textContent = "Locked";
        if (lockBtn) lockBtn.classList.add("is-locked");
        if (led) {
            led.classList.remove("active-green");
            led.classList.add("locked-red");
        }
    } else {
        if (rack) rack.classList.remove("console-locked");
        if (lockIcon) lockIcon.textContent = "🔓";
        if (lockText) lockText.textContent = "Unlocked";
        if (lockBtn) lockBtn.classList.remove("is-locked");
        if (led) {
            led.classList.remove("locked-red");
            led.classList.add("active-green");
        }
    }
}

function updateTabCounts() {
    const allCount = Object.keys(soundCategories).length;
    const memeCount = Object.values(soundCategories).filter(c => c.isMeme !== false).length;
    const classicCount = Object.values(soundCategories).filter(c => c.isMeme === false).length;

    const countAll = document.getElementById("countAll");
    const countMemes = document.getElementById("countMemes");
    const countClassics = document.getElementById("countClassics");

    if (countAll) countAll.textContent = allCount;
    if (countMemes) countMemes.textContent = memeCount;
    if (countClassics) countClassics.textContent = classicCount;
}

function renderCategories(filterQuery = "") {
    const grid = document.getElementById("categoriesGrid");
    const emptyState = document.getElementById("emptyState");
    grid.innerHTML = "";

    const query = filterQuery.trim().toLowerCase();
    const categoriesArray = Object.values(soundCategories);

    const filtered = categoriesArray.filter(cat => {
        if (activeTab === "memes" && cat.isMeme === false) return false;
        if (activeTab === "classics" && cat.isMeme !== false) return false;

        return cat.name.toLowerCase().includes(query) || 
               cat.key.toLowerCase().includes(query);
    });

    if (filtered.length === 0) {
        emptyState.classList.remove("hidden");
        return;
    } else {
        emptyState.classList.add("hidden");
    }

    filtered.forEach(category => {
        const card = document.createElement("div");
        card.className = "sound-card";
        card.setAttribute("data-id", category.id);
        card.setAttribute("data-key", category.key.toUpperCase());
        card.setAttribute("role", "button");
        card.setAttribute("tabindex", "0");
        card.setAttribute("aria-label", `${category.name} pad, shortcut key ${category.key}`);

        const soundCountText = category.sounds.length === 1 ? "1 sample" : `${category.sounds.length} samples`;

        const deleteButtonHtml = category.isFixed 
            ? '' 
            : `<button class="card-action-btn delete-action" title="Delete Pad" data-action="delete" data-id="${category.id}">🗑️</button>`;

        card.innerHTML = `
            <div class="card-actions">
                <button class="card-action-btn edit-action" title="${category.isFixed ? 'Add Audio Sample to Category' : 'Edit Pad'}" data-action="edit" data-id="${category.id}">✏️</button>
                ${deleteButtonHtml}
            </div>
            <div class="card-emoji">${category.icon || '🎵'}</div>
            <div class="card-info">
                <div class="card-name">${escapeHtml(category.name)}</div>
                <div class="card-sound-count">${soundCountText}</div>
            </div>
            <div class="card-key-badge">[ ${category.key.toUpperCase()} ]</div>
        `;

        card.addEventListener("click", (e) => {
            if (e.target.closest('.card-actions')) return;
            triggerCategory(category.id);
        });

        card.addEventListener("keydown", (e) => {
            if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                triggerCategory(category.id);
            }
        });

        grid.appendChild(card);
    });

    grid.querySelectorAll('.card-action-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (isLocked) {
                showToast("Console is LOCKED! Only playback is allowed.");
                return;
            }
            const action = btn.getAttribute('data-action');
            const id = btn.getAttribute('data-id');
            if (action === 'edit') openAddCategoryModal(id);
            else if (action === 'delete') confirmDeleteCategory(id);
        });
    });
}

function triggerCategory(categoryId) {
    const category = soundCategories[categoryId];
    if (!category) return;

    animateCard(categoryId);
    playRandomSound(category);
}

async function playRandomSound(category) {
    getAudioContext();

    const sounds = category.sounds || [];
    if (sounds.length === 0) {
        playSynthFallback(category.name);
        updateNowPlayingDisplay(`▶ ${category.name} (Synth)`);
        return;
    }

    let selectedIndex = 0;
    if (sounds.length > 1) {
        const lastIdx = lastPlayedIndices[category.id];
        do {
            selectedIndex = Math.floor(Math.random() * sounds.length);
        } while (selectedIndex === lastIdx);
    }
    lastPlayedIndices[category.id] = selectedIndex;

    const soundPath = sounds[selectedIndex];
    const soundFilename = getFilenameFromPath(soundPath);

    updateNowPlayingDisplay(`▶ PLAY: ${category.name} (${soundFilename})`);

    let playUrl = soundPath;
    const cachedBlob = await getAudioBlob(soundPath);
    if (cachedBlob) {
        playUrl = URL.createObjectURL(cachedBlob);
    }

    const audio = new Audio();
    audio.src = playUrl;
    audio.volume = isMuted ? 0 : masterVolume;

    activeAudioInstances.add(audio);

    const cleanup = () => {
        activeAudioInstances.delete(audio);
        if (playUrl.startsWith("blob:")) {
            URL.revokeObjectURL(playUrl);
        }
        if (activeAudioInstances.size === 0) {
            updateNowPlayingDisplay("▶ SYSTEM READY");
        }
    };

    audio.addEventListener("ended", cleanup);

    audio.addEventListener("error", () => {
        cleanup();
        console.warn(`Could not load ${soundPath}, playing fallback synth sound.`);
        playSynthFallback(category.name);
    });

    audio.play().catch(err => {
        console.warn("Audio element blocked, fallback synth sound playing:", err);
        playSynthFallback(category.name);
    });
}

function playSynthFallback(categoryName) {
    try {
        const ctx = getAudioContext();
        if (!ctx) return;

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        let freq = 440;
        const name = categoryName.toLowerCase();
        
        if (name.includes('bruh')) freq = 140;
        else if (name.includes('boom') || name.includes('taco')) freq = 90;
        else if (name.includes('airhorn')) freq = 520;
        else if (name.includes('fart')) freq = 110;
        else if (name.includes('oof')) freq = 380;
        else if (name.includes('wow')) freq = 620;
        else if (name.includes('quack')) freq = 340;
        else if (name.includes('bonk')) freq = 700;
        else if (name.includes('victory')) freq = 880;

        const effectiveVol = isMuted ? 0 : masterVolume;

        osc.type = (name.includes('boom') || name.includes('bruh') || name.includes('fart')) ? 'sawtooth' : 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(freq * 0.6, ctx.currentTime + 0.3);

        gain.gain.setValueAtTime(effectiveVol * 0.5, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start();
        osc.stop(ctx.currentTime + 0.35);
    } catch (e) {
        console.error("Synth fallback error:", e);
    }
}

function stopAllSounds() {
    activeAudioInstances.forEach(audio => {
        try {
            audio.pause();
            audio.currentTime = 0;
        } catch (e) {}
    });
    activeAudioInstances.clear();
    updateNowPlayingDisplay("⏹ ALL PADS STOPPED");
    setTimeout(() => updateNowPlayingDisplay("▶ SYSTEM READY"), 1500);
}

function handleKeyboardShortcut(event) {
    const activeEl = document.activeElement;
    const isTyping = activeEl && (
        activeEl.tagName === "INPUT" ||
        activeEl.tagName === "TEXTAREA" ||
        activeEl.tagName === "SELECT" ||
        activeEl.isContentEditable
    );

    if (isTyping) return;

    const pressedKey = event.key.toUpperCase();

    if (pressedKey === 'M' && !findCategoryByKey('M')) {
        toggleMute();
        return;
    }

    if (event.code === 'Space' && !findCategoryByKey(' ')) {
        event.preventDefault();
        stopAllSounds();
        return;
    }

    const category = findCategoryByKey(pressedKey);
    if (category) {
        event.preventDefault();
        triggerCategory(category.id);
    }
}

function findCategoryByKey(key) {
    return Object.values(soundCategories).find(
        cat => cat.key.toUpperCase() === key.toUpperCase()
    );
}

function animateCard(categoryId) {
    const card = document.querySelector(`.sound-card[data-id="${categoryId}"]`);
    if (!card) return;

    card.classList.add("active-press");
    setTimeout(() => {
        card.classList.remove("active-press");
    }, 180);
}

function updateNowPlayingDisplay(text) {
    const textEl = document.getElementById("nowPlayingText");
    const indicatorEl = document.getElementById("playingIndicator");

    if (textEl) textEl.textContent = text.toUpperCase();

    if (indicatorEl) {
        if (text.includes("PLAY") || text.includes("Synth") || text.includes("Playing")) {
            indicatorEl.classList.add("active");
        } else {
            indicatorEl.classList.remove("active");
        }
    }
}

function setVolume(val) {
    masterVolume = parseFloat(val) / 100;
    document.getElementById("volumeValue").textContent = `${Math.round(val)}%`;
    
    activeAudioInstances.forEach(audio => {
        audio.volume = isMuted ? 0 : masterVolume;
    });

    if (isMuted && masterVolume > 0) {
        isMuted = false;
        updateMuteUI();
    }

    saveSettings();
}

function toggleMute() {
    isMuted = !isMuted;
    updateMuteUI();

    activeAudioInstances.forEach(audio => {
        audio.volume = isMuted ? 0 : masterVolume;
    });

    saveSettings();
    showToast(isMuted ? "MUTED 🔇" : "UNMUTED 🔊");
}

function updateMuteUI() {
    const muteIcon = document.getElementById("muteIcon");
    if (muteIcon) {
        muteIcon.textContent = isMuted ? "🔇" : (masterVolume > 0.5 ? "🔊" : "🔉");
    }
}

let currentFormSounds = []; // Holds only NEWLY uploaded files in the form session!

function toggleModalFormFields(isClassicMode) {
    const classicGroup = document.getElementById("classicSelectGroup");
    const memeGroup = document.getElementById("memeFieldsGroup");
    const catNameInput = document.getElementById("catName");
    const catKeyInput = document.getElementById("catKey");

    if (isClassicMode) {
        if (classicGroup) classicGroup.classList.remove("hidden");
        if (memeGroup) memeGroup.classList.add("hidden");
        if (catNameInput) catNameInput.removeAttribute("required");
        if (catKeyInput) catKeyInput.removeAttribute("required");
    } else {
        if (classicGroup) classicGroup.classList.add("hidden");
        if (memeGroup) memeGroup.classList.remove("hidden");
        if (catNameInput) catNameInput.setAttribute("required", "true");
        if (catKeyInput) catKeyInput.setAttribute("required", "true");
    }
}

function openAddCategoryModal(categoryIdToEdit = null) {
    if (isLocked) {
        showToast("Console is LOCKED! Unlock to edit or add sounds.");
        return;
    }

    const modalBackdrop = document.getElementById("modalBackdrop");
    const modal = document.getElementById("categoryModal");
    const titleEl = document.getElementById("modalTitle");
    const form = document.getElementById("categoryForm");

    // Reset form and start with a CLEAN/EMPTY sound upload list
    form.reset();
    currentFormSounds = [];

    let isClassicMode = false;

    if (categoryIdToEdit && soundCategories[categoryIdToEdit]) {
        const cat = soundCategories[categoryIdToEdit];
        
        if (cat.isFixed) {
            isClassicMode = true;
            titleEl.textContent = `Upload New Audio Sample to Classic '${cat.name}'`;
            document.getElementById("editCategoryId").value = cat.id;
            document.getElementById("classicCategorySelect").value = cat.id;
        } else {
            isClassicMode = false;
            titleEl.textContent = "Edit Meme Pad";
            document.getElementById("editCategoryId").value = cat.id;
            document.getElementById("catName").value = cat.name;
            document.getElementById("catIcon").value = cat.icon;
            document.getElementById("catKey").value = cat.key;
            document.getElementById("keyBadgePreview").textContent = cat.key.toUpperCase();
        }
    } else {
        titleEl.textContent = "Add Sound / Meme Pad";
        document.getElementById("editCategoryId").value = "";
        document.getElementById("keyBadgePreview").textContent = "?";

        if (activeTab === "classics") {
            isClassicMode = true;
        } else {
            isClassicMode = false;
        }
    }

    document.getElementById("modeClassic").checked = isClassicMode;
    document.getElementById("modeMeme").checked = !isClassicMode;
    toggleModalFormFields(isClassicMode);

    renderFormSoundList();

    modalBackdrop.classList.remove("hidden");
    modal.classList.remove("hidden");

    setTimeout(() => {
        if (!isClassicMode) {
            const nameInput = document.getElementById("catName");
            if (nameInput) nameInput.focus();
        }
    }, 100);
}

function closeCategoryModal() {
    document.getElementById("modalBackdrop").classList.add("hidden");
    document.getElementById("categoryModal").classList.add("hidden");
}

function renderFormSoundList() {
    const container = document.getElementById("soundList");
    container.innerHTML = "";

    if (currentFormSounds.length === 0) {
        container.innerHTML = `<small class="form-hint" style="text-align:center; padding: 6px;">No new audio file selected yet</small>`;
        return;
    }

    currentFormSounds.forEach((soundPath, index) => {
        const item = document.createElement("div");
        item.className = "sound-item";
        item.innerHTML = `
            <span class="sound-item-name" title="${escapeHtml(soundPath)}">🎵 ${escapeHtml(getFilenameFromPath(soundPath))}</span>
            <button type="button" class="sound-item-remove" data-index="${index}">&times;</button>
        `;
        container.appendChild(item);
    });

    container.querySelectorAll(".sound-item-remove").forEach(btn => {
        btn.addEventListener("click", () => {
            const idx = parseInt(btn.getAttribute("data-index"), 10);
            currentFormSounds.splice(idx, 1);
            renderFormSoundList();
        });
    });
}

function handleCategoryFormSubmit(e) {
    e.preventDefault();

    if (isLocked) {
        showToast("Console is LOCKED! Cannot modify pads.");
        return;
    }

    const editId = document.getElementById("editCategoryId").value;
    const isClassicMode = document.getElementById("modeClassic").checked;

    if (isClassicMode) {
        const classicCatId = document.getElementById("classicCategorySelect").value;
        const targetClassicCat = soundCategories[classicCatId];

        if (!targetClassicCat) {
            showToast("Invalid Classic category selected.");
            return;
        }

        if (currentFormSounds.length === 0) {
            showToast("Please select or upload at least one new audio sample to add.");
            return;
        }

        // Append new sounds to existing classic category sounds without erasing previous files!
        const combinedSounds = Array.from(new Set([...(targetClassicCat.sounds || []), ...currentFormSounds]));
        targetClassicCat.sounds = combinedSounds;
        targetClassicCat.isMeme = false;

        saveSettings();
        updateTabCounts();
        renderCategories();
        closeCategoryModal();
        showToast(`Added new sample(s) to Classic '${targetClassicCat.name}' (Total: ${combinedSounds.length} samples)!`);
    } else {
        const nameInput = document.getElementById("catName");
        const keyInput = document.getElementById("catKey");
        const iconInput = document.getElementById("catIcon");

        const name = nameInput ? nameInput.value.trim() : "";
        const icon = (iconInput && iconInput.value.trim()) ? iconInput.value.trim() : "🗿";
        const key = keyInput ? keyInput.value.trim().toUpperCase() : "";

        if (!name || !key) {
            showToast("Please enter a Meme Name and Assign Hotkey.");
            return;
        }

        const duplicateKeyCat = Object.values(soundCategories).find(
            cat => cat.key.toUpperCase() === key && cat.id !== editId
        );

        if (duplicateKeyCat) {
            showToast(`KEY [ ${key} ] IS ALREADY ASSIGNED TO '${duplicateKeyCat.name.toUpperCase()}'. KEYS CANNOT BE REPEATED!`);
            return;
        }

        const categoryId = editId || name.toLowerCase().replace(/[^a-z0-9]/g, "_") + "_" + Date.now();
        
        const existingCat = soundCategories[categoryId];
        const existingSounds = existingCat ? (existingCat.sounds || []) : [];
        
        // If user uploaded new files in form, append them; otherwise keep existing sounds intact
        const combinedSounds = currentFormSounds.length > 0 
            ? Array.from(new Set([...existingSounds, ...currentFormSounds]))
            : existingSounds;

        soundCategories[categoryId] = {
            id: categoryId,
            name: name,
            key: key,
            icon: icon,
            isMeme: true,
            isFixed: false,
            sounds: combinedSounds
        };

        saveSettings();
        updateTabCounts();
        renderCategories();
        closeCategoryModal();
        showToast(`Meme Pad '${name}' [Key: ${key}] saved!`);
    }
}

function confirmDeleteCategory(categoryId) {
    if (isLocked) {
        showToast("Console is LOCKED! Cannot delete pads.");
        return;
    }

    const cat = soundCategories[categoryId];
    if (!cat) return;

    if (cat.isFixed) {
        showToast(`Classic category '${cat.name}' is fixed and cannot be deleted.`);
        return;
    }

    categoryToDelete = categoryId;
    document.getElementById("deleteConfirmText").textContent = 
        `Are you sure you want to delete '${cat.name}' meme pad?`;

    document.getElementById("deleteModalBackdrop").classList.remove("hidden");
}

async function deleteCategory() {
    if (isLocked) {
        showToast("Console is LOCKED! Cannot delete pads.");
        return;
    }

    if (categoryToDelete && soundCategories[categoryToDelete]) {
        const idToDelete = categoryToDelete;
        const name = soundCategories[idToDelete].name;
        if (soundCategories[idToDelete].isFixed) {
            showToast(`Fixed classic category cannot be deleted.`);
        } else {
            delete soundCategories[idToDelete];

            // Permanently delete from server-side categories.json
            try {
                await fetch('/api/categories/delete', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: idToDelete })
                });
            } catch (e) {
                console.warn("Server delete API offline:", e);
            }

            saveSettings();
            updateTabCounts();
            renderCategories();
            showToast(`Deleted '${name}' pad permanently!`);
        }
    }
    categoryToDelete = null;
    document.getElementById("deleteModalBackdrop").classList.add("hidden");
}

function saveSettings() {
    try {
        localStorage.setItem("soundboard_categories", JSON.stringify(soundCategories));
        localStorage.setItem("soundboard_volume", masterVolume.toString());
        localStorage.setItem("soundboard_muted", isMuted.toString());
        localStorage.setItem("soundboard_locked", isLocked.toString());

        // Save directly to server-side categories.json file!
        fetch('/api/categories', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(soundCategories)
        }).catch(e => console.warn("Server API not reachable:", e));

    } catch (e) {
        console.error("Failed to save settings:", e);
    }
}

async function loadSettings() {
    try {
        let categoriesLoaded = false;

        // Fetch categories directly from server-side categories.json!
        try {
            const res = await fetch('/api/categories');
            if (res.ok) {
                const serverCategories = await res.json();
                if (serverCategories && Object.keys(serverCategories).length > 0) {
                    soundCategories = serverCategories;
                    categoriesLoaded = true;
                }
            }
        } catch (e) {
            console.warn("Could not fetch server categories, using localStorage fallback:", e);
        }

        if (!categoriesLoaded) {
            const savedCategories = localStorage.getItem("soundboard_categories");
            if (savedCategories) {
                soundCategories = JSON.parse(savedCategories);
            } else {
                soundCategories = JSON.parse(JSON.stringify(DEFAULT_CATEGORIES));
            }
        }

        ['happy', 'laugh', 'crying', 'angry'].forEach(id => {
            if (soundCategories[id]) {
                soundCategories[id].isMeme = false;
                soundCategories[id].isFixed = true;
            } else if (DEFAULT_CATEGORIES[id]) {
                soundCategories[id] = JSON.parse(JSON.stringify(DEFAULT_CATEGORIES[id]));
            }
        });

        const savedVolume = localStorage.getItem("soundboard_volume");
        const savedMuted = localStorage.getItem("soundboard_muted");
        const savedLocked = localStorage.getItem("soundboard_locked");

        if (savedVolume !== null) {
            masterVolume = parseFloat(savedVolume);
            const slider = document.getElementById("volumeSlider");
            if (slider) slider.value = Math.round(masterVolume * 100);
            document.getElementById("volumeValue").textContent = `${Math.round(masterVolume * 100)}%`;
        }

        if (savedMuted !== null) {
            isMuted = savedMuted === "true";
            updateMuteUI();
        }

        if (savedLocked !== null) {
            isLocked = savedLocked === "true";
        }

    } catch (e) {
        console.error("Failed to load settings:", e);
        soundCategories = JSON.parse(JSON.stringify(DEFAULT_CATEGORIES));
    }
}

function exportConfiguration() {
    const configData = {
        app: "Classic Studio Soundboard & Memes",
        version: "3.0",
        exportDate: new Date().toISOString(),
        categories: Object.values(soundCategories).map(cat => ({
            name: cat.name,
            key: cat.key,
            icon: cat.icon,
            isMeme: cat.isMeme !== false,
            isFixed: cat.isFixed === true,
            sounds: cat.sounds
        }))
    };

    const jsonStr = JSON.stringify(configData, null, 4);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `soundboard_studio_config_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast("Configuration exported as JSON!");
}

function importConfiguration(file) {
    if (isLocked) {
        showToast("Console is LOCKED! Cannot import configuration.");
        return;
    }

    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);
            if (!data.categories || !Array.isArray(data.categories)) {
                throw new Error("Invalid format. Missing 'categories' array.");
            }

            const newCategories = {};
            data.categories.forEach(cat => {
                if (cat.name && cat.key) {
                    const id = cat.name.toLowerCase().replace(/[^a-z0-9]/g, "_") + "_" + Math.random().toString(36).substr(2, 5);
                    const isClassic = ['happy', 'laugh', 'crying', 'angry'].includes(id) || cat.isFixed;
                    newCategories[id] = {
                        id: id,
                        name: cat.name,
                        key: cat.key.toUpperCase(),
                        icon: cat.icon || "🗿",
                        isMeme: !isClassic,
                        isFixed: isClassic,
                        sounds: cat.sounds || []
                    };
                }
            });

            if (Object.keys(newCategories).length === 0) {
                showToast("No valid categories found.");
                return;
            }

            soundCategories = newCategories;
            saveSettings();
            updateTabCounts();
            renderCategories();
            showToast("Imported soundboard configuration successfully!");
        } catch (err) {
            console.error("Import error:", err);
            showToast(`Import error: ${err.message}`);
        }
    };
    reader.readAsText(file);
}

function initEventListeners() {
    window.addEventListener("keydown", handleKeyboardShortcut);

    const searchInput = document.getElementById("searchInput");
    if (searchInput) {
        searchInput.addEventListener("input", (e) => {
            renderCategories(e.target.value);
        });
    }

    const tabsContainer = document.getElementById("categoryTabs");
    if (tabsContainer) {
        tabsContainer.addEventListener("click", (e) => {
            const btn = e.target.closest(".tab-btn");
            if (!btn) return;
            tabsContainer.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            activeTab = btn.getAttribute("data-tab");
            renderCategories(searchInput ? searchInput.value : "");
        });
    }

    const radioMeme = document.getElementById("modeMeme");
    const radioClassic = document.getElementById("modeClassic");
    if (radioMeme) radioMeme.addEventListener("change", () => toggleModalFormFields(false));
    if (radioClassic) radioClassic.addEventListener("change", () => toggleModalFormFields(true));

    const volSlider = document.getElementById("volumeSlider");
    if (volSlider) volSlider.addEventListener("input", (e) => setVolume(e.target.value));

    document.getElementById("muteBtn").addEventListener("click", toggleMute);
    document.getElementById("stopBtn").addEventListener("click", stopAllSounds);

    const lockBtn = document.getElementById("lockToggleBtn");
    if (lockBtn) lockBtn.addEventListener("click", toggleLockState);

    document.getElementById("addCategoryBtn").addEventListener("click", () => openAddCategoryModal());
    document.getElementById("exportBtn").addEventListener("click", exportConfiguration);
    document.getElementById("importBtn").addEventListener("click", () => {
        if (isLocked) {
            showToast("Console is LOCKED! Unlock to import.");
            return;
        }
        document.getElementById("importFileInput").click();
    });

    document.getElementById("importFileInput").addEventListener("change", (e) => {
        if (e.target.files.length > 0) {
            importConfiguration(e.target.files[0]);
            e.target.value = "";
        }
    });

    document.getElementById("closeModalBtn").addEventListener("click", closeCategoryModal);
    document.getElementById("cancelModalBtn").addEventListener("click", closeCategoryModal);
    document.getElementById("categoryForm").addEventListener("submit", handleCategoryFormSubmit);

    const keyInput = document.getElementById("catKey");
    if (keyInput) {
        keyInput.addEventListener("input", (e) => {
            const val = e.target.value.toUpperCase();
            e.target.value = val;
            document.getElementById("keyBadgePreview").textContent = val || "?";
        });
    }

    document.querySelectorAll(".emoji-chip").forEach(chip => {
        chip.addEventListener("click", () => {
            document.getElementById("catIcon").value = chip.textContent;
        });
    });

    document.getElementById("addUrlBtn").addEventListener("click", () => {
        const input = document.getElementById("manualUrlInput");
        let url = input.value.trim();
        if (url) {
            if (!url.startsWith("sounds/") && !url.startsWith("http://") && !url.startsWith("https://") && !url.startsWith("data:")) {
                const isClassicMode = document.getElementById("modeClassic")?.checked;
                const classicCatId = document.getElementById("classicCategorySelect")?.value;
                const targetFolder = isClassicMode ? (classicCatId || "happy") : "memes";
                url = `sounds/${targetFolder}/${url}`;
            }
            currentFormSounds.push(url);
            input.value = "";
            renderFormSoundList();
        }
    });

    const audioFileInput = document.getElementById("audioFileInput");
    const dropZone = document.getElementById("dropZone");

    if (audioFileInput) {
        audioFileInput.addEventListener("change", (e) => {
            handleUploadedFiles(e.target.files);
            e.target.value = "";
        });
    }

    if (dropZone) {
        dropZone.addEventListener("dragover", (e) => {
            e.preventDefault();
            dropZone.classList.add("dragover");
        });

        dropZone.addEventListener("dragleave", () => {
            dropZone.classList.remove("dragover");
        });

        dropZone.addEventListener("drop", (e) => {
            e.preventDefault();
            dropZone.classList.remove("dragover");
            if (e.dataTransfer.files.length > 0) {
                handleUploadedFiles(e.dataTransfer.files);
            }
        });
    }

    document.getElementById("cancelDeleteBtn").addEventListener("click", () => {
        document.getElementById("deleteModalBackdrop").classList.add("hidden");
    });
    document.getElementById("confirmDeleteBtn").addEventListener("click", deleteCategory);
}

async function handleUploadedFiles(files) {
    const isClassicMode = document.getElementById("modeClassic")?.checked;
    const classicCatId = document.getElementById("classicCategorySelect")?.value;
    const targetFolder = isClassicMode ? (classicCatId || "happy") : "memes";

    showToast("Processing sound file(s)...");

    for (const file of Array.from(files)) {
        if (!file.type.startsWith("audio/") && !file.name.match(/\.(wav|mp3|ogg|m4a|flac)$/i)) continue;

        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const relativePath = `sounds/${targetFolder}/${safeName}`;

        // Save audio binary into browser IndexedDB so it works serverless without Node!
        await saveAudioBlob(relativePath, file);

        // Try uploading to server endpoint if running via node server
        try {
            const base64Data = await readFileAsDataURL(file);
            const response = await fetch('/api/upload', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    filename: file.name,
                    data: base64Data,
                    folder: targetFolder
                })
            });

            if (response.ok) {
                const result = await response.json();
                if (result.success && result.relativePath) {
                    currentFormSounds.push(result.relativePath);
                    renderFormSoundList();
                    showToast(`Saved to disk: ${result.relativePath}`);
                    continue;
                }
            }
        } catch (err) {
            // Node server not running - serverless browser mode
        }

        currentFormSounds.push(relativePath);
        renderFormSoundList();
        showToast(`Added meme sound: ${relativePath}`);
    }
}

function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = (e) => reject(e);
        reader.readAsDataURL(file);
    });
}

function getFilenameFromPath(path) {
    if (path.startsWith("data:audio")) {
        return "Custom Sample";
    }
    const parts = path.split("/");
    return parts[parts.length - 1];
}

function escapeHtml(str) {
    return str.replace(/[&<>"']/g, function(m) {
        return {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        }[m];
    });
}

function showToast(message) {
    const toast = document.getElementById("toast");
    if (!toast) return;
    toast.textContent = message;
    toast.classList.remove("hidden");
    setTimeout(() => {
        toast.classList.add("hidden");
    }, 3200);
}
