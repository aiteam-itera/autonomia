function page(title: string, body: string): Response {
  const html = `<!doctype html><html lang="es"><head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${title} · AutonomIA</title>
    <style>
      body{font-family:system-ui,sans-serif;background:#0f172a;color:#e2e8f0;margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px}
      .card{max-width:520px;background:#1e293b;border-radius:16px;padding:32px;line-height:1.55}
      h1{margin-top:0;font-size:1.5rem}
      a{color:#a5b4fc}
      .muted{color:#94a3b8;font-size:14px;margin-top:24px}
    </style>
  </head><body><div class="card">${body}</div></body></html>`;
  return new Response(html, {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

export function htmlConfirmed(): Response {
  return page(
    "Plan en camino",
    `<h1>Listo, en unos segundos te llegará tu plan</h1>
     <p>Estamos generando tu plan personalizado a 30 / 60 / 90 días. Llegará al email que indicaste en menos de un minuto.</p>
     <p>Si no aparece, revisa la carpeta de spam.</p>
     <p class="muted">— AutonomIA</p>`,
  );
}

export function htmlAlreadyUsed(): Response {
  return page(
    "Enlace ya usado",
    `<h1>Este enlace ya se usó</h1>
     <p>Por seguridad cada enlace de confirmación se puede usar una sola vez. Si no recibiste el email, vuelve al cuestionario y solicita un nuevo plan.</p>
     <p class="muted">— AutonomIA</p>`,
  );
}

export function htmlInvalid(): Response {
  return new Response(
    `<!doctype html><html lang="es"><head><meta charset="utf-8" /><title>Enlace no válido · AutonomIA</title></head>
     <body style="font-family:system-ui,sans-serif;background:#0f172a;color:#e2e8f0;margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px">
       <div style="max-width:520px;background:#1e293b;border-radius:16px;padding:32px;line-height:1.55">
         <h1 style="margin-top:0;font-size:1.5rem">Enlace no válido o caducado</h1>
         <p>El enlace puede haber caducado (caduca en 24h) o no existir. Vuelve al cuestionario y pídelo de nuevo.</p>
       </div>
     </body></html>`,
    { status: 404, headers: { "content-type": "text/html; charset=utf-8" } },
  );
}
