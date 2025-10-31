# TranBook — In-App Document Translator (v2.0)

TranBook is a lightweight, privacy-first web app that lets you read PDF/DOCX/EPUB files in the browser and translate selected text instantly using AI.

Live demo: https://tranbook.netlify.app/

Created by ThesoneHub from Myanmar 🇲🇲

Overview
--------
TranBook focuses on fast, contextual translations while keeping your documents local to the browser. The app is ideal for language learners and readers who want immediate, in-context translations without leaving the page.

Key features (v2.0)
- Select-to-translate: highlight any selectable text in a document to get instant AI-powered translation.
- Per-word dictionary mode: when enabled, the app returns dictionary-style translations and short example sentences for each word (great for English learners).
- Local library: upload and store `.pdf`, `.docx`, and `.epub` files in your browser (IndexedDB).
- Exportable history: export session translations to Markdown for notes.
- Responsive UI with resizable panes and dark/light theme toggle.

Tech stack
- Plain HTML/CSS/JS (no backend required)
- pdf.js, docx-preview, epub.js, split.js
- Google Gemini API for translations (API key required)

Privacy
- Files stay in your browser and are not uploaded elsewhere by the app itself. Only the text sent for translation (when you highlight/copy) is sent to the configured AI endpoint.

Getting started
1. Open `index.html` in a browser (or visit the live demo above).
2. Add your Google AI API key in the UI (or set it in `config.js`).
3. Upload documents using the "Add New Book" card and start translating by selecting text.

Credits
- Created by ThesoneHub from Myanmar 🇲🇲 — enjoy and share feedback!

License
- MIT