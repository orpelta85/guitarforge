"""סיכום והמלצות UX בעברית — PDF"""
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.colors import HexColor
from reportlab.lib.units import cm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
from reportlab.lib.enums import TA_RIGHT, TA_CENTER
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
import os

GOLD = HexColor("#D4A843")
WHITE = HexColor("#FFFFFF")
GRAY = HexColor("#888888")
LGRAY = HexColor("#CCCCCC")
RED = HexColor("#ef4444")
GREEN = HexColor("#22c55e")
AMBER = HexColor("#f59e0b")

# Register Hebrew-supporting font
try:
    pdfmetrics.registerFont(TTFont('Arial', 'C:/Windows/Fonts/arial.ttf'))
    pdfmetrics.registerFont(TTFont('ArialBd', 'C:/Windows/Fonts/arialbd.ttf'))
    FONT = 'Arial'
    FONTB = 'ArialBd'
except:
    FONT = 'Helvetica'
    FONTB = 'Helvetica-Bold'

ROOT = "c:/Users/User/guitarforge"

def build():
    doc = SimpleDocTemplate(
        os.path.join(ROOT, "UX_SUMMARY_HEBREW.pdf"),
        pagesize=A4, topMargin=2*cm, bottomMargin=2*cm,
        leftMargin=2*cm, rightMargin=2*cm,
    )
    styles = getSampleStyleSheet()

    s = lambda name, **kw: styles.add(ParagraphStyle(name, **kw))
    s('T', fontName=FONTB, fontSize=24, textColor=GOLD, alignment=TA_RIGHT, spaceAfter=4, leading=32)
    s('Sub', fontName=FONT, fontSize=11, textColor=GRAY, alignment=TA_RIGHT, spaceAfter=16, leading=16)
    s('H1', fontName=FONTB, fontSize=18, textColor=GOLD, alignment=TA_RIGHT, spaceBefore=20, spaceAfter=8, leading=24)
    s('H2', fontName=FONTB, fontSize=14, textColor=WHITE, alignment=TA_RIGHT, spaceBefore=14, spaceAfter=6, leading=20)
    s('H3', fontName=FONTB, fontSize=11, textColor=AMBER, alignment=TA_RIGHT, spaceBefore=10, spaceAfter=4, leading=16)
    s('B', fontName=FONT, fontSize=10, textColor=LGRAY, alignment=TA_RIGHT, spaceAfter=5, leading=16)
    s('BL', fontName=FONT, fontSize=10, textColor=LGRAY, alignment=TA_RIGHT, spaceAfter=3, leading=16, rightIndent=16)
    s('TC', fontName=FONT, fontSize=9, textColor=LGRAY, leading=13, alignment=TA_RIGHT)
    s('TH', fontName=FONTB, fontSize=9, textColor=GOLD, leading=13, alignment=TA_RIGHT)
    s('Ft', fontName=FONT, fontSize=8, textColor=GRAY, alignment=TA_CENTER)

    story = []

    def hr():
        story.append(HRFlowable(width="100%", thickness=1, color=HexColor("#333"), spaceAfter=8, spaceBefore=8))

    def tbl(headers, rows):
        data = [[Paragraph(h, styles['TH']) for h in headers]]
        for row in rows:
            data.append([Paragraph(str(c), styles['TC']) for c in row])
        col_w = (A4[0] - 4*cm) / len(headers)
        t = Table(data, colWidths=[col_w]*len(headers))
        t.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), HexColor("#1a1a1a")),
            ('BACKGROUND', (0, 1), (-1, -1), HexColor("#111")),
            ('GRID', (0, 0), (-1, -1), 0.5, HexColor("#333")),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('TOPPADDING', (0, 0), (-1, -1), 4),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
            ('LEFTPADDING', (0, 0), (-1, -1), 6),
            ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ]))
        story.append(t)
        story.append(Spacer(1, 8))

    # ─── COVER ───
    story.append(Spacer(1, 4*cm))
    story.append(Paragraph("GuitarForge", styles['T']))
    story.append(Paragraph("סיכום והמלצות לעיצוב מחדש", styles['T']))
    story.append(Spacer(1, 1*cm))
    story.append(Paragraph("ניתוח UX מול Suno, Amped Studio, Audiotool", styles['Sub']))
    story.append(Paragraph("מרץ 2026", styles['Sub']))
    story.append(Spacer(1, 2*cm))
    story.append(HRFlowable(width="60%", thickness=2, color=GOLD, spaceAfter=20))

    # ─── SUMMARY ───
    story.append(Paragraph("סיכום ממצאים", styles['H1']))
    hr()

    story.append(Paragraph("מה עובד טוב אצלנו", styles['H2']))
    for item in [
        "אסתטיקת Vintage Amp ייחודית — אף מתחרה לא מציע זהב, טקסטורת grain, מחוונים LED",
        "עמוד Studio/DAW — העמוד הכי חזק, עוקב אחרי קונבנציות מקצועיות",
        "כלי Learning Center — Fretboard, סקאלות, אקורדים מרשימים ופונקציונליים",
        "מערכת 3 פונטים — Oswald (כותרות) + Source Sans (גוף) + JetBrains Mono (מדידות)",
    ]:
        story.append(Paragraph(f"• {item}", styles['BL']))

    story.append(Spacer(1, 8))
    story.append(Paragraph("מה לא עובד", styles['H2']))
    for item in [
        "11 פריטי ניווט — Suno מסתדר עם 6, Amped עם 0. עומס קוגניטיבי",
        "Dashboard מוביל עם הגדרות במקום פעולה — המשתמש רואה 4 dropdowns במקום 'התחל תרגול'",
        "רשימות שטוחות של 120-338 פריטים — ללא קיבוץ, pagination, או חיפוש יעיל",
        "רקע שחור טהור (#0A0A0A) — כל המתחרים משתמשים ברקע חם יותר",
        "ALL CAPS בכל מקום — יוצר רעש ויזואלי. Suno משתמש באפס CAPS",
        "אין נגן קבוע — ניווט בין עמודים עוצר את האודיו",
        "אין onboarding — משתמש חדש נזרק לפאנל הגדרות",
    ]:
        story.append(Paragraph(f"• {item}", styles['BL']))

    # ─── COMPARISON TABLE ───
    story.append(Spacer(1, 8))
    story.append(Paragraph("טבלת השוואה", styles['H1']))
    hr()

    tbl(
        ["מימד", "Suno", "GuitarForge", "פער"],
        [
            ["פריטי ניווט", "6", "11", "קריטי — 5 יותר מדי"],
            ["רקע", "#212126 (חם)", "#0A0A0A (שחור)", "חסר חמימות"],
            ["צבע מבטא", "לבן", "זהב #D4A843", "הזהב ייחודי — לשמור"],
            ["סוג טקסט", "sentence case", "ALL CAPS בכל מקום", "להפחית CAPS"],
            ["עיגול פינות", "12-16px", "2-3px", "חד מדי"],
            ["גבולות", "כמעט אין", "כבדים + צללים", "לרכך"],
            ["מצב ריק", "איור חם + הנחיה", "מסך כהה ריק", "קריטי"],
            ["Onboarding", "0-click יצירה", "אין", "קריטי"],
            ["נגן קבוע", "בר תחתון תמידי", "רק בתוך תרגיל", "חסר"],
            ["לחיצות לפעולה", "0 (יצירה בדף הבית)", "2+ (ניווט + יום + תרגיל)", "רב מדי"],
        ]
    )

    # ─── RECOMMENDATIONS ───
    story.append(Paragraph("המלצות לפעולה", styles['H1']))
    hr()

    # CRITICAL
    story.append(Paragraph("קריטי — שבוע 1-2", styles['H2']))

    story.append(Paragraph("C1. ארגון ניווט מחדש: 11 → 5 טאבים", styles['H3']))
    tbl(
        ["טאב", "מכיל"],
        [
            ["Home", "Dashboard + Report (מאוחדים)"],
            ["Practice", "תרגול יומי (כמו היום)"],
            ["Learn", "Learning Center + תרגילים + כלים"],
            ["Studio", "Studio DAW + Jam Mode"],
            ["Library", "ספריה + שירים + Skill Tree"],
        ]
    )
    story.append(Paragraph("Profile ו-Coach → תפריט avatar בפינה. כמו ש-Suno שם Settings ו-Profile בsidebar תחתון.", styles['B']))

    story.append(Paragraph("C2. עיצוב מחדש של Dashboard — פעולה קודם", styles['H3']))
    story.append(Paragraph("לפני: Channel Settings (4 dropdowns) → Setlist → Progress → Schedule", styles['B']))
    story.append(Paragraph("אחרי: כרטיס Hero 'היום: 14 תרגילים, 124 דק' — התחל תרגול' → סטטיסטיקות → Setlist → לוח שבועי → הגדרות (מקופל)", styles['B']))
    story.append(Paragraph("למה: ב-Suno דף הבית מוביל עם יצירה. ב-Amped עם Welcome Dialog. אצלנו — עם הגדרות.", styles['B']))

    story.append(Paragraph("C3. החלפת select רגיל בחיפוש חכם", styles['H3']))
    story.append(Paragraph("לפני: dropdown רגיל עם 120+ פריטים. לאחר: פאנל חיפוש צף — מקלידים 'sweep' ורואים 5 תוצאות מיידית. מקובץ לפי קטגוריה עם צבעים.", styles['B']))
    story.append(Paragraph("הערה: כבר נבנה חלקית (exPickerOpen). צריך לשפר את ה-UX.", styles['B']))

    story.append(Paragraph("C4. מצבים ריקים + Onboarding", styles['H3']))
    story.append(Paragraph("כל עמוד ריק צריך מצב מעוצב עם הנחיה. משתמש חדש — wizard בן 3 שלבים: רמה → סגנון → זמן תרגול יומי → Auto Fill אוטומטי.", styles['B']))

    # IMPORTANT
    story.append(Spacer(1, 8))
    story.append(Paragraph("חשוב — שבוע 3-4", styles['H2']))

    story.append(Paragraph("I1. חימום רקע: #0A0A0A → #121214", styles['H3']))
    story.append(Paragraph("כל 3 המתחרים משתמשים ברקע בהיר יותר. שחור טהור יוצר ניגוד חד מדי ופאנלים בלתי נראים.", styles['B']))

    story.append(Paragraph("I2. הפחתת ALL CAPS", styles['H3']))
    story.append(Paragraph("לשמור CAPS רק ב: navbar, tags (WARM-UP, SHRED), כפתורי btn-gold. להסיר מ: כותרות סקשנים, שמות תרגילים, כפתורי ghost.", styles['B']))

    story.append(Paragraph("I3. קיבוץ ספריה + Pagination", styles['H3']))
    story.append(Paragraph("תרגילים: קיבוץ לפי קטגוריה, מקופל כברירת מחדל. שירים: 20 לעמוד + 'טען עוד'. טאבי ז'אנר למעלה.", styles['B']))

    story.append(Paragraph("I4. נגן Mini קבוע", styles['H3']))
    story.append(Paragraph("בר תחתון 48px (מעל nav במובייל): שם track, play/pause, progress bar, סגירה. כמו Suno — מוזיקה ממשיכה בזמן ניווט.", styles['B']))

    story.append(Paragraph("I5. ריכוך פינות וגבולות", styles['H3']))
    story.append(Paragraph("Panel radius: 3px → 8px. Button radius: 3px → 6px. פחות borders — להשתמש בהבדלי רקע לגובה במקום קווים.", styles['B']))

    # NICE TO HAVE
    story.append(Spacer(1, 8))
    story.append(Paragraph("נחמד שיהיה — חודש 2+", styles['H2']))

    for item in [
        "N1. איחוד Dashboard + Report לדף Home אחד",
        "N2. Skeleton Loading — שלדי טעינה אפורים במקום מסך ריק",
        "N3. אנימציות מעבר בין עמודים — fade + slide (כבר קיים ב-CSS)",
        "N4. קיצורי מקלדת — 1-5 לניווט, Space ל-play, Ctrl+K לחיפוש",
        "N5. Wizard התקנה למשתמש חדש — רמה → סגנון → זמן → Auto Fill",
    ]:
        story.append(Paragraph(f"• {item}", styles['BL']))

    # ─── PROPOSED DIRECTION ───
    story.append(Spacer(1, 8))
    story.append(Paragraph("כיוון עיצובי מוצע", styles['H1']))
    hr()

    story.append(Paragraph("ניווט: 5 טאבים (Home/Practice/Learn/Studio/Library) + avatar menu", styles['B']))
    story.append(Paragraph("רקע: #121214 (חם) → #1A1A1E (פאנלים) → #222226 (elevated)", styles['B']))
    story.append(Paragraph("צבע מבטא: לשמור זהב #D4A843 — זה הזהות שלנו", styles['B']))
    story.append(Paragraph("טיפוגרפיה: לשמור Oswald/Source Sans/JetBrains. להפחית CAPS.", styles['B']))
    story.append(Paragraph("פינות: 8px panels, 6px buttons — יותר מודרני", styles['B']))
    story.append(Paragraph("גבולות: פחות קווים, יותר הפרדה דרך רקע", styles['B']))
    story.append(Paragraph("נגן: בר תחתון קבוע עם artwork + controls", styles['B']))

    # Footer
    story.append(Spacer(1, 30))
    story.append(HRFlowable(width="100%", thickness=1, color=HexColor("#333")))
    story.append(Spacer(1, 8))
    story.append(Paragraph("GuitarForge — סיכום UX | מרץ 2026 | סודי", styles['Ft']))

    def on_page(canvas, doc):
        canvas.saveState()
        canvas.setFillColor(HexColor("#0A0A0A"))
        canvas.rect(0, 0, A4[0], A4[1], fill=1)
        canvas.setFillColor(GRAY)
        canvas.setFont("Helvetica", 8)
        canvas.drawRightString(A4[0] - 2*cm, 1*cm, f"{doc.page}")
        canvas.restoreState()

    doc.build(story, onFirstPage=on_page, onLaterPages=on_page)
    print("Hebrew summary PDF saved!")

if __name__ == "__main__":
    build()
