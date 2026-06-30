// Contact form (#contacto on the home page) — golden path + honeypot.
//
// We mock the Worker endpoint with `page.route()` so the test never hits the
// real Cloudflare deployment. The Worker contract is exercised separately in
// the Worker repo; here we only check the *front-end* behavior:
//   - golden path: real submit → Worker called once with expected fields → UI
//     shows the success hint and disables visible inputs.
//   - honeypot: when the hidden `website` field is filled, the request still
//     fires (servers accept the call as a no-op so bots don't retune), but the
//     UI must not leak a different code path. We assert payload contains
//     `website`.
const { test, expect } = require("@playwright/test");

const FAKE_API = "https://test-worker.example.com";

async function injectApiBase(page) {
  // Override the meta-tag value before any script runs.
  await page.addInitScript((base) => {
    window.AUTONOMIA_API_BASE = base;
  }, FAKE_API);
}

async function dismissIntro(page) {
  // The intro overlay can intercept clicks. Skip it if it shows up.
  const skip = page.locator("[data-intro-skip]");
  if (await skip.isVisible().catch(() => false)) {
    await skip.click();
  }
}

test.describe("contact form", () => {
  test("golden path submits and shows success", async ({ page }) => {
    await injectApiBase(page);

    let captured = null;
    await page.route(`${FAKE_API}/api/contact`, async (route) => {
      captured = JSON.parse(route.request().postData() || "{}");
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, message: "Gracias. Te responderemos en menos de 24h." }),
      });
    });

    await page.goto("/index.html");
    await dismissIntro(page);
    await page.locator("#contacto").scrollIntoViewIfNeeded();

    await page.locator('[data-contact-form] input[name="name"]').fill("Ada Lovelace");
    await page.locator('[data-contact-form] input[name="email"]').fill("ada@example.com");
    await page.locator('[data-contact-form] select[name="sector"]').selectOption("servicios");
    await page
      .locator('[data-contact-form] textarea[name="message"]')
      .fill("Queremos automatizar la respuesta a tickets de soporte de primer nivel.");

    await page.locator('[data-contact-form] [data-contact-submit]').click();

    const hint = page.locator('[data-contact-form] [data-contact-hint]');
    await expect(hint).toBeVisible();
    await expect(hint).toContainText("Recibido");

    expect(captured).not.toBeNull();
    expect(captured).toMatchObject({
      name: "Ada Lovelace",
      email: "ada@example.com",
      sector: "servicios",
      source: "home",
    });
    expect(captured.message).toContain("automatizar");
    expect(captured.website || "").toBe("");

    // Visible fields should be disabled to prevent re-submit.
    await expect(page.locator('[data-contact-form] input[name="name"]')).toBeDisabled();
    await expect(page.locator('[data-contact-form] [data-contact-submit]')).toBeDisabled();
  });

  test("contact can be submitted without optional name", async ({ page }) => {
    await injectApiBase(page);

    let captured = null;
    await page.route(`${FAKE_API}/api/contact`, async (route) => {
      captured = JSON.parse(route.request().postData() || "{}");
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true }),
      });
    });

    await page.goto("/index.html");
    await dismissIntro(page);
    await page.locator("#contacto").scrollIntoViewIfNeeded();

    await page.locator('[data-contact-form] input[name="email"]').fill("lead@example.com");
    await page
      .locator('[data-contact-form] textarea[name="message"]')
      .fill("Queremos priorizar un primer piloto de automatización.");

    await page.locator('[data-contact-form] [data-contact-submit]').click();

    await expect(page.locator('[data-contact-form] [data-contact-hint]')).toContainText("Recibido");
    expect(captured).toMatchObject({
      name: "",
      email: "lead@example.com",
      source: "home",
    });
  });

  test("honeypot field is sent so the worker can short-circuit bots", async ({ page }) => {
    await injectApiBase(page);

    let captured = null;
    await page.route(`${FAKE_API}/api/contact`, async (route) => {
      captured = JSON.parse(route.request().postData() || "{}");
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, message: "Gracias, hemos recibido tu mensaje." }),
      });
    });

    await page.goto("/index.html");
    await dismissIntro(page);
    await page.locator("#contacto").scrollIntoViewIfNeeded();

    // Bots fill every field; emulate that by force-setting the hidden honeypot.
    await page
      .locator('[data-contact-form] input[name="website"]')
      .evaluate((el) => {
        el.value = "https://spammer.example/";
      });

    await page.locator('[data-contact-form] input[name="name"]').fill("Bot Botson");
    await page.locator('[data-contact-form] input[name="email"]').fill("bot@spammer.example");
    await page
      .locator('[data-contact-form] textarea[name="message"]')
      .fill("BUY NOW BUY NOW");

    await page.locator('[data-contact-form] [data-contact-submit]').click();

    await expect(page.locator('[data-contact-form] [data-contact-hint]')).toBeVisible();

    expect(captured).not.toBeNull();
    expect(captured.website).toBe("https://spammer.example/");
  });

  test("honeypot field is visually hidden from real users", async ({ page }) => {
    await page.goto("/index.html");
    await dismissIntro(page);
    const hp = page.locator('[data-contact-form] .contact__hp');
    await expect(hp).toHaveCount(1);
    // Off-screen container must not be visible to humans.
    await expect(hp).not.toBeInViewport();
  });
});
