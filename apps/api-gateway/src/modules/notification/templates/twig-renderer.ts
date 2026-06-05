/**
 * apps/api-gateway/src/modules/notification/templates/twig-renderer.ts
 *
 * Phase 3 dev: simple mustache-style replacement {{ var }}.
 * Phase 6 sẽ thay bằng Twig runtime (twig npm) để có logic + filters.
 *
 * Templates ship trong src/modules/notification/templates/*.twig;
 * load qua fs.readFile + render.
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const TEMPLATE_DIR = join(__dirname, "templates");

export async function renderTemplate(
  name: string,
  vars: Record<string, unknown>,
): Promise<{ subject: string; html: string; text: string }> {
  const html = await readFile(join(TEMPLATE_DIR, `${name}.html`), "utf-8");
  const text = await readFile(join(TEMPLATE_DIR, `${name}.txt`), "utf-8");
  const subject = (await readFile(join(TEMPLATE_DIR, `${name}.subject.txt`), "utf-8")).trim();

  return {
    subject: replace(subject, vars),
    html: replace(html, vars),
    text: replace(text, vars),
  };
}

function replace(template: string, vars: Record<string, unknown>): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => {
    const v = vars[k];
    if (v === null || v === undefined) return "";
    return String(v);
  });
}
