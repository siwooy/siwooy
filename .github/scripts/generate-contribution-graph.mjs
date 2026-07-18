// Generates an animated SVG of the GitHub contribution graph.
// Fetches the real contribution calendar via the GraphQL API, then renders
// the familiar dot grid where each cell pops in as a left-to-right sweep
// and a gentle wave ripples across the graph forever after.
//
// Usage: GITHUB_TOKEN=... GITHUB_USER=... node generate-contribution-graph.mjs

import { mkdirSync, writeFileSync } from "node:fs";

const LEVEL = {
  NONE: 0,
  FIRST_QUARTILE: 1,
  SECOND_QUARTILE: 2,
  THIRD_QUARTILE: 3,
  FOURTH_QUARTILE: 4,
};

// GitHub's own contribution palettes, so the graph reads as native.
const PALETTES = {
  light: {
    levels: ["#ebedf0", "#9be9a8", "#40c463", "#30a14e", "#216e39"],
    text: "#57606a",
  },
  dark: {
    levels: ["#161b22", "#0e4429", "#006d32", "#26a641", "#39d353"],
    text: "#8b949e",
  },
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export async function fetchCalendar(login, token) {
  const query = `query($login: String!) {
    user(login: $login) {
      contributionsCollection {
        contributionCalendar {
          weeks {
            contributionDays { date contributionCount contributionLevel weekday }
          }
        }
      }
    }
  }`;
  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      Authorization: `bearer ${token}`,
      "Content-Type": "application/json",
      "User-Agent": "contribution-graph-generator",
    },
    body: JSON.stringify({ query, variables: { login } }),
  });
  if (!res.ok) throw new Error(`GraphQL request failed: ${res.status} ${await res.text()}`);
  const json = await res.json();
  if (json.errors) throw new Error(`GraphQL errors: ${JSON.stringify(json.errors)}`);
  return json.data.user.contributionsCollection.contributionCalendar.weeks;
}

export function render(weeks, palette) {
  const cell = 11;
  const gap = 3;
  const pitch = cell + gap;
  const left = 32; // room for day-of-week labels
  const top = 20; // room for month labels
  const width = left + weeks.length * pitch + 8;
  const height = top + 7 * pitch + 8;

  let rects = "";
  weeks.forEach((week, x) => {
    for (const day of week.contributionDays) {
      const level = LEVEL[day.contributionLevel] ?? 0;
      const popDelay = (x * 0.04 + day.weekday * 0.012).toFixed(3);
      const waveDelay = (x * 0.06).toFixed(3);
      rects +=
        `<rect class="c" x="${left + x * pitch}" y="${top + day.weekday * pitch}" ` +
        `width="${cell}" height="${cell}" rx="2.5" fill="${palette.levels[level]}" ` +
        `style="animation-delay:${popDelay}s,${waveDelay}s">` +
        `<title>${day.date}: ${day.contributionCount}</title></rect>`;
    }
  });

  // Month labels above the columns where a new month begins, skipping any
  // label that would crowd the previous one.
  let monthLabels = "";
  let lastMonth = -1;
  let lastLabelX = -10;
  weeks.forEach((week, x) => {
    const month = Number(week.contributionDays[0].date.slice(5, 7)) - 1;
    if (month !== lastMonth) {
      if (x - lastLabelX >= 3 && x < weeks.length - 2) {
        monthLabels += `<text class="t" x="${left + x * pitch}" y="12">${MONTHS[month]}</text>`;
        lastLabelX = x;
      }
      lastMonth = month;
    }
  });

  const dayLabels = [["Mon", 1], ["Wed", 3], ["Fri", 5]]
    .map(([name, row]) => `<text class="t" x="0" y="${top + row * pitch + cell - 2}">${name}</text>`)
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
<style>
.t { font: 10px -apple-system, "Segoe UI", Helvetica, Arial, sans-serif; fill: ${palette.text}; }
.c {
  opacity: 0;
  transform-box: fill-box;
  transform-origin: center;
  animation: pop 0.5s cubic-bezier(0.25, 0.8, 0.35, 1.3) forwards,
             wave 7s ease-in-out infinite;
}
@keyframes pop {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes wave {
  0%, 8%, 100% { transform: scale(1); }
  4% { transform: scale(1.35); }
}
</style>
${monthLabels}
${dayLabels}
${rects}
</svg>`;
}

async function main() {
  const token = process.env.GITHUB_TOKEN;
  const login = process.env.GITHUB_USER;
  if (!token || !login) throw new Error("GITHUB_TOKEN and GITHUB_USER must be set");

  const weeks = await fetchCalendar(login, token);
  mkdirSync("dist", { recursive: true });
  writeFileSync("dist/contribution-graph.svg", render(weeks, PALETTES.light));
  writeFileSync("dist/contribution-graph-dark.svg", render(weeks, PALETTES.dark));
  console.log(`Rendered ${weeks.length} weeks for ${login}`);
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  await main();
}
