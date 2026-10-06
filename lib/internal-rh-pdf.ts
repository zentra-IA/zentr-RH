import {
  PDFDocument,
  StandardFonts,
  rgb,
  PDFFont,
  PDFPage,
} from "pdf-lib";

const A4 = { width: 595.28, height: 841.89 };
const MARGIN_X = 58;
const HEADER_Y = A4.height - 38;
const CONTENT_TOP = A4.height - 88;
const CONTENT_BOTTOM = 64;
const BODY_SIZE = 10.3;
const BODY_LINE = 15.2;

const NAVY = rgb(0.07, 0.14, 0.25);
const BLUE = rgb(0.12, 0.32, 0.62);
const TEXT = rgb(0.09, 0.10, 0.12);
const MUTED = rgb(0.40, 0.43, 0.48);
const LIGHT_LINE = rgb(0.82, 0.85, 0.89);
const LIGHT_BG = rgb(0.965, 0.973, 0.984);

function normalizeForPdf(text: string) {
  return text
    .replace(/\u00a0/g, " ")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/—/g, "-")
    .replace(/–/g, "-")
    .replace(/\t/g, "    ");
}

function width(text: string, font: PDFFont, size: number) {
  return font.widthOfTextAtSize(text, size);
}

function wrap(
  text: string,
  font: PDFFont,
  size: number,
  maxWidth: number
) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [""];

  const lines: string[] = [];
  let current = words[0];

  for (let index = 1; index < words.length; index++) {
    const next = `${current} ${words[index]}`;
    if (width(next, font, size) <= maxWidth) {
      current = next;
    } else {
      lines.push(current);
      current = words[index];
    }
  }

  lines.push(current);
  return lines;
}

function isMainTitle(line: string) {
  return (
    /^CONTRATO INDIVIDUAL DE TRABALHO$/i.test(line) ||
    /^TERMO DE COMPROMISSO DE ESTÁGIO/i.test(line) ||
    /^REGIMENTO INTERNO E CÓDIGO DE CONDUTA/i.test(line)
  );
}

function isClause(line: string) {
  return /^CLÁUSULA\s+[A-ZÁÉÍÓÚÃÕÇ]+/i.test(line);
}

function isSection(line: string) {
  return /^[1-9]\.\s+[A-ZÁÉÍÓÚÃÕÇ]/.test(line);
}

function isSubsection(line: string) {
  return /^\d+\.\d+\.\s+/.test(line);
}

function isClassification(line: string) {
  return /^[A-C]\)\s+/.test(line);
}

function isSignatureRule(line: string) {
  return /^_{15,}$/.test(line);
}

function centeredX(text: string, font: PDFFont, size: number) {
  return Math.max(MARGIN_X, (A4.width - width(text, font, size)) / 2);
}

function drawHeader(page: PDFPage, regular: PDFFont, bold: PDFFont) {
  page.drawText("MOTIVAR RH", {
    x: MARGIN_X,
    y: HEADER_Y,
    size: 10.5,
    font: bold,
    color: NAVY,
  });

  page.drawText("Gestão Interna de Pessoas", {
    x: MARGIN_X + 72,
    y: HEADER_Y + 0.3,
    size: 8.5,
    font: regular,
    color: MUTED,
  });

  page.drawLine({
    start: { x: MARGIN_X, y: HEADER_Y - 10 },
    end: { x: A4.width - MARGIN_X, y: HEADER_Y - 10 },
    thickness: 1.05,
    color: BLUE,
  });
}

function drawFooter(page: PDFPage, pageNumber: number, regular: PDFFont) {
  const cnpj = process.env.MOTIVAR_RH_CNPJ || "11.333.607/0001-00";
  const address =
    process.env.MOTIVAR_RH_ADDRESS ||
    "R. Sete de Abril, 296 - República, São Paulo - SP, 01044-000";

  page.drawLine({
    start: { x: MARGIN_X, y: 45 },
    end: { x: A4.width - MARGIN_X, y: 45 },
    thickness: 0.55,
    color: LIGHT_LINE,
  });

  const institutional = `MOTIVAR RH LTDA. | CNPJ ${cnpj} | ${address}`;
  page.drawText(institutional, {
    x: MARGIN_X,
    y: 29,
    size: 6.7,
    font: regular,
    color: MUTED,
  });

  const pageLabel = `Página ${pageNumber}`;
  page.drawText(pageLabel, {
    x: A4.width - MARGIN_X - width(pageLabel, regular, 7.2),
    y: 16,
    size: 7.2,
    font: regular,
    color: MUTED,
  });
}

export async function createInternalLegalPdf(
  content: string,
  titleMetadata: string
) {
  const pdf = await PDFDocument.create();

  const times = await pdf.embedFont(StandardFonts.TimesRoman);
  const timesBold = await pdf.embedFont(StandardFonts.TimesRomanBold);
  const helvetica = await pdf.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const sourceLines = normalizeForPdf(content).split(/\r?\n/);
  const maxWidth = A4.width - MARGIN_X * 2;

  let pageNumber = 1;
  let page = pdf.addPage([A4.width, A4.height]);
  let y = CONTENT_TOP;
  let titleDrawn = false;

  function preparePage() {
    drawHeader(page, helvetica, helveticaBold);
  }

  function finishPage() {
    drawFooter(page, pageNumber, helvetica);
  }

  function newPage() {
    finishPage();
    page = pdf.addPage([A4.width, A4.height]);
    pageNumber += 1;
    y = CONTENT_TOP;
    preparePage();
  }

  function ensure(required: number) {
    if (y - required < CONTENT_BOTTOM) newPage();
  }

  function drawWrapped(
    line: string,
    font: PDFFont,
    size: number,
    lineHeight: number,
    x = MARGIN_X,
    max = maxWidth,
    color = TEXT
  ) {
    const lines = wrap(line, font, size, max);
    ensure(lines.length * lineHeight + 8);

    for (const part of lines) {
      page.drawText(part, {
        x,
        y,
        size,
        font,
        color,
      });
      y -= lineHeight;
    }
  }

  preparePage();

  for (const raw of sourceLines) {
    const line = raw.trim();

    if (!line) {
      y -= 7;
      continue;
    }

    if (isMainTitle(line) && !titleDrawn) {
      titleDrawn = true;
      const titleLines = wrap(line, timesBold, 13.4, maxWidth - 38);
      const boxHeight = titleLines.length * 18 + 22;
      ensure(boxHeight + 25);

      page.drawRectangle({
        x: MARGIN_X,
        y: y - boxHeight + 10,
        width: maxWidth,
        height: boxHeight,
        color: LIGHT_BG,
        borderColor: LIGHT_LINE,
        borderWidth: 0.7,
      });

      let titleY = y - 5;
      for (const part of titleLines) {
        page.drawText(part, {
          x: centeredX(part, timesBold, 13.4),
          y: titleY,
          size: 13.4,
          font: timesBold,
          color: NAVY,
        });
        titleY -= 18;
      }

      y -= boxHeight + 14;
      continue;
    }

    if (isClause(line)) {
      const clauseLines = wrap(line, helveticaBold, 10.6, maxWidth - 28);
      ensure(clauseLines.length * 15 + 24);
      y -= 5;

      page.drawLine({
        start: { x: MARGIN_X, y: y + 8 },
        end: { x: MARGIN_X + 20, y: y + 8 },
        thickness: 2.2,
        color: BLUE,
      });

      for (const part of clauseLines) {
        page.drawText(part, {
          x: MARGIN_X + 28,
          y,
          size: 10.6,
          font: helveticaBold,
          color: NAVY,
        });
        y -= 15;
      }

      y -= 7;
      continue;
    }

    if (isSection(line)) {
      y -= 3;
      drawWrapped(line, helveticaBold, 10.45, 15, MARGIN_X, maxWidth, NAVY);
      y -= 4;
      continue;
    }

    if (isClassification(line)) {
      y -= 2;
      drawWrapped(line, timesBold, 10.4, 15.1);
      y -= 3;
      continue;
    }

    if (isSignatureRule(line)) {
      ensure(55);
      y -= 15;
      page.drawLine({
        start: { x: MARGIN_X + 25, y },
        end: { x: A4.width - MARGIN_X - 25, y },
        thickness: 0.7,
        color: TEXT,
      });
      y -= 14;
      continue;
    }

    const important =
      /^EMPREGADORA:/i.test(line) ||
      /^EMPREGADO\(A\):/i.test(line) ||
      /^CONCEDENTE/i.test(line) ||
      /^ESTAGIÁRIO\(A\):/i.test(line) ||
      /^INSTITUIÇÃO DE ENSINO:/i.test(line) ||
      /^MOTIVAR RH LTDA\./i.test(line);

    drawWrapped(
      line,
      important ? timesBold : times,
      important ? 10.35 : BODY_SIZE,
      BODY_LINE
    );

    y -= isSubsection(line) ? 6 : important ? 4 : 5;
  }

  finishPage();

  pdf.setTitle(titleMetadata);
  pdf.setAuthor("MOTIVAR RH LTDA.");
  pdf.setCreator("MOTIVAR RH — Gestão Interna de Pessoas");
  pdf.setProducer("MOTIVAR RH");

  return pdf.save();
}
