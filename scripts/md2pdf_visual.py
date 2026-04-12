"""Convert UX_REDESIGN_ANALYSIS.md to PDF with embedded screenshots."""
import re, os
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.colors import HexColor
from reportlab.lib.units import cm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    Image, HRFlowable, KeepTogether
)
from reportlab.lib.enums import TA_LEFT, TA_CENTER

GOLD = HexColor("#D4A843")
DARK = HexColor("#1a1a1a")
WHITE = HexColor("#FFFFFF")
GRAY = HexColor("#888888")
LGRAY = HexColor("#CCCCCC")
AMBER = HexColor("#f59e0b")
ROOT = "c:/Users/User/guitarforge"

def img(name, w=None):
    path = os.path.join(ROOT, name)
    if not os.path.exists(path):
        return Spacer(1, 1)
    max_w = A4[0] - 4*cm
    if w is None:
        w = max_w
    return Image(path, width=min(w, max_w), height=min(w, max_w)*0.56)

def build():
    doc = SimpleDocTemplate(
        os.path.join(ROOT, "UX_REDESIGN_ANALYSIS_VISUAL.pdf"),
        pagesize=A4, topMargin=1.5*cm, bottomMargin=1.5*cm,
        leftMargin=2*cm, rightMargin=2*cm,
    )
    styles = getSampleStyleSheet()
    s = lambda name, **kw: styles.add(ParagraphStyle(name, **kw))

    s('T', parent=styles['Title'], fontSize=26, textColor=GOLD, fontName='Helvetica-Bold', spaceAfter=4)
    s('Sub', parent=styles['Normal'], fontSize=11, textColor=GRAY, spaceAfter=16)
    s('H1', parent=styles['Heading1'], fontSize=18, textColor=GOLD, spaceBefore=20, spaceAfter=8, fontName='Helvetica-Bold')
    s('H2', parent=styles['Heading2'], fontSize=14, textColor=WHITE, spaceBefore=16, spaceAfter=6, fontName='Helvetica-Bold')
    s('H3', parent=styles['Heading3'], fontSize=11, textColor=LGRAY, spaceBefore=12, spaceAfter=4, fontName='Helvetica-Bold')
    s('B', parent=styles['Normal'], fontSize=9.5, textColor=LGRAY, spaceAfter=5, leading=14)
    s('BL', parent=styles['Normal'], fontSize=9.5, textColor=LGRAY, spaceAfter=3, leftIndent=16, bulletIndent=6, leading=14)
    s('Cap', parent=styles['Normal'], fontSize=8, textColor=GRAY, spaceAfter=12, alignment=TA_CENTER)
    s('TC', parent=styles['Normal'], fontSize=8, textColor=LGRAY, leading=11)
    s('TH', parent=styles['Normal'], fontSize=8, textColor=GOLD, fontName='Helvetica-Bold', leading=11)
    s('Ft', parent=styles['Normal'], fontSize=8, textColor=GRAY, alignment=TA_CENTER)

    def fmt(t):
        t = t.strip()
        t = re.sub(r'\*\*(.+?)\*\*', r'<b>\1</b>', t)
        t = re.sub(r'(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)', r'<i>\1</i>', t)
        t = re.sub(r'`([^`]+)`', r'<font face="Courier" color="#D4A843">\1</font>', t)
        t = re.sub(r'\[([^\]]+)\]\([^\)]+\)', r'\1', t)
        return t

    story = []

    # ─── COVER PAGE ───
    story.append(Spacer(1, 3*cm))
    story.append(Paragraph("GuitarForge", styles['T']))
    story.append(Paragraph("UX Redesign Analysis", styles['T']))
    story.append(Spacer(1, 1*cm))
    story.append(Paragraph("Competitive Benchmarking Against Suno, Amped Studio, Audiotool", styles['Sub']))
    story.append(Paragraph("March 2026 | Elite Project Manager + UI/UX Design Agent", styles['Sub']))
    story.append(Spacer(1, 2*cm))
    story.append(HRFlowable(width="60%", thickness=2, color=GOLD, spaceAfter=20))
    story.append(Spacer(1, 1*cm))

    # GF Dashboard preview
    story.append(img("qa-dashboard.png"))
    story.append(Paragraph("Figure 1: GuitarForge Dashboard - Current State", styles['Cap']))

    # ─── COMPETITOR SCREENSHOTS ───
    story.append(Paragraph("1. Visual Comparison", styles['H1']))

    story.append(Paragraph("1.1 GuitarForge vs Competitors", styles['H2']))

    # Side by side table with screenshots
    story.append(Paragraph("GuitarForge Dashboard", styles['H3']))
    story.append(img("qa-dashboard.png"))
    story.append(Paragraph("Figure 2: GuitarForge - 11 nav items, dark panels, gold accent, ALL CAPS headers", styles['Cap']))

    story.append(Paragraph("Suno Home (logged in)", styles['H3']))
    story.append(img("ref-suno-home.png"))
    story.append(Paragraph("Figure 3: Suno Home - Left sidebar (6 items), create input centered, warm dark bg (#212126), content-first, zero ALL CAPS", styles['Cap']))

    story.append(Paragraph("Suno Create / Workspace", styles['H3']))
    story.append(img("ref-suno-create.png"))
    story.append(Paragraph("Figure 4: Suno Create - Simple/Advanced toggle, Song Description left panel, tracks list right, album art, version tags", styles['Cap']))

    story.append(Paragraph("Suno Explore", styles['H3']))
    story.append(img("ref-suno-explore.png"))
    story.append(Paragraph("Figure 5: Suno Explore - Genre cards with gradients (Pop/Country/Rock/Electronic), Staff Picks grid, large album art", styles['Cap']))

    story.append(Paragraph("Audiotool Homepage", styles['H3']))
    story.append(img("ref-audiotool.png"))
    story.append(Paragraph("Figure 6: Audiotool - Clean nav (7 items), hero section, content-first", styles['Cap']))

    story.append(Paragraph("1.2 GuitarForge Pages", styles['H2']))

    pages = [
        ("qa-practice.png", "Practice Page - Day tabs, exercise cards, empty state"),
        ("qa-songs.png", "Song Library - 338 songs, difficulty badges, backing buttons"),
        ("qa-skills.png", "Skill Tree - 39 nodes, 9 branches, SVG with glow effects"),
        ("qa-jam-live.png", "Jam Mode - A7 chord display, beat indicators, scale guide"),
        ("qa-studio.png", "Studio DAW - Transport, timeline, empty state"),
        ("qa-learning.png", "Learning Center - Compact header, 3 tabs, lesson list"),
        ("qa-coach.png", "AI Coach - Chat interface, quick actions"),
    ]
    for fi, (fname, caption) in enumerate(pages):
        story.append(img(fname))
        story.append(Paragraph(f"Figure {fi+7}: {caption}", styles['Cap']))

    # ─── FULL REPORT ───
    story.append(Paragraph("2. Full Analysis Report", styles['H1']))
    story.append(HRFlowable(width="100%", thickness=1, color=HexColor("#333333"), spaceAfter=8))

    # Parse the markdown
    with open(os.path.join(ROOT, "UX_REDESIGN_ANALYSIS.md"), "r", encoding="utf-8") as f:
        lines = f.readlines()

    table_rows = []
    in_table = False

    def flush_table():
        nonlocal table_rows, in_table
        if not table_rows:
            return
        col_count = len(table_rows[0])
        avail = A4[0] - 4*cm
        col_w = avail / col_count
        data = []
        for ri, row in enumerate(table_rows):
            cells = []
            for cell in row:
                st = styles['TH'] if ri == 0 else styles['TC']
                cells.append(Paragraph(fmt(cell), st))
            data.append(cells)
        t = Table(data, colWidths=[col_w]*col_count)
        t.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), HexColor("#1a1a1a")),
            ('BACKGROUND', (0, 1), (-1, -1), HexColor("#111111")),
            ('GRID', (0, 0), (-1, -1), 0.5, HexColor("#333333")),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('TOPPADDING', (0, 0), (-1, -1), 3),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
            ('LEFTPADDING', (0, 0), (-1, -1), 4),
            ('RIGHTPADDING', (0, 0), (-1, -1), 4),
        ]))
        story.append(t)
        story.append(Spacer(1, 6))
        table_rows = []
        in_table = False

    for line in lines:
        line = line.rstrip()
        if not line:
            if in_table: flush_table()
            continue
        if line.startswith('---'):
            if in_table: flush_table()
            story.append(HRFlowable(width="100%", thickness=0.5, color=HexColor("#333"), spaceAfter=6, spaceBefore=6))
            continue
        if '|' in line and line.strip().startswith('|'):
            cells = [c.strip() for c in line.strip().strip('|').split('|')]
            if all(c.replace('-', '').replace(':', '').strip() == '' for c in cells):
                continue
            table_rows.append(cells)
            in_table = True
            continue
        if in_table: flush_table()

        if line.startswith('# '): story.append(Paragraph(fmt(line[2:]), styles['H1']))
        elif line.startswith('## '): story.append(Paragraph(fmt(line[3:]), styles['H1']))
        elif line.startswith('### '): story.append(Paragraph(fmt(line[4:]), styles['H2']))
        elif line.startswith('#### '): story.append(Paragraph(fmt(line[5:]), styles['H3']))
        elif line.startswith('- ') or line.startswith('  - '):
            indent = 32 if line.startswith('  ') else 16
            text = line.lstrip(' -')
            st = ParagraphStyle('_bl', parent=styles['BL'], leftIndent=indent)
            story.append(Paragraph(f"<bullet>&bull;</bullet> {fmt(text)}", st))
        elif re.match(r'^\d+\.', line):
            m = re.match(r'^(\d+)\.\s*(.+)', line)
            if m: story.append(Paragraph(f"<b>{m.group(1)}.</b> {fmt(m.group(2))}", styles['BL']))
        else:
            story.append(Paragraph(fmt(line), styles['B']))

    if in_table: flush_table()

    # Footer
    story.append(Spacer(1, 20))
    story.append(HRFlowable(width="100%", thickness=1, color=HexColor("#333")))
    story.append(Spacer(1, 8))
    story.append(Paragraph("GuitarForge UX Redesign Analysis | March 2026 | Confidential", styles['Ft']))

    def on_page(canvas, doc):
        canvas.saveState()
        canvas.setFillColor(HexColor("#0A0A0A"))
        canvas.rect(0, 0, A4[0], A4[1], fill=1)
        canvas.setFillColor(GRAY)
        canvas.setFont("Helvetica", 8)
        canvas.drawRightString(A4[0] - 2*cm, 1*cm, f"Page {doc.page}")
        canvas.restoreState()

    doc.build(story, onFirstPage=on_page, onLaterPages=on_page)
    print("Visual PDF saved!")

if __name__ == "__main__":
    build()
