# docutranslate-ai
### About project

### Core Features Implemented in V1

- [x]  **🚀 Welcome Screen** — A beautiful animated welcome screen to greet users and introduce the application's purpose.
- [x]  **📚 Local Document Library**
    - Users can upload multiple documents (`.pdf`).
    - Documents are saved locally in the browser's IndexedDB, creating a persistent personal library.
    - Users can open any book from their library without re-uploading.
    - Ability to delete books from the library.
- [x]  **📖 Integrated Document Viewer**
    - High-fidelity rendering for PDF (with selectable text layer), DOCX, and EPUB files.
    - Clean, distraction-free reading interface.
- [x]  **✨ AI-Powered "Select-to-Translate"**
    - The core feature: simply highlighting text in any document instantly triggers a translation.
    - Powered by Google's Gemini AI for natural and context-aware translations.
    - Supports multiple target languages (Burmese, English, Japanese).
- [x]  **📑 Translation Management**
    - A clean, tabbed interface to switch between the current translation and the session's history.
    - **Copy to Clipboard:** Easily copy the translated text with a single click.
    - **Export to Markdown:** Export the entire session's translation history as a `.md` file, perfect for note-taking in apps like Notion.
- [x]  **👓 Professional UI/UX**
    - **Resizable Panes:** Adjust the size of the reader and translator panels for a personalized workflow.
    - **Dark Mode:** A beautiful, eye-friendly dark theme that's saved to the user's preference.
    - **Elegant Design:** A modern, clean interface with a professional color palette, typography, and subtle animations.
    - **Toast Notifications:** Non-intrusive feedback for actions like copying text or exporting history.
- [x]  **📄 PDF Page Navigation**
    - A simple and effective "Go to Page" input box for PDFs, allowing users to jump directly to any page.

### Technical Stack & Architecture

- **Frontend:** Static Web App (HTML, CSS, JavaScript)
- **Core Libraries:**
    - `pdf.js` for PDF rendering
    - `docx-preview.js` for DOCX rendering
    - `Epub.js` for EPUB rendering
    - `Split.js` for resizable panes
- **Local Storage:** IndexedDB for the document library
- **AI Backend:** Google Gemini API
- **API Key Security:** The final version uses a local `config.js` file (ignored by Git) to store the API key, ensuring it is not exposed in public repositories

### Final Decision: Feature Removals for Stability

- Removed **Table of Contents (TOC)** due to instability across document types and UI clutter. Kept the reliable **Go to Page** feature for PDFs to maintain stability and clarity.

### Open Issues

- Fonts
- Zoom in / zoom out

Here are some useful features you could add to your translation app:

1. User authentication (login/logout) for personalized settings and cloud sync.
2. Support for more file types (TXT, PPTX, XLSX).
3. Multi-language translation (select multiple target languages at once).
4. Text-to-speech for translated text.
5. OCR support for scanned PDFs and images.
6. Translation quality feedback (rate or correct translations).
7. Save favorite translations or phrases.
8. Export translations to PDF or Word.
9. Real-time collaboration (share documents and translations).
10. Mobile-friendly responsive design.

Let me know if you want details or implementation help for any feature!