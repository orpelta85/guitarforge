# Frontend

## Visual Style
- Aesthetic: dark, minimal, premium music tool
- Feel: professional practice app — not flashy, data-first
- Dark theme only: `#0a0a0a` background, no light mode ever
- Accent color: amber (`#f59e0b`)
- Typography: system-ui / Inter — weights 400 body, 500 labels, 600 headings

## Layout & Direction
- RTL layout (Hebrew UI)
- All new UI text in Hebrew
- Music terms (BPM, chord names, scale names, modes) stay in English
- Responsive — mobile-first

## Libraries in Use
- recharts — for progress/stats charts
- react-youtube — for video embeds
- alphaTab — sheet music rendering (dynamic import only, ssr: false)
- wavesurfer.js — waveform display (dynamic import only, ssr: false)
- Tone.js — audio synthesis (dynamic import only, ssr: false)
