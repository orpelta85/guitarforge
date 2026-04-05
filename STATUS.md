# STATUS.md - מצב הפרויקט: GuitarForge

> קובץ זה מתעדכן על ידי Claude בסוף כל סשן עבודה.
> מטרתו: שהסשן הבא יתחיל עם מלוא ההקשר, בלי "תן לי להסביר לך מה המצב".

## מצב נוכחי
- **שלב:** פיתוח פעיל (v3 upgrade)
- **עדכון אחרון:** 2026-04-05
- **מה עובד:** 67 exercises, progressive metronome, timer, recorder, song tracking, weekly reports, dark theme, localStorage persistence
- **מה לא עובד / באגים ידועים:** אין באגים ידועים כרגע
- **Stack:** Next.js 16 + TypeScript + Tailwind CSS 4 + Supabase

## החלטות שהתקבלו
- English UI (LTR) - not Hebrew
- Dark theme only (#0a0a0a), no light mode
- Primary accent: amber (#f59e0b)
- alphaTab for Guitar Pro rendering (dynamic import, no SSR)
- Tone.js for audio engine (metronome, synth, effects)
- All data currently in localStorage, migration to Supabase planned
- Auto-commit every ~1 hour of active work

## מה נעשה בסשן האחרון
- הוספת STATUS.md למערכת המעקב

## הצעד הבא
- המשך פיתוח לפי SPEC.md (Guitar Pro tab rendering, ear training, DAW, AI backing tracks)

## בעיות פתוחות
- אין כרגע

---

> **הוראות ל-Claude:** בסוף כל סשן עבודה על guitarforge, עדכן את הקובץ הזה. שמור על תמציתיות. ה-SPEC.md הוא המסמך הטכני המלא - STATUS.md הוא רק מצב נוכחי.
