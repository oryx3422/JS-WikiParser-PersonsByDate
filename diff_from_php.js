import fs from "fs";
import { load } from "cheerio";

function readText(path) {
  return fs.readFileSync(path, "utf8");
}

function parsePhpNames(phpSource) {
  const names = new Set();
  const re = /mp\[\d+\]\s*=\s*"([^"]*)"/g;
  let match;

  while ((match = re.exec(phpSource)) !== null) {
    const block = match[1];
    const parts = block.split("|");
    for (const part of parts) {
      const trimmed = part.trim();
      if (!trimmed) continue;
      const [name] = trimmed.split("!");
      if (name && name.trim()) {
        names.add(name.trim());
      }
    }
  }

  return names;
}

function buildXml(persons, day, comm) {
  const lines = persons.map((p) => {
    return `  <psn y="${p.y || ""}" h="${p.h || ""}" p="${p.p || ""}" yd="${
      p.yd || ""
    }" />`;
  });

  return (
    `<?xml version='1.0' encoding='utf-8'?>\n\n` +
    `<persons day="${day}" comm="${comm}">\n\n` +
    lines.join("\n") +
    `\n\n</persons>\n`
  );
}

async function main() {
  const code = process.argv[2] || "";
  const m = code.match(/^(\d{4})$/);
  if (!m) {
    console.error("Использование: node diff_from_php.js MMDD (например, 0301)");
    process.exit(1);
  }

  const mmdd = m[1];
  const phpPath = `${mmdd}.php`;
  const xmlPath = `pyy${mmdd}.xml`;

  if (!fs.existsSync(phpPath)) {
    console.error(`Файл ${phpPath} не найден`);
    process.exit(1);
  }
  if (!fs.existsSync(xmlPath)) {
    console.error(`Файл ${xmlPath} не найден`);
    process.exit(1);
  }

  const phpText = readText(phpPath);
  const xmlText = readText(xmlPath);

  const phpNames = parsePhpNames(phpText);

  const $ = load(xmlText, { xmlMode: true });
  const root = $("persons").first();
  const dayAttr = root.attr("day") || mmdd;
  const commAttr = root.attr("comm") || "";

  const resultPersons = [];

  $("psn").each((_, el) => {
    const h = $(el).attr("h")?.trim() || "";
    if (!h) return;

    if (phpNames.has(h)) return;

    resultPersons.push({
      y: $(el).attr("y") || "",
      h,
      p: $(el).attr("p") || "",
      yd: $(el).attr("yd") || "",
    });
  });

  const outXml = buildXml(resultPersons, dayAttr, commAttr);
  const outPath = `pyy${mmdd}_diff.xml`;
  fs.writeFileSync(outPath, outXml, "utf8");

  console.log(
    `Всего персон в исходном XML: ${
      $("psn").length
    }, из них новых (нет в PHP): ${resultPersons.length}`
  );
  console.log(`Результат записан в ${outPath}`);
}

main().catch((e) => {
  console.error("Ошибка:", e);
  process.exit(1);
});
