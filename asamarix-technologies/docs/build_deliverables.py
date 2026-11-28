"""Generate the public PDF examples. Run locally from any directory."""
import json
from pathlib import Path
from xml.sax.saxutils import escape, quoteattr

import reportlab
from reportlab.graphics.shapes import Drawing, Line, Rect, String
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

DOCS = Path(__file__).resolve().parent
ROOT = DOCS.parent
OUT = ROOT / "public/deliverables"
NAVY, BLUE, TEAL, SLATE, LINE, PAPER = map(colors.HexColor,
    ("#102B48", "#18529A", "#17636D", "#34495F", "#D7E3EB", "#F2F7FA"))
WHITE = colors.white
WIDTH = 512
font_dir = Path(reportlab.__file__).resolve().parent / "fonts"
for name, file in [("Asx", "Vera.ttf"), ("AsxBold", "VeraBd.ttf")]:
    pdfmetrics.registerFont(TTFont(name, str(font_dir / file)))


def style(name, size, leading, color=SLATE, bold=False):
    return ParagraphStyle(name, fontName="AsxBold" if bold else "Asx", fontSize=size,
                          leading=leading, textColor=color, splitLongWords=True)


STYLES = {
    "kicker": style("kicker", 9, 12, TEAL, True),
    "title": style("title", 26, 31, NAVY, True),
    "intro": style("intro", 10.3, 14.8),
    "heading": style("heading", 14, 18, NAVY, True),
    "body": style("body", 9.5, 13.6),
    "cell": style("cell", 8.6, 12.5),
    "col": style("column", 8.3, 12, WHITE, True),
    "metric": style("metric", 14, 18, NAVY, True),
    "label": style("label", 8, 11, BLUE, True),
    "source": style("source", 8.3, 12.4, BLUE),
}


def para(value, role):
    return Paragraph(escape(value), STYLES[role])


def table(rows, widths, commands):
    item = Table(rows, colWidths=widths, hAlign="LEFT")
    item.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"),
                              ("LEFTPADDING", (0, 0), (-1, -1), 8),
                              ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                              ("TOPPADDING", (0, 0), (-1, -1), 6),
                              ("BOTTOMPADDING", (0, 0), (-1, -1), 6)] + commands))
    return item


def render_block(block, accent):
    kind = block["type"]
    if kind == "metrics":
        items = block["items"]
        cells = [[para(label, "label"), Spacer(1, 3), para(value, "metric")] for label, value in items]
        return [table([cells], [WIDTH / len(items)] * len(items),
                      [("BACKGROUND", (0, 0), (-1, -1), PAPER),
                       ("LINEABOVE", (0, 0), (-1, 0), 2, accent),
                       ("INNERGRID", (0, 0), (-1, -1), .6, WHITE)])]
    if kind == "note":
        cell = [para(block["title"], "kicker"), Spacer(1, 4), para(block["body"], "body")]
        return [table([[cell]], [WIDTH], [("BACKGROUND", (0, 0), (-1, -1), PAPER),
                                          ("LINEBEFORE", (0, 0), (0, -1), 3, accent)])]
    heading = [para(block["title"], "heading"), Spacer(1, 5)]
    if kind == "bars":
        rows = block["rows"]
        graphic = Drawing(WIDTH, 21 * len(rows))
        for index, (label, value, limit) in enumerate(rows):
            if not 0 <= value <= limit or limit <= 0:
                raise ValueError(f"Invalid range for {label}")
            y = 21 * (len(rows) - index - 1) + 4
            graphic.add(String(0, y, label, fontName="Asx", fontSize=9, fillColor=SLATE))
            graphic.add(Rect(244, y + 1, 196, 6, fillColor=LINE, strokeColor=None))
            if value:
                graphic.add(Rect(244, y + 1, 196 * value / limit, 6, fillColor=accent, strokeColor=None))
            graphic.add(String(WIDTH, y, f"{value} / {limit}", textAnchor="end",
                               fontName="AsxBold", fontSize=10, fillColor=NAVY))
        return heading + [graphic]
    if kind == "milestones":
        stops = block["items"]
        width = WIDTH / len(stops)
        graphic = Drawing(WIDTH, 49)
        graphic.add(Line(0, 44, WIDTH, 44, strokeColor=LINE, strokeWidth=1))
        for i, (when, what) in enumerate(stops):
            x = i * width
            graphic.add(Rect(x, 41, 5, 5, fillColor=accent, strokeColor=None))
            graphic.add(String(x, 24, when, fontName="AsxBold", fontSize=10, fillColor=accent))
            graphic.add(String(x, 9, what, fontName="Asx", fontSize=9.3, fillColor=SLATE))
        return heading + [graphic]
    if kind == "text":
        return heading + [para(block["body"], "body")]
    if kind == "links":
        lines = []
        for name, url in block["items"]:
            lines.append(Paragraph(f'<link href={quoteattr(url)}><u>{escape(name)}</u></link>',
                                   STYLES["source"]))
        return heading + lines
    if kind != "table":
        raise ValueError(f"Unknown block {kind}")
    rows = [[para(value, "col") for value in block["columns"]]]
    rows.extend([para(value, "cell") for value in row] for row in block["rows"])
    return heading + [table(rows, [WIDTH * v for v in block["widths"]],
                            [("BACKGROUND", (0, 0), (-1, 0), accent),
                             ("ROWBACKGROUNDS", (0, 1), (-1, -1), [WHITE, PAPER]),
                             ("LINEBELOW", (0, -1), (-1, -1), .6, LINE)])]


def build(spec):
    output = OUT / spec["filename"]
    pdf = SimpleDocTemplate(str(output), pagesize=letter, leftMargin=44, rightMargin=44,
                            topMargin=74, bottomMargin=52, title=spec["title"],
                            author="Asamarix Technologies", subject=spec["service"])
    accent = BLUE if spec["kind"] == "Assessment" else TEAL
    pages = spec["pages"]

    def frame(canvas, doc):
        if doc.page > len(pages):
            raise ValueError(f"Unexpected overflow in {output.name}")
        canvas.saveState()
        canvas.drawImage(str(ROOT / "public/assets/Asamarix_Logo.png"), 46, 735, 64, 43,
                         preserveAspectRatio=True, mask="auto")
        canvas.setFillColor(NAVY)
        canvas.setFont("AsxBold", 9)
        canvas.drawString(117, 758, "Asamarix Technologies")
        canvas.setFont("Asx", 8.2)
        canvas.drawString(117, 745, spec["service"])
        canvas.setFillColor(accent)
        canvas.drawRightString(562, 752, spec["id"] + "   /   PUBLIC EXAMPLE")
        canvas.setStrokeColor(LINE)
        canvas.line(50, 732, 562, 732)
        canvas.line(50, 44, 562, 44)
        canvas.setFillColor(SLATE)
        canvas.setFont("Asx", 7.8)
        canvas.drawString(50, 30, "© Asamarix Technologies  •  Illustrative edition 1.22")
        canvas.drawRightString(562, 30, f"{doc.page} / {len(pages)}")
        # Margin watermark is visible even on pages containing opaque table fills.
        canvas.translate(22, 258)
        canvas.rotate(90)
        canvas.setFillColor(colors.HexColor("#A6BAC8"))
        canvas.setFont("AsxBold", 9)
        canvas.drawString(0, 0, "ASAMARIX TECHNOLOGIES   /   INTELLECTUAL PROPERTY")
        canvas.restoreState()

    story = []
    for n, page in enumerate(pages):
        if n:
            story.append(PageBreak())
        story.extend([para(page["category"], "kicker"), Spacer(1, 5),
                      para(page["title"], "title"), Spacer(1, 8)])
        if n == 0:
            notice = ("Hypothetical engagement. All asset observations, evidence and local risk estimates "
                      "are fictional. No live assessment was performed." if spec["kind"] == "Assessment"
                      else "Illustrative engagement. The records, owners and decisions in this document are synthetic.")
            story.extend([para(notice, "label"), Spacer(1, 7)])
        story.append(para(page["intro"], "intro"))
        for block in page["blocks"]:
            story.extend([Spacer(1, 12), *render_block(block, accent)])
    pdf.build(story, onFirstPage=frame, onLaterPages=frame)


if __name__ == "__main__":
    OUT.mkdir(exist_ok=True)
    for record in json.loads((DOCS / "deliverables.json").read_text(encoding="utf-8")):
        build(record)
