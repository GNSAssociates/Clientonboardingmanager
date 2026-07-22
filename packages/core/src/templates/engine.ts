import Handlebars from "handlebars";

/**
 * Template engine (M4). Compiles Handlebars templates to HTML strings.
 * In production the HTML is passed to a PDF rendering service (Gotenberg /
 * Supabase Edge Function + Chromium) to produce the final PDF binary.
 * In dev mode the HTML itself is stored as the generated document.
 *
 * Helpers registered here:
 *   {{formatDate date}} — en-GB date string
 *   {{upper str}}       — uppercase
 */
Handlebars.registerHelper("formatDate", (d: string | Date) =>
  new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" }),
);

Handlebars.registerHelper("upper", (s: string) => s?.toUpperCase() ?? "");

export function compileTemplate(templateSource: string) {
  return Handlebars.compile(templateSource);
}

export function renderTemplate(templateSource: string, data: Record<string, unknown>): string {
  const compiled = compileTemplate(templateSource);
  return compiled(data);
}

/** Wrap rendered body in a minimal print-ready HTML shell. */
export function wrapHtml(body: string, title = "GNS Associates"): string {
  return `<!DOCTYPE html>
<html lang="en-GB">
<head>
  <meta charset="UTF-8" />
  <title>${Handlebars.escapeExpression(title)}</title>
  <style>
    body { font-family: Arial, Helvetica, sans-serif; font-size: 11pt; color: #111; margin: 0; }
    .page { width: 21cm; min-height: 29.7cm; margin: 0 auto; padding: 2.5cm 2cm; box-sizing: border-box; }
    h1 { font-size: 14pt; margin-bottom: 0.5em; }
    p { margin: 0.4em 0; line-height: 1.5; }
    .signature-block { margin-top: 3em; }
    @page { size: A4; margin: 0; }
    @media print { body { margin: 0; } }
  </style>
</head>
<body>
<div class="page">
${body}
</div>
</body>
</html>`;
}
