//  Вызов: node parser_json.js 0301
//  0301 - 01 марта (MMDD)

import fs from "fs";
import fetch from "node-fetch";
import { load } from "cheerio";

const packedDate = process.argv[2] || "";
const packedMatch = packedDate.match(/^(\d{2})(\d{2})$/);

if (!packedMatch) {
  console.error("Использование: node parser_json.js MMDD  (например, 0301)");
  process.exit(1);
}
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
const LIMIT = 20;

function toYear(value) {
  if (!value) return "";
  const match = String(value).match(/\d{4}/);
  return match ? match[0] : "";
}

async function getAllPersons(day = 1, month = 3) {
  let url = `${BASE}/wiki/Категория:Родившиеся_${day}_${MONTH_NAMES[month]}`;
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
        bdYear: null,
        deathYear: null,
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

async function enrichWithBirthDates(persons) {
  let i = 0;
  for (const person of persons) {
    i += 1;
    try {
      console.log(`(${i}/${persons.length}) Данные для: ${person.name}`);
      const html = await fetch(person.url).then((r) => r.text());
      const $ = load(html);

      const bday = $("span.bday").first().text().trim();
      if (bday) {
        person.bdYear = toYear(bday);
      }

      const death = $("span.deathdate, span.dday").first().text().trim();
      if (death) {
        person.deathYear = toYear(death);
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
        `Не получилось получить дату для "${person.name}":`,
        e.message ?? e
      );
    }
  }
}

async function main() {
  try {
    const persons = await getAllPersons(dayNumber, monthNumber);
    await enrichWithBirthDates(persons);

    const comment = `Личности, родившиеся ${String(dayNumber).padStart(
      2,
      "0"
    )} ${MONTH_NAMES[monthNumber] ?? ""}`;

    const output = {
      day: `${String(monthNumber).padStart(2, "0")}-${String(
        dayNumber
      ).padStart(2, "0")}`,
      comment,
      persons,
    };

    console.log(`Всего найдено записей: ${persons.length}`);

    const fileName = `pyy${String(monthNumber).padStart(2, "0")}${String(
      dayNumber
    ).padStart(2, "0")}.json`;
    fs.writeFileSync(fileName, JSON.stringify(output, null, 2), "utf8");

    console.log(`Сохранено в файл ${fileName}`);
  } catch (e) {
    console.error("Ошибка:", e);
    process.exit(1);
  }
}

main();
