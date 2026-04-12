"""Convert UX_REDESIGN_ANALYSIS.md to a professional PDF."""
import re
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.colors import HexColor
from reportlab.lib.units import cm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, HRFlowable
)
from reportlab.lib.enums import TA_LEFT, TA_CENTER

# Colors
GOLD = HexColor("#D4A843")
DARK_BG = HexColor("#1a1a1a")
WHITE = HexColor("#FFFFFF")
GRAY = HexColor("#888888")
LIGHT_GRAY = HexColor("#CCCCCC")
RED = HexColor("#ef4444")
GREEN = HexColor("#22c55e")
AMBER = HexColor("#f59e0b")

def build_pdf():
    doc = SimpleDocTemplate(
        "c:/Users/User/guitarforge/UX_REDESIGN_ANALYSIS.pdf",
        pagesize=A4,
        topMargin=2*cm, bottomMargin=2*cm,
        leftMargin=2*cm, rightMargin=2*cm,
    )

    styles = getSampleStyleSheet()

    # Custom styles
    styles.add(ParagraphStyle(
        'DocTitle', parent=styles['Title'],
        fontSize=24, textColor=GOLD, spaceAfter=6,
        fontName='Helvetica-Bold',
    ))
    styles.add(ParagraphStyle(
        'DocSubtitle', parent=styles['Normal'],
        fontSize=12, textColor=GRAY, spaceAfter=20,
    ))
    styles.add(ParagraphStyle(
        'H1', parent=styles['Heading1'],
        fontSize=18, textColor=GOLD, spaceBefore=24, spaceAfter=10,
        fontName='Helvetica-Bold',
    ))
    styles.add(ParagraphStyle(
        'H2', parent=styles['Heading2'],
        fontSize=14, textColor=WHITE, spaceBefore=18, spaceAfter=8,
        fontName='Helvetica-Bold',
    ))
    styles.add(ParagraphStyle(
        'H3', parent=styles['Heading3'],
        fontSize=12, textColor=LIGHT_GRAY, spaceBefore=14, spaceAfter=6,
        fontName='Helvetica-Bold',
    ))
    styles.add(ParagraphStyle(
        'H4', parent=styles['Heading4'],
        fontSize=11, textColor=AMBER, spaceBefore=10, spaceAfter=4,
        fontName='Helvetica-BoldOblique',
    ))
    styles.add(ParagraphStyle(
        'Body', parent=styles['Normal'],
        fontSize=9.5, textColor=LIGHT_GRAY, spaceAfter=6,
        leading=14,
    ))
    styles.add(ParagraphStyle(
        'BulletItem', parent=styles['Normal'],
        fontSize=9.5, textColor=LIGHT_GRAY, spaceAfter=4,
        leftIndent=16, bulletIndent=6, leading=14,
    ))
    styles.add(ParagraphStyle(
        'TableCell', parent=styles['Normal'],
        fontSize=8, textColor=LIGHT_GRAY, leading=11,
    ))
    styles.add(ParagraphStyle(
        'TableHeader', parent=styles['Normal'],
        fontSize=8, textColor=GOLD, fontName='Helvetica-Bold', leading=11,
    ))
    styles.add(ParagraphStyle(
        'Footer', parent=styles['Normal'],
        fontSize=8, textColor=GRAY, alignment=TA_CENTER,
    ))

    # Read markdown
    with open("c:/Users/User/guitarforge/UX_REDESIGN_ANALYSIS.md", "r", encoding="utf-8") as f:
        lines = f.readlines()

    story = []

    def fmt(text):
        """Convert markdown inline formatting to reportlab XML."""
        text = text.strip()
        # Bold
        text = re.sub(r'\*\*(.+?)\*\*', r'<b>\1</b>', text)
        # Italic
        text = re.sub(r'(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)', r'<i>\1</i>', text)
        # Inline code
        text = re.sub(r'`([^`]+)`', r'<font face="Courier" color="#D4A843">\1</font>', text)
        # Links
        text = re.sub(r'\[([^\]]+)\]\([^\)]+\)', r'\1', text)
        return text

    # Parse markdown
    i = 0
    table_rows = []
    in_table = False

    def flush_table():
        nonlocal table_rows, in_table
        if not table_rows:
            return
        # Build table
        col_count = len(table_rows[0])
        col_width = (A4[0] - 4*cm) / col_count

        data = []
        for ri, row in enumerate(table_rows):
            cells = []
            for cell in row:
                style = styles['TableHeader'] if ri == 0 else styles['TableCell']
                cells.append(Paragraph(fmt(cell), style))
            data.append(cells)

        t = Table(data, colWidths=[col_width]*col_count)
        t.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), HexColor("#1a1a1a")),
            ('BACKGROUND', (0, 1), (-1, -1), HexColor("#111111")),
            ('GRID', (0, 0), (-1, -1), 0.5, HexColor("#333333")),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('TOPPADDING', (0, 0), (-1, -1), 4),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
            ('LEFTPADDING', (0, 0), (-1, -1), 6),
            ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ]))
        story.append(t)
        story.append(Spacer(1, 8))
        table_rows = []
        in_table = False

    while i < len(lines):
        line = lines[i].rstrip()

        # Skip empty lines
        if not line:
            if in_table:
                flush_table()
            i += 1
            continue

        # Horizontal rule
        if line.startswith('---'):
            if in_table:
                flush_table()
            story.append(HRFlowable(width="100%", thickness=1, color=HexColor("#333333"), spaceAfter=8, spaceBefore=8))
            i += 1
            continue

        # Table
        if '|' in line and line.strip().startswith('|'):
            cells = [c.strip() for c in line.strip().strip('|').split('|')]
            # Skip separator rows
            if all(c.replace('-', '').replace(':', '').strip() == '' for c in cells):
                i += 1
                continue
            table_rows.append(cells)
            in_table = True
            i += 1
            continue

        if in_table:
            flush_table()

        # Headers
        if line.startswith('# '):
            story.append(Paragraph(fmt(line[2:]), styles['DocTitle']))
            i += 1
            continue
        if line.startswith('## '):
            story.append(Paragraph(fmt(line[3:]), styles['H1']))
            i += 1
            continue
        if line.startswith('### '):
            story.append(Paragraph(fmt(line[4:]), styles['H2']))
            i += 1
            continue
        if line.startswith('#### '):
            story.append(Paragraph(fmt(line[5:]), styles['H3']))
            i += 1
            continue

        # Bullet points
        if line.startswith('- ') or line.startswith('  - '):
            indent = 32 if line.startswith('  ') else 16
            text = line.lstrip(' -')
            style = ParagraphStyle('BulletI', parent=styles['BulletItem'], leftIndent=indent)
            story.append(Paragraph(f"<bullet>&bull;</bullet> {fmt(text)}", style))
            i += 1
            continue

        # Numbered list
        m = re.match(r'^(\d+)\.\s+(.+)', line)
        if m:
            story.append(Paragraph(f"<b>{m.group(1)}.</b> {fmt(m.group(2))}", styles['BulletItem']))
            i += 1
            continue

        # Regular paragraph
        story.append(Paragraph(fmt(line), styles['Body']))
        i += 1

    if in_table:
        flush_table()

    # Footer
    story.append(Spacer(1, 20))
    story.append(HRFlowable(width="100%", thickness=1, color=HexColor("#333333")))
    story.append(Spacer(1, 8))
    story.append(Paragraph("GuitarForge UX Redesign Analysis | March 2026 | Confidential", styles['Footer']))

    # Custom page background
    def on_page(canvas, doc):
        canvas.saveState()
        canvas.setFillColor(HexColor("#0A0A0A"))
        canvas.rect(0, 0, A4[0], A4[1], fill=1)
        # Page number
        canvas.setFillColor(GRAY)
        canvas.setFont("Helvetica", 8)
        canvas.drawRightString(A4[0] - 2*cm, 1.2*cm, f"Page {doc.page}")
        canvas.restoreState()

    doc.build(story, onFirstPage=on_page, onLaterPages=on_page)
    print("PDF saved to UX_REDESIGN_ANALYSIS.pdf")

if __name__ == "__main__":
    build_pdf()
