// --- CONFIGURATION ---
// API base URL (key will be appended at call time)
const API_BASE_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent`;
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.11.338/pdf.worker.min.js`;

// --- DOM ELEMENTS ---
const welcomeScreen = document.getElementById('welcome-screen');
const startAppBtn = document.getElementById('start-app-btn');
const appContainer = document.getElementById('app-container');
const fileInput = document.getElementById('file-input');
const leftPane = document.getElementById('left-pane');
const libraryView = document.getElementById('library-view');
const docViewer = document.getElementById('document-viewer');
const translationPanel = document.getElementById('translation-panel');
const backToLibraryBtn = document.getElementById('back-to-library-btn');
const languageSelect = document.getElementById('language-select');
const darkModeToggle = document.getElementById('dark-mode-toggle');
const perWordToggle = document.getElementById('per-word-toggle');
// Page Navigation Elements
const pageNavContainer = document.getElementById('page-nav-container');
const pageNumInput = document.getElementById('page-num-input');
const pageCountSpan = document.getElementById('page-count');
const pagePrevBtn = document.getElementById('page-prev-btn');
const pageNextBtn = document.getElementById('page-next-btn');
// Translation Panel Elements
const tabButtons = document.querySelectorAll('.tab-button');
const tabContents = document.querySelectorAll('.tab-content');
const currentTranslationContent = document.getElementById('current-translation-content');
const historyContent = document.getElementById('translation-history-content');
const copyButton = document.getElementById('copy-button');
const exportButton = document.getElementById('export-button');

// --- DATABASE HELPER ---
const db = {
    _db: null,
    init: function() { /* ... No changes ... */ return new Promise((resolve, reject)=>{const request=indexedDB.open('DocuTranslateDB',1);request.onerror=()=>reject("Error opening database");request.onsuccess=(event)=>{this._db=event.target.result;resolve()};request.onupgradeneeded=(event)=>{const db=event.target.result;if(!db.objectStoreNames.contains('books')){db.createObjectStore('books',{keyPath:'id',autoIncrement:true})}}})},
    addBook: function(file) { /* ... No changes ... */ return new Promise((resolve,reject)=>{const transaction=this._db.transaction(['books'],'readwrite');const store=transaction.objectStore('books');const book={name:file.name,file:file,added_on:new Date()};const request=store.add(book);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject("Error adding book")})},
    getBooks: function() { /* ... No changes ... */ return new Promise((resolve)=>{const transaction=this._db.transaction(['books'],'readonly');const store=transaction.objectStore('books');const request=store.getAll();request.onsuccess=()=>resolve(request.result.sort((a,b)=>b.added_on-a.added_on))})},
    getBook: function(id) { /* ... No changes ... */ return new Promise((resolve)=>{const transaction=this._db.transaction(['books'],'readonly');const store=transaction.objectStore('books');const request=store.get(id);request.onsuccess=()=>resolve(request.result)})},
    deleteBook: function(id) { /* ... No changes ... */ return new Promise((resolve)=>{const transaction=this._db.transaction(['books'],'readwrite');const store=transaction.objectStore('books');const request=store.delete(id);request.onsuccess=()=>resolve()})}
};

// --- STATE MANAGEMENT ---
let translationLog = [];
let splitInstance = null;
let epubRendition = null;
let currentPdf = null;

// --- Lofi (YouTube) Player State ---
let lofiPlayer = null;
let lofiIsPlaying = false;
// Set to the requested lofi livestream video id
const LOFI_VIDEO_ID = 'jfKfPfyJRdk'; // requested: https://www.youtube.com/live/jfKfPfyJRdk
const LOFI_STORAGE_KEY = 'lofiPlaying';

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', async () => {
    await db.init();
    startAppBtn.addEventListener('click', startApplication);
    if (localStorage.getItem('theme') === 'dark') {
        document.body.classList.add('dark-mode');
        if(darkModeToggle) darkModeToggle.innerHTML = '<i class="fa-solid fa-sun"></i>';
    }
    // Wire up API key UI if present in DOM
    try {
        const apiKeyInput = document.getElementById('api-key-input');
        const saveApiKeyBtn = document.getElementById('save-api-key-btn');
        const clearApiKeyBtn = document.getElementById('clear-api-key-btn');

        if (apiKeyInput) {
            const existing = getStoredApiKey();
            if (existing) apiKeyInput.value = existing;
        }

        if (saveApiKeyBtn) saveApiKeyBtn.addEventListener('click', () => {
            const val = apiKeyInput.value.trim();
            if (!val) return showToast('Please enter a valid API key.');
            setStoredApiKey(val);
            showToast('API key saved locally.');
        });

        if (clearApiKeyBtn) clearApiKeyBtn.addEventListener('click', () => {
            clearStoredApiKey();
            if (apiKeyInput) apiKeyInput.value = '';
            showToast('API key cleared.');
        });
    } catch (e) {
        // If DOM elements not found, ignore silently
    }
    // Initialize lofi controls (header button + action button)
    try { initLofiControls(); } catch (e) { console.warn('Lofi init failed', e); }
});

// Create the YouTube player. Assign to the global callback name so the API can call it,
// and also expose/allow manual creation if the API loaded earlier.
window.onYouTubeIframeAPIReady = function() {
    try {
        // Use a tiny 1x1 iframe (avoid 0 which may cause issues) and keep the container offscreen.
        lofiPlayer = new YT.Player('lofi-player', {
            height: '1',
            width: '1',
            videoId: LOFI_VIDEO_ID,
            playerVars: {
                autoplay: 0,
                controls: 0,
                modestbranding: 1,
                rel: 0,
                showinfo: 0,
                loop: 1,
                playlist: LOFI_VIDEO_ID
            },
            events: {
                onStateChange: function(evt) {
                    const playing = evt.data === YT.PlayerState.PLAYING;
                    setLofiPlayingState(playing);
                }
            }
        });
    } catch (e) {
        console.warn('Failed to create YouTube player', e);
    }
};

function initLofiControls() {
    const headerBtn = document.getElementById('lofi-toggle-btn');
    const actionBtn = document.getElementById('lofi-action-btn');

    if (headerBtn) headerBtn.addEventListener('click', toggleLofi);
    if (actionBtn) actionBtn.addEventListener('click', toggleLofi);

    // Restore stored state (play only after a user interaction because browsers block autoplay)
    const stored = localStorage.getItem(LOFI_STORAGE_KEY);
    const shouldPlay = stored === 'true';

    // Update UI to reflect stored preference; actual playback may require interaction
    updateLofiUI(shouldPlay);

    // If YT API already loaded and container exists but player not created, try to create it
    if (typeof YT !== 'undefined' && YT && !lofiPlayer && document.getElementById('lofi-player')) {
        // If the global ready callback is not called, call creation directly
        try { onYouTubeIframeAPIReady(); } catch (e) {}
    }
}

function toggleLofi() {
    // If player available, toggle using API
    if (lofiPlayer && typeof lofiPlayer.getPlayerState === 'function') {
        const state = lofiPlayer.getPlayerState();
        if (state === YT.PlayerState.PLAYING) {
            lofiPlayer.pauseVideo();
            setLofiPlayingState(false);
        } else {
            // Attempt to play; if blocked, UI will still reflect desire
            lofiPlayer.playVideo();
            setLofiPlayingState(true);
        }
        return;
    }

    // If API/player not available, attempt to open the YouTube page in a new tab as a fallback
    const youtubeUrl = `https://www.youtube.com/watch?v=${LOFI_VIDEO_ID}`;
    window.open(youtubeUrl, '_blank');
}

function setLofiPlayingState(playing) {
    lofiIsPlaying = !!playing;
    try { localStorage.setItem(LOFI_STORAGE_KEY, lofiIsPlaying ? 'true' : 'false'); } catch (e) {}
    updateLofiUI(lofiIsPlaying);
}

function updateLofiUI(playing) {
    const headerBtn = document.getElementById('lofi-toggle-btn');
    const actionBtn = document.getElementById('lofi-action-btn');
    if (headerBtn) {
        if (playing) headerBtn.classList.add('playing'); else headerBtn.classList.remove('playing');
    }
    if (actionBtn) {
        actionBtn.innerHTML = playing ? '<i class="fa-solid fa-pause"></i> Pause Lofi' : '<i class="fa-solid fa-play"></i> Play Lofi';
    }
}

// --- API Key helpers ---
function getStoredApiKey() {
    try { return localStorage.getItem('GOOGLE_AI_API_KEY') || undefined; } catch (e) { return undefined; }
}
function setStoredApiKey(key) {
    try { localStorage.setItem('GOOGLE_AI_API_KEY', key); } catch (e) { console.warn('Failed to store API key locally', e); }
}
function clearStoredApiKey() {
    try { localStorage.removeItem('GOOGLE_AI_API_KEY'); } catch (e) { console.warn('Failed to remove API key', e); }
}

function startApplication() {
    welcomeScreen.classList.add('fade-out');
    appContainer.classList.remove('hidden');
    appContainer.style.animation = 'fadeIn 0.5s ease forwards';
    initializeUI();
    showLibraryView();
}

function initializeUI() {
    darkModeToggle.addEventListener('click', toggleDarkMode);
    fileInput.addEventListener('change', handleFileSelect);
    backToLibraryBtn.addEventListener('click', showLibraryView);
    docViewer.addEventListener('mouseup', handleTextSelection);
    if (perWordToggle) {
        // No special handler required now — checked state is read when translating.
        perWordToggle.addEventListener('change', () => {
            showToast(perWordToggle.checked ? 'Per-word dictionary mode enabled' : 'Per-word dictionary mode disabled');
        });
    }
    copyButton.addEventListener('click', handleCopy);
    exportButton.addEventListener('click', handleExport);
    tabButtons.forEach(button => button.addEventListener('click', handleTabClick));
    pageNumInput.addEventListener('change', goToPage);
    // Handle Enter key on the page input
    pageNumInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') goToPage(); });

    // Prev/Next buttons
    if (pagePrevBtn) pagePrevBtn.addEventListener('click', () => {
        if (!currentPdf) return;
        const cur = Math.max(1, parseInt(pageNumInput.value || '1', 10));
        if (cur > 1) { pageNumInput.value = cur - 1; goToPage(); }
    });
    if (pageNextBtn) pageNextBtn.addEventListener('click', () => {
        if (!currentPdf) return;
        const cur = Math.max(1, parseInt(pageNumInput.value || '1', 10));
        if (cur < currentPdf.numPages) { pageNumInput.value = cur + 1; goToPage(); }
    });
}

// --- VIEW MANAGEMENT ---
async function renderLibraryView() { /* ... No changes ... */ libraryView.innerHTML = ''; const books = await db.getBooks(); const addBookCard = document.createElement('div'); addBookCard.className = 'add-book-card'; addBookCard.innerHTML = `<div class="book-card-icon"><i class="fa-solid fa-plus"></i></div> <div class="book-card-title">Add New Book</div>`; addBookCard.onclick = () => fileInput.click(); libraryView.appendChild(addBookCard); books.forEach(book => { const bookCard = document.createElement('div'); bookCard.className = 'book-card'; bookCard.innerHTML = ` <div class="book-card-icon"><i class="fa-solid fa-book"></i></div> <div class="book-card-title">${book.name}</div> <button class="delete-book-btn" title="Delete Book"><i class="fa-solid fa-trash-can"></i></button> `; bookCard.querySelector('.delete-book-btn').addEventListener('click', (e) => { e.stopPropagation(); if (confirm(`Are you sure you want to delete "${book.name}"?`)) { db.deleteBook(book.id).then(renderLibraryView); } }); bookCard.addEventListener('click', () => openBook(book.id)); libraryView.appendChild(bookCard); }); }

async function openBook(bookId) {
    const bookData = await db.getBook(bookId);
    if (!bookData || !bookData.file) return showToast("Error: Could not load book file.");
    
    docViewer.innerHTML = '';
    translationLog = [];
    updateHistoryView();
    
    showDocumentView();
    
    const { file } = bookData;
    const extension = file.name.split('.').pop().toLowerCase();
    if (extension === 'pdf') renderPdf(file);
    else if (extension === 'docx') renderDocx(file);
    else if (extension === 'epub') renderEpub(file);
}

function showLibraryView() {
    if (splitInstance) splitInstance.destroy();
    if (epubRendition) epubRendition.destroy();
    splitInstance = epubRendition = currentPdf = null;
    
    libraryView.classList.remove('hidden');
    docViewer.classList.add('hidden');
    backToLibraryBtn.classList.add('hidden');
    pageNavContainer.classList.add('hidden'); // Hide page nav
    
    translationPanel.classList.add('hidden');
    leftPane.classList.add('full-width');
    
    renderLibraryView();
}

// Helper to detach any existing scroll listener on docViewer
function detachDocViewerScroll() {
    try {
        if (docViewer._pageScrollHandler) docViewer.removeEventListener('scroll', docViewer._pageScrollHandler);
        if (docViewer._pageResizeHandler) window.removeEventListener('resize', docViewer._pageResizeHandler);
        if (typeof docViewer._pageScrollRaf !== 'undefined') cancelAnimationFrame(docViewer._pageScrollRaf);
        delete docViewer._pageScrollHandler;
        delete docViewer._pageResizeHandler;
        delete docViewer._pageScrollRaf;
    } catch (e) {}
}

function showDocumentView() {
    translationPanel.classList.remove('hidden');
    leftPane.classList.remove('full-width');
    libraryView.classList.add('hidden');
    docViewer.classList.remove('hidden');
    backToLibraryBtn.classList.remove('hidden');

    setTimeout(() => {
        splitInstance = Split(['#left-pane', '#translation-panel'], {
            sizes: [65, 35], minSize: 200, gutterSize: 8, cursor: 'col-resize'
        });
    }, 0);
}

// --- EVENT HANDLERS ---
async function handleFileSelect(event) { /* ... No changes ... */ const file = event.target.files[0]; if (!file) return; try { await db.addBook(file); showToast(`"${file.name}" was added to your library.`); renderLibraryView(); } catch (error) { showToast("Failed to add book to library."); console.error(error); } fileInput.value = ''; }
function handleTextSelection() { /* ... No changes ... */ setTimeout(() => { const selectedText = window.getSelection().toString().trim(); if (selectedText.length > 2) getTranslation(selectedText); }, 100); }
function handleTabClick(event) { /* ... No changes ... */ tabButtons.forEach(btn => btn.classList.remove('active')); tabContents.forEach(content => content.classList.remove('active')); const tabId = event.target.dataset.tab; event.target.classList.add('active'); document.getElementById(tabId).classList.add('active'); }
function toggleDarkMode() { /* ... No changes ... */ document.body.classList.toggle('dark-mode'); if (document.body.classList.contains('dark-mode')) { localStorage.setItem('theme', 'dark'); darkModeToggle.innerHTML = '<i class="fa-solid fa-sun"></i>'; } else { localStorage.setItem('theme', 'light'); darkModeToggle.innerHTML = '<i class="fa-solid fa-moon"></i>'; } }

// --- MAIN FUNCTIONALITY ---
async function getTranslation(textToTranslate) {
    currentTranslationContent.innerHTML = '<div class="loader"></div>';
    copyButton.disabled = true;
    const targetLanguage = languageSelect.value;
    let prompt;
    const usingPerWord = perWordToggle && perWordToggle.checked;

    if (usingPerWord) {
        // Ask the model to return a JSON array with per-word dictionary-style translations/definitions
        prompt = `You are a helpful bilingual dictionary assistant. Given the following English text, extract each distinct word (ignore punctuation) and for each word provide: the original word, probable part of speech (short), and a concise dictionary-style translation/definition in ${targetLanguage}. Also include a short example sentence in ${targetLanguage} if applicable. Return the complete result as valid JSON: an array of objects with keys \"word\", \"pos\", \"translation\", and optionally \"example\". Text: "${textToTranslate}"\n\nRespond with only the JSON array, no additional commentary.`;
    } else {
        prompt = `Translate the following text into natural and fluent ${targetLanguage}. Maintain the original context and tone. Provide only the translated text without any additional explanations or labels. Text to translate: "${textToTranslate}"\n\n${targetLanguage} Translation:`;
    }

    try {
        const apiKey = getStoredApiKey() || (typeof GOOGLE_AI_API_KEY !== 'undefined' ? GOOGLE_AI_API_KEY : undefined);
        if (!apiKey) throw new Error('API key is missing. Please add your Google AI API key in the header.');

        const response = await fetch(`${API_BASE_URL}?key=${encodeURIComponent(apiKey)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });

        if (!response.ok) {
            const errJson = await response.json().catch(() => ({}));
            const msg = errJson.error && errJson.error.message ? errJson.error.message : `API request failed with status ${response.status}`;
            throw new Error(msg);
        }

        const data = await response.json();
        const textResult = data.candidates && data.candidates[0] ? data.candidates[0].content.parts[0].text : "No translation found.";
        if (usingPerWord) {
            // Try to parse JSON from the model response
            renderPerWordDictionary(textResult, textToTranslate);
            translationLog.unshift({ original: textToTranslate, translated: textResult });
        } else {
            currentTranslationContent.innerText = textResult;
            copyButton.disabled = false;
            translationLog.unshift({ original: textToTranslate, translated: textResult });
        }
        updateHistoryView();
    } catch (error) {
        currentTranslationContent.innerText = `Error: ${error.message}`;
    } finally {
        exportButton.disabled = translationLog.length === 0;
    }
}

function renderPerWordDictionary(resultText, originalText) {
    // Attempt to parse JSON
    let parsed = null;
    try {
        // Some models may include stray characters - attempt to find first '[' and last ']'
        const first = resultText.indexOf('[');
        const last = resultText.lastIndexOf(']');
        const jsonString = (first !== -1 && last !== -1) ? resultText.slice(first, last + 1) : resultText;
        parsed = JSON.parse(jsonString);
    } catch (e) {
        parsed = null;
    }

    if (!parsed || !Array.isArray(parsed)) {
        // Fallback: show raw model output
        currentTranslationContent.innerText = resultText;
        copyButton.disabled = false;
        return;
    }

    // Build HTML list
    const container = document.createElement('div');
    container.style.padding = '8px';
    const list = document.createElement('div');
    list.style.display = 'flex';
    list.style.flexDirection = 'column';
    list.style.gap = '10px';

    parsed.forEach(item => {
        const row = document.createElement('div');
        row.style.borderBottom = '1px solid var(--border-color)';
        row.style.paddingBottom = '8px';
        row.innerHTML = `
            <div style="font-weight:700;color:var(--text-primary);font-size:1.02em;">${escapeHtml(item.word || item.WORD || '')} <span style=\"font-weight:400;color:var(--text-secondary);font-size:0.9em;\">${escapeHtml(item.pos || '')}</span></div>
            <div style="color:var(--text-primary);margin-top:6px;">${escapeHtml(item.translation || item.meaning || '')}</div>
            ${item.example ? `<div style="color:var(--text-secondary);margin-top:6px;font-style:italic;">${escapeHtml(item.example)}</div>` : ''}
        `;
        list.appendChild(row);
    });

    container.appendChild(list);
    currentTranslationContent.innerHTML = '';
    currentTranslationContent.appendChild(container);
    copyButton.disabled = false;
}

function escapeHtml(unsafe) {
    if (!unsafe && unsafe !== '') return '';
    return String(unsafe).replace(/[&<>"']/g, function(m) { return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[m]; });
}
function handleCopy() { /* ... No changes ... */ const textToCopy = currentTranslationContent.innerText; navigator.clipboard.writeText(textToCopy).then(() => showToast('Copied to clipboard!')); }
function handleExport() { /* ... No changes ... */ if (translationLog.length === 0) return showToast("No history to export."); let markdownContent = `# Translation History\n\n`; [...translationLog].reverse().forEach(item => { markdownContent += `## Original\n> ${item.original}\n\n**Translation (${languageSelect.value})**\n${item.translated}\n\n---\n\n`; }); const blob = new Blob([markdownContent], { type: 'text/markdown' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'translation_history.md'; a.click(); URL.revokeObjectURL(a.href); showToast('History exported!'); }
function updateHistoryView() { /* ... No changes ... */ historyContent.innerHTML = ''; if (translationLog.length === 0) { historyContent.innerHTML = `<div class="placeholder"><i class="fa-solid fa-clock-rotate-left"></i><p>Your translation history for this session will appear here.</p></div>`; } else { translationLog.forEach(item => { const historyItem = document.createElement('div'); historyItem.className = 'history-item'; historyItem.innerHTML = `<div class="original-text">${item.original}</div><div class="translated-text">${item.translated}</div>`; historyContent.appendChild(historyItem); }); } }

// --- PAGE NAVIGATION & FILE RENDERING ---
function goToPage() {
    if (!currentPdf) return;
    const pageNum = parseInt(pageNumInput.value, 10);
    if (pageNum >= 1 && pageNum <= currentPdf.numPages) {
        document.querySelector(`.page-container:nth-child(${pageNum})`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
        showToast(`Invalid page number. Please enter a number between 1 and ${currentPdf.numPages}.`);
    }
}

async function renderPdf(file) {
    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            const typedarray = new Uint8Array(e.target.result);
            currentPdf = await pdfjsLib.getDocument(typedarray).promise;
            
            // Show Page Navigation
            pageNavContainer.classList.remove('hidden');
            pageCountSpan.textContent = `/ ${currentPdf.numPages}`;
            pageNumInput.max = currentPdf.numPages;
            pageNumInput.value = 1;

            for (let i = 1; i <= currentPdf.numPages; i++) {
                const page = await currentPdf.getPage(i);
                const viewport = page.getViewport({ scale: 1.8 });
                const pageContainer = document.createElement('div');
                pageContainer.className = 'page-container';
                pageContainer.dataset.pageNumber = i;
                docViewer.appendChild(pageContainer);
                const canvas = document.createElement('canvas');
                canvas.height = viewport.height; canvas.width = viewport.width;
                pageContainer.appendChild(canvas);
                await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
                const textContent = await page.getTextContent();
                const textLayerDiv = document.createElement('div');
                textLayerDiv.className = 'textLayer'; pageContainer.appendChild(textLayerDiv);
                pdfjsLib.renderTextLayer({ textContent, container: textLayerDiv, viewport, textDivs: [] });
            }

            // Ensure previous scroll listener removed
            detachDocViewerScroll();

            // Visibility-based scroll handler using requestAnimationFrame
            const computeMostVisiblePage = () => {
                const pageContainers = Array.from(docViewer.querySelectorAll('.page-container'));
                if (pageContainers.length === 0) return;
                const viewerRect = docViewer.getBoundingClientRect();

                let maxArea = 0;
                let bestPage = null;

                for (const pc of pageContainers) {
                    const rect = pc.getBoundingClientRect();

                    // Compute intersection rect between viewer and page container
                    const xOverlap = Math.max(0, Math.min(rect.right, viewerRect.right) - Math.max(rect.left, viewerRect.left));
                    const yOverlap = Math.max(0, Math.min(rect.bottom, viewerRect.bottom) - Math.max(rect.top, viewerRect.top));
                    const area = xOverlap * yOverlap;
                    if (area > maxArea) { maxArea = area; bestPage = pc; }
                }

                if (bestPage && pageNumInput) {
                    const pageNumber = parseInt(bestPage.dataset.pageNumber || '1', 10);
                    if (String(pageNumInput.value) !== String(pageNumber)) {
                        pageNumInput.value = pageNumber;
                    }
                }
            };

            const onScroll = () => {
                if (typeof docViewer._pageScrollRaf !== 'undefined') cancelAnimationFrame(docViewer._pageScrollRaf);
                docViewer._pageScrollRaf = requestAnimationFrame(() => {
                    computeMostVisiblePage();
                });
            };

            // Store handlers so they can be removed later
            docViewer._pageScrollHandler = onScroll;
            docViewer._pageResizeHandler = onScroll;

            // Attach listeners
            docViewer.addEventListener('scroll', docViewer._pageScrollHandler, { passive: true });
            window.addEventListener('resize', docViewer._pageResizeHandler, { passive: true });

            // Run once to set initial page
            computeMostVisiblePage();
        } catch(error) {
            docViewer.innerHTML = `<div class="placeholder"><i class="fa-solid fa-file-circle-exclamation"></i><p>Error loading PDF: ${error.message}</p></div>`;
        }
    };
    reader.readAsArrayBuffer(file);
}

function renderDocx(file) {
    pageNavContainer.classList.add('hidden'); // Hide page nav for non-PDFs
    docx.renderAsync(file, docViewer);
}

async function renderEpub(file) {
    pageNavContainer.classList.add('hidden'); // Hide page nav for non-PDFs
    docViewer.innerHTML = ''; docViewer.style.padding = '0';
    const book = ePub(file);
    epubRendition = book.renderTo(docViewer, { width: "100%", height: "100%" });
    
    epubRendition.display();
    epubRendition.on("selected", (cfiRange) => {
        const selectedText = epubRendition.getRange(cfiRange).toString().trim();
        if (selectedText.length > 2) {
            window.getSelection().empty();
            getTranslation(selectedText);
        }
    });
}

function showToast(message) { /* ... No changes ... */ const container = document.getElementById('toast-container'); const toast = document.createElement('div'); toast.className = 'toast'; toast.textContent = message; container.appendChild(toast); setTimeout(() => toast.remove(), 3000); }