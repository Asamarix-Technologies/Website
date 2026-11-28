"""Build the public example PDFs from deliverables.json."""
import json
from pathlib import Path
from xml.sax.saxutils import escape

import reportlab
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import PageBreak, Paragraph, SimpleDocTemplate

DOCS = Path(__file__).resolve().parent
OUTPUT = DOCS.parent / "public" / "deliverables"
NAVY = colors.HexColor("#102743")
BLUE = colors.HexColor("#1852a3")
SLATE = colors.HexColor("#455a71")
LINE = colors.HexColor("#d6e2ee")
PALE = colors.HexColor("#eef5fc")

FONT_DIR = Path(reportlab.__file__).resolve().parent / "fonts"
pdfmetrics.registerFont(TTFont("Vera", str(FONT_DIR / "Vera.ttf")))
pdfmetrics.registerFont(TTFont("Vera-Bold", str(FONT_DIR / "VeraBd.ttf")))

STYLES = {
    "title": ParagraphStyle("Title", fontName="Vera-Bold", fontSize=28, leading=33, textColor=NAVY, spaceAfter=10),
    "label": ParagraphStyle("Label", fontName="Vera-Bold", fontSize=10, leading=14, textColor=BLUE, spaceAfter=7),
    "note": ParagraphStyle("Note", fontName="Vera-Bold", fontSize=10.5, leading=15, textColor=NAVY,
                           backColor=PALE, borderPadding=9, spaceBefore=8, spaceAfter=15),
    "heading": ParagraphStyle("Heading", fontName="Vera-Bold", fontSize=14, leading=18, textColor=NAVY,
                              spaceBefore=12, spaceAfter=5, keepWithNext=True),
    "body": ParagraphStyle("Body", fontName="Vera", fontSize=11, leading=16, textColor=SLATE,
                           alignment=TA_LEFT, spaceAfter=6),
}


def paragraph(value, style):
    return Paragraph(escape(value), STYLES[style])


def page_frame(canvas, document):
    width, height = document.pagesize
    left = document.leftMargin
    right = width - document.rightMargin
    canvas.saveState()
    canvas.setStrokeColor(LINE)
    canvas.line(left, height - 56, right, height - 56)
    canvas.line(left, 47, right, 47)
    canvas.setFillColor(NAVY)
    canvas.setFont("Vera-Bold", 10)
    canvas.drawString(left, height - 43, "Asamarix Technologies")
    canvas.setFillColor(SLATE)
    canvas.setFont("Vera", 9)
    canvas.drawString(left, 32, document.footer)
    canvas.drawRightString(right, 32, str(document.page))
    canvas.restoreState()


def build(spec):
    document = SimpleDocTemplate(
        str(OUTPUT / spec["filename"]),
        pagesize=letter,
        leftMargin=58,
        rightMargin=58,
        topMargin=76,
        bottomMargin=66,
        title=spec["title"],
        author="Asamarix Technologies",
        subject=spec["service"],
    )
    document.footer = spec.get("footer", "Illustrative Deliverable")
    story = [
        paragraph(spec["service"], "label"),
        paragraph(spec["title"], "title"),
        paragraph(spec["notice"], "note"),
    ]
    for number, page in enumerate(spec["pages"]):
        if number:
            story.append(PageBreak())
        for heading, *details in page:
            story.append(paragraph(heading, "heading"))
            story.extend(paragraph(detail, "body") for detail in details)
    document.build(story, onFirstPage=page_frame, onLaterPages=page_frame)


if __name__ == "__main__":
    OUTPUT.mkdir(parents=True, exist_ok=True)
    for spec in json.loads((DOCS / "deliverables.json").read_text(encoding="utf-8")):
        build(spec)
