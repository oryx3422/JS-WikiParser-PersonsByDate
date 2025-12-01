//  Вызов: node parser_xml.js 0301
//  0301 - 01 марта (MMDD)

import fs from "fs";
import fetch from "node-fetch";
import { load } from "cheerio";

const packedDate = process.argv[2];
const packedMatch = packedDate.match(/^(\d{2})(\d{2})$/);
const monthNumber = packedMatch ? Number(packedMatch[1]) : 3; // MM
const dayNumber = packedMatch ? Number(packedMatch[2]) : 1; // DD
const MONTH_NAMES = {
  1: "января",
  2: "февраля",
  3: "марта",
  4: "апреля",
  5: "мая",
  6: "июня",
  7: "июля",
  8: "августа",
  9: "сентября",
  10: "октября",
  11: "ноября",
  12: "декабря",
};
const BASE = "https://ru.wikipedia.org";
const LIMIT = Infinity; //  кол-во имен для парсинга
const commentAttr = `Личности, родившиеся ${String(dayNumber).padStart(
  2,
  "0"
)} ${MONTH_NAMES[monthNumber] ?? ""}`;
const dayAttr = `${String(monthNumber).padStart(2, "0")}${String(
  dayNumber
).padStart(2, "0")}`;

function toYear(value) {
  if (!value) return "";
  const match = String(value).match(/\d{4}/);
  return match ? match[0] : "";
}

async function getAllPersons(day = 1) {
  let url = `${BASE}/wiki/Категория:Родившиеся_${day}_марта`;
  const persons = [];

  while (url) {
    console.log(`Загружаю: ${url}`);

    const html = await fetch(url).then((r) => r.text());
    const $ = load(html);

    $("#mw-pages li a").each((_, el) => {
      if (persons.length >= LIMIT) return;

      const name = $(el).text().trim();
      const href = $(el).attr("href");
      if (!href || !href.startsWith("/wiki/")) return;
      if (
        name.includes("Искать по категории") ||
        name.includes("Случайная страница")
      ) {
        return;
      }

      persons.push({
        name,
        url: BASE + href,
        birthDate: null,
        deathDate: null,
        occupation: null,
      });
    });

    if (persons.length >= LIMIT) break;

    const next = $("#mw-pages a")
      .filter((_, el) => $(el).text().includes("Следующая страница"))
      .first();

    if (next.length) {
      const href = next.attr("href");
      url = href ? BASE + href : null;
    } else {
      url = null;
    }
  }

  return persons;
}

async function enrichPersons(persons) {
  let i = 0;
  for (const person of persons) {
    i += 1;
    try {
      console.log(`(${i}/${persons.length}) ${person.name}`);
      const html = await fetch(person.url).then((r) => r.text());
      const $ = load(html);

      const bday = $("span.bday").first().text().trim();
      if (bday) {
        person.birthDate = toYear(bday);
      }

      const death = $("span.deathdate, span.dday").first().text().trim();
      if (death) {
        person.deathDate = toYear(death);
      }

      let occupation = "";
      $("table.infobox tr").each((_, tr) => {
        const label = $(tr).find("th").first().text().trim();
        if (label === "Род деятельности" || label === "Профессия") {
          occupation = $(tr)
            .find("td")
            .first()
            .text()
            .replace(/\s+/g, " ")
            .trim();
        }
      });
      if (occupation) {
        person.occupation = occupation;
      }
    } catch (e) {
      console.warn(
        `Не получилось получить данные для "${person.name}":`,
        e.message ?? e
      );
    }
  }
}

function escapeAttr(value = "") {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

async function main() {
  try {
    const persons = await getAllPersons(dayNumber);
    await enrichPersons(persons);

    const lines = persons.map((person) => {
      const birthYear = toYear(person.birthDate);
      const deathYear = toYear(person.deathDate);
      const yd = deathYear || "alive";

      return `  <psn y="${birthYear}" h="${escapeAttr(
        person.name
      )}" p="${escapeAttr(person.occupation ?? "")}" yd="${yd}" />`;
    });

    const xml =
      `<?xml version='1.0' encoding='utf-8'?>\n\n` +
      `<persons day="${dayAttr}" comm="${escapeAttr(commentAttr)}">\n\n` +
      lines.join("\n") +
      `\n\n</persons>\n`;

    const fileName = `pyy${dayAttr}.xml`;
    fs.writeFileSync(fileName, xml, "utf8");
    console.log(`XML сохранён в ${fileName}`);
  } catch (e) {
    console.error("Ошибка:", e);
    process.exit(1);
  }
}

main();
