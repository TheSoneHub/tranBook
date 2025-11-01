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

Lo-fi background audio
----------------------
TranBook now includes an optional background Lo-fi audio player so you can listen while reading and translating.

Controls
- Header headphone icon — toggles the Lo-fi audio on/off.
- "Play Lofi" button — a play/pause button is available in the translation panel actions area.

Which audio is played
- The app loads a YouTube livestream. By default the app is configured to use the livestream with id `jfKfPfyJRdk` (the video link: https://www.youtube.com/live/jfKfPfyJRdk).

Where to change the stream
- Edit `app.js` and change the `LOFI_VIDEO_ID` constant near the top of the file. Example:

```js
// in app.js
const LOFI_VIDEO_ID = 'jfKfPfyJRdk'; // replace with your preferred YouTube video id
```

Implementation notes & browser behavior
- The player uses the YouTube IFrame API and is created in a tiny, offscreen iframe so it doesn't affect layout.
- Modern browsers block autoplay of audio/video until there is a user interaction (click/tap) on the page. Clicking the header headphone icon or the Play Lofi button counts as a user gesture and should start the audio.
- If playback doesn't start, try clicking anywhere inside the app once (to give the page an interaction) and then click the play control again.

Troubleshooting
- No audio after clicking:
	- Check the browser console for errors — some ad/tracker blockers block YouTube or the IFrame API.
	- Make sure sound is not muted and system volume is up.
	- Try a different browser (Chrome/Edge/Firefox) to confirm browser-specific autoplay restrictions.
- Player fails to initialize:
	- Ensure you have network access to `https://www.youtube.com` and the YouTube IFrame API.
	- If a content blocker prevents loading the API, the control will open the YouTube livestream in a new tab as a fallback.

Want improvements?
- I can add a visible mini-player (volume/mute/seek), let you set a default video id in the UI, or add a simple debug panel to show player state and errors. Tell me which you'd like and I'll implement it.