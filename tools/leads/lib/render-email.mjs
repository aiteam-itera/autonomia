// Render a validated recommendation draft (Markdown from the pipeline, see
// lib/prompt.mjs FORMAT) into the branded HTML email the lead receives. This is
// the send-side half of ITEA-2789; it does NOT transmit — it only produces a
// channel-agnostic message ({ to, subject, html, headers }) that the IONOS
// mail() transport sends once enabled (after human sampling + ITEA-3111/2402).
//
// Security: the draft already passed validateDraft (no prompt leak, no
// reflected injection) AND every field is HTML-escaped here before any markup
// is added — same safe-by-construction order as site/_submit.php::md_lite.
// We never interpolate raw lead text into HTML.

const SUBJECT = "Tu recomendación personalizada AutonomIA · 30 / 60 / 90 días";
const REPLY_TO = "hola@itera.es";

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Inline markup on already-escaped text: [text](url) and bare (url) → links,
// then **bold**. Only http(s)/relative URLs are linkified (no other scheme).
function inline(escaped) {
  let out = escaped.replace(
    /\[([^\]]+)\]\(((?:https?:\/\/|\/)[^)\s]+)\)/g,
    (_m, text, url) => `<a href="${url}" style="color:#1565c0;">${text}</a>`,
  );
  // Bare URL inside parentheses, e.g. "Ficha.es (https://ficha.es)".
  out = out.replace(
    /\((https?:\/\/[^)\s]+)\)/g,
    (_m, url) => `(<a href="${url}" style="color:#1565c0;">${url}</a>)`,
  );
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  return out;
}

// Markdown-lite → HTML. Blocks are separated by blank lines. A block that is a
// single **bold** line becomes an <h3> section header; "## …" becomes the
// title; everything else is a paragraph.
export function draftToHtml(draft) {
  const blocks = String(draft ?? "")
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean);

  const parts = [];
  const h3 = (t) =>
    `<h3 style="margin:18px 0 4px;font-size:16px;color:#0b1f3a;">${inline(escapeHtml(t.trim()))}</h3>`;
  const para = (t) =>
    `<p style="margin:0 0 8px;line-height:1.55;color:#1c2b3a;">${inline(escapeHtml(t)).replace(/\n/g, "<br>")}</p>`;

  for (const block of blocks) {
    const h2 = block.match(/^##\s+(.*)$/s);
    if (h2) {
      parts.push(
        `<h1 style="font-size:22px;color:#0b1f3a;margin:0 0 12px;">${inline(escapeHtml(h2[1].trim()))}</h1>`,
      );
      continue;
    }
    // A block whose FIRST line is a lone **bold** header (the pipeline keeps the
    // section header and its body in the same block) → <h3> + paragraph.
    const lines = block.split("\n");
    const lead = lines[0].match(/^\*\*([^*]+)\*\*$/);
    if (lead) {
      parts.push(h3(lead[1]));
      const rest = lines.slice(1).join("\n").trim();
      if (rest) parts.push(para(rest));
      continue;
    }
    parts.push(para(block));
  }
  return parts.join("\n");
}

// A stable, RFC-5322 Message-ID carrying the tracking ref. Replies preserve it
// in References/In-Reply-To, which is how reply-rate is correlated back to a
// send without relying on plus-addressing or polluting the subject line.
export function messageId(ref) {
  return `<reco-${ref}@itera.es>`;
}

// Build the full message for one validated draft. Channel-agnostic: the IONOS
// mail() transport maps { to, subject, html, headers } onto its call. We omit
// From/-f (IONOS sendmail rejects custom senders — see _submit.php / ITEA-2402);
// Reply-To routes replies to the team. Branded From + SPF/DKIM is ITEA-2402.
export function renderRecoEmail({ draft, lead, ref }) {
  if (!ref) throw new Error("render_reco_missing_ref");
  const to = String(lead?.email ?? "").trim();
  if (!to) throw new Error("render_reco_missing_recipient");

  const inner = draftToHtml(draft);
  const html =
    '<div style="max-width:600px;margin:0 auto;font-family:Arial,Helvetica,sans-serif;color:#1c2b3a;">' +
    '<p style="font-size:13px;color:#5a6b7b;margin:0 0 4px;">AutonomIA · Diagnóstico de madurez en IA</p>' +
    inner +
    '<hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0 12px;">' +
    '<p style="font-size:12px;color:#8595a5;line-height:1.5;margin:0;">Recibes este correo porque solicitaste tu diagnóstico en ' +
    '<a href="https://ia.itera.es" style="color:#1565c0;">ia.itera.es</a>. ' +
    'Conservamos tus respuestas un máximo de 90 días; escribe a ' +
    '<a href="mailto:hola@itera.es" style="color:#1565c0;">hola@itera.es</a> para pedir su borrado. ' +
    "¿Hablamos? Responde a este email y te ayudamos a dar el primer paso.</p></div>";

  const headers = {
    "Reply-To": REPLY_TO,
    "Message-ID": messageId(ref),
    "X-AutonomIA-Ref": ref,
    "MIME-Version": "1.0",
    "Content-Type": "text/html; charset=utf-8",
  };

  return { to, subject: SUBJECT, html, headers };
}
