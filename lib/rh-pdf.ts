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
const CONTENT_BOTTOM = 62;

const BODY_SIZE = 10.2;
const BODY_LINE = 15.3;

const NAVY = rgb(0.08, 0.16, 0.29);
const BLUE = rgb(0.12, 0.32, 0.62);
const TEXT = rgb(0.10, 0.11, 0.13);
const MUTED = rgb(0.40, 0.43, 0.48);
const LIGHT_LINE = rgb(0.82, 0.85, 0.89);
const LIGHT_BG = rgb(0.96, 0.97, 0.98);

function normalizeForPdf(text: string) {
  return text
    .replace(/\u00a0/g, " ")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/—/g, "-")
    .replace(/–/g, "-")
    .replace(/\t/g, "    ");
}

function measure(text: string, font: PDFFont, size: number) {
  return font.widthOfTextAtSize(text, size);
}

function wrapLine(
  text: string,
  font: PDFFont,
  size: number,
  maxWidth: number
) {
  const words = text.trim().split(/\s+/).filter(Boolean);

  if (!words.length) return [""];

  const lines: string[] = [];
  let current = words[0];

  for (let i = 1; i < words.length; i++) {
    const candidate = `${current} ${words[i]}`;

    if (measure(candidate, font, size) <= maxWidth) {
      current = candidate;
    } else {
      lines.push(current);
      current = words[i];
    }
  }

  lines.push(current);
  return lines;
}

function isMainTitle(line: string) {
  return (
    /^CONTRATO DE PRESTAÇÃO DE SERVIÇOS/i.test(line) ||
    /^FICHA DE ABERTURA DE VAGA$/i.test(line)
  );
}

function isClauseHeading(line: string) {
  return /^CLÁUSULA\s+[A-ZÁÉÍÓÚÃÕÇ]+/i.test(line);
}

function isSectionHeading(line: string) {
  return /^[1-9]\.\s+[A-ZÁÉÍÓÚÃÕÇ][A-ZÁÉÍÓÚÃÕÇ\s/()\-]+$/.test(line);
}

function isNumberedClause(line: string) {
  return /^\d+\.\d+\.\s+/.test(line);
}

function isListItem(line: string) {
  return /^([a-z]\)|[-•])\s+/i.test(line);
}

function isSignatureRule(line: string) {
  return /^_{12,}$/.test(line);
}

function centeredX(text: string, font: PDFFont, size: number) {
  return Math.max(
    MARGIN_X,
    (A4.width - measure(text, font, size)) / 2
  );
}

function drawHeader(
  page: PDFPage,
  regular: PDFFont,
  bold: PDFFont
) {
  page.drawText("MOTIVAR RH", {
    x: MARGIN_X,
    y: HEADER_Y,
    size: 10.5,
    font: bold,
    color: NAVY,
  });

  page.drawText("Recrutamento e Seleção", {
    x: MARGIN_X + 72,
    y: HEADER_Y + 0.3,
    size: 8.5,
    font: regular,
    color: MUTED,
  });

  page.drawLine({
    start: { x: MARGIN_X, y: HEADER_Y - 10 },
    end: { x: A4.width - MARGIN_X, y: HEADER_Y - 10 },
    thickness: 1.15,
    color: BLUE,
  });
}

function drawFooter(
  page: PDFPage,
  pageNumber: number,
  regular: PDFFont
) {
  const cnpj =
    process.env.MOTIVAR_RH_CNPJ || "11.333.607/0001-00";
  const address =
    process.env.MOTIVAR_RH_ADDRESS ||
    "R. Sete de Abril, 296 - República, São Paulo - SP, 01044-000";

  page.drawLine({
    start: { x: MARGIN_X, y: 44 },
    end: { x: A4.width - MARGIN_X, y: 44 },
    thickness: 0.55,
    color: LIGHT_LINE,
  });

  const footer = `MOTIVAR RH LTDA. | CNPJ ${cnpj} | ${address}`;

  page.drawText(footer, {
    x: MARGIN_X,
    y: 29,
    size: 6.8,
    font: regular,
    color: MUTED,
  });

  const pageText = `Página ${pageNumber}`;
  page.drawText(pageText, {
    x: A4.width - MARGIN_X - measure(pageText, regular, 7.2),
    y: 16,
    size: 7.2,
    font: regular,
    color: MUTED,
  });
}

function drawParagraph(
  page: PDFPage,
  lines: string[],
  x: number,
  y: number,
  font: PDFFont,
  size: number,
  lineHeight: number,
  color = TEXT
) {
  let currentY = y;

  for (const line of lines) {
    page.drawText(line, {
      x,
      y: currentY,
      size,
      font,
      color,
    });

    currentY -= lineHeight;
  }

  return currentY;
}

export async function createLegalPdf(body: string) {
  const pdf = await PDFDocument.create();

  // Fonte jurídica clássica e legível para o corpo.
  const times = await pdf.embedFont(StandardFonts.TimesRoman);
  const timesBold = await pdf.embedFont(StandardFonts.TimesRomanBold);

  // Sans-serif apenas para cabeçalhos institucionais.
  const helvetica = await pdf.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdf.embedFont(
    StandardFonts.HelveticaBold
  );

  const sourceLines = normalizeForPdf(body).split(/\r?\n/);

  let pageNumber = 1;
  let page = pdf.addPage([A4.width, A4.height]);
  let y = CONTENT_TOP;

  const maxWidth = A4.width - MARGIN_X * 2;

  const preparePage = () => {
    drawHeader(page, helvetica, helveticaBold);
  };

  const finishPage = () => {
    drawFooter(page, pageNumber, helvetica);
  };

  const nextPage = () => {
    finishPage();

    page = pdf.addPage([A4.width, A4.height]);
    pageNumber += 1;
    y = CONTENT_TOP;

    preparePage();
  };

  const ensureSpace = (required: number) => {
    if (y - required < CONTENT_BOTTOM) {
      nextPage();
    }
  };

  preparePage();

  let titleRendered = false;

  for (let index = 0; index < sourceLines.length; index++) {
    const raw = sourceLines[index];
    const line = raw.trim();

    if (!line) {
      y -= 7;
      continue;
    }

    if (isMainTitle(line) && !titleRendered) {
      titleRendered = true;

      const wrapped = wrapLine(
        line,
        timesBold,
        13.4,
        maxWidth - 38
      );

      ensureSpace(wrapped.length * 18 + 34);

      // Faixa discreta institucional do título.
      const titleHeight = wrapped.length * 18 + 22;

      page.drawRectangle({
        x: MARGIN_X,
        y: y - titleHeight + 10,
        width: maxWidth,
        height: titleHeight,
        color: LIGHT_BG,
        borderColor: LIGHT_LINE,
        borderWidth: 0.7,
      });

      let titleY = y - 5;

      for (const part of wrapped) {
        page.drawText(part, {
          x: centeredX(part, timesBold, 13.4),
          y: titleY,
          size: 13.4,
          font: timesBold,
          color: NAVY,
        });

        titleY -= 18;
      }

      y -= titleHeight + 14;
      continue;
    }

    if (isClauseHeading(line)) {
      const wrapped = wrapLine(
        line,
        helveticaBold,
        10.7,
        maxWidth - 8
      );

      ensureSpace(wrapped.length * 15 + 25);

      y -= 5;

      page.drawLine({
        start: { x: MARGIN_X, y: y + 8 },
        end: { x: MARGIN_X + 20, y: y + 8 },
        thickness: 2.2,
        color: BLUE,
      });

      for (const part of wrapped) {
        page.drawText(part, {
          x: MARGIN_X + 28,
          y,
          size: 10.7,
          font: helveticaBold,
          color: NAVY,
        });
        y -= 15;
      }

      y -= 7;
      continue;
    }

    if (isSectionHeading(line)) {
      const wrapped = wrapLine(
        line,
        helveticaBold,
        10.4,
        maxWidth
      );

      ensureSpace(wrapped.length * 15 + 18);
      y -= 2;

      for (const part of wrapped) {
        page.drawText(part, {
          x: MARGIN_X,
          y,
          size: 10.4,
          font: helveticaBold,
          color: NAVY,
        });
        y -= 15;
      }

      y -= 4;
      continue;
    }

    if (isSignatureRule(line)) {
      ensureSpace(55);

      y -= 14;

      page.drawLine({
        start: { x: MARGIN_X + 25, y },
        end: { x: A4.width - MARGIN_X - 25, y },
        thickness: 0.7,
        color: TEXT,
      });

      y -= 15;
      continue;
    }

    if (isNumberedClause(line)) {
      const wrapped = wrapLine(
        line,
        times,
        BODY_SIZE,
        maxWidth
      );

      ensureSpace(wrapped.length * BODY_LINE + 12);

      y = drawParagraph(
        page,
        wrapped,
        MARGIN_X,
        y,
        times,
        BODY_SIZE,
        BODY_LINE,
        TEXT
      );

      y -= 6;
      continue;
    }

    if (isListItem(line)) {
      const wrapped = wrapLine(
        line,
        times,
        BODY_SIZE,
        maxWidth - 18
      );

      ensureSpace(wrapped.length * BODY_LINE + 6);

      y = drawParagraph(
        page,
        wrapped,
        MARGIN_X + 18,
        y,
        times,
        BODY_SIZE,
        BODY_LINE,
        TEXT
      );

      y -= 3;
      continue;
    }

    // Linhas institucionais/assinaturas recebem destaque discreto.
    const isPartyLabel =
      /^CONTRATADA:/i.test(line) ||
      /^CONTRATANTE:/i.test(line) ||
      /^MOTIVAR RH LTDA\./i.test(line);

    const font = isPartyLabel ? timesBold : times;
    const size = isPartyLabel ? 10.25 : BODY_SIZE;

    const wrapped = wrapLine(
      line,
      font,
      size,
      maxWidth
    );

    ensureSpace(wrapped.length * BODY_LINE + 7);

    y = drawParagraph(
      page,
      wrapped,
      MARGIN_X,
      y,
      font,
      size,
      BODY_LINE,
      TEXT
    );

    y -= isPartyLabel ? 4 : 5;
  }

  finishPage();

  pdf.setTitle("Documento RH - MOTIVAR RH");
  pdf.setAuthor("MOTIVAR RH LTDA.");
  pdf.setCreator("Sistema RH");
  pdf.setProducer("MOTIVAR RH - Gestão Documental");

  return pdf.save();
}
