// Generates the profile's SVGs in a warm editorial style (meredic.com):
// cream/charcoal cards, Instrument Serif headlines with an italic copper
// accent, and the contribution graph in copper tones with a diagonal
// cascade entrance plus a looping ripple.
//
// Outputs: dist/header.svg, dist/header-dark.svg,
//          dist/contribution-graph.svg, dist/contribution-graph-dark.svg
//
// Usage: GITHUB_TOKEN=... GITHUB_USER=... node generate-contribution-graph.mjs

import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ASSETS = join(dirname(fileURLToPath(import.meta.url)), "..", "assets");

const LEVEL = {
  NONE: 0,
  FIRST_QUARTILE: 1,
  SECOND_QUARTILE: 2,
  THIRD_QUARTILE: 3,
  FOURTH_QUARTILE: 4,
};

// Warm editorial palettes: cream card with copper ink for light,
// charcoal card with glowing copper for dark.
export const THEMES = {
  light: {
    card: "#F2EDE3",
    ink: "#26221C",
    muted: "#8A8071",
    accent: "#A87C52",
    levels: ["#E6DFCF", "#DCC5A2", "#C6A272", "#A87C52", "#7C5A38"],
  },
  dark: {
    card: "#1B1916",
    ink: "#EDE7DA",
    muted: "#8F8678",
    accent: "#C89B66",
    levels: ["#282420", "#4E3B29", "#75512F", "#A2703C", "#D8A96A"],
  },
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const SANS = `-apple-system, "Segoe UI", Helvetica, Arial, sans-serif`;
const WIDTH = 840;

function fontFaces() {
  const regular = readFileSync(join(ASSETS, "instrument-serif-regular.woff2")).toString("base64");
  const italic = readFileSync(join(ASSETS, "instrument-serif-italic.woff2")).toString("base64");
  return `@font-face {
  font-family: "Instrument Serif";
  font-style: normal;
  src: url(data:font/woff2;base64,${regular}) format("woff2");
}
@font-face {
  font-family: "Instrument Serif";
  font-style: italic;
  src: url(data:font/woff2;base64,${italic}) format("woff2");
}`;
}

export async function fetchCalendar(login, token) {
  const query = `query($login: String!) {
    user(login: $login) {
      contributionsCollection {
        contributionCalendar {
          totalContributions
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
  return json.data.user.contributionsCollection.contributionCalendar;
}

export function renderHeader(theme, fonts) {
  const height = 250;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${height}" viewBox="0 0 ${WIDTH} ${height}">
<style>
${fonts}
.serif { font-family: "Instrument Serif", Georgia, serif; font-size: 46px; fill: ${theme.ink}; }
.accent { font-style: italic; fill: ${theme.accent}; }
.sub { font: 14px ${SANS}; fill: ${theme.muted}; letter-spacing: 0.04em; }
.rise { opacity: 0; animation: rise 0.9s cubic-bezier(0.2, 0.7, 0.2, 1) forwards; }
.underline { transform-origin: left center; transform: scaleX(0); animation: draw 0.7s cubic-bezier(0.3, 0, 0.2, 1) 1.1s forwards; }
@keyframes rise {
  from { opacity: 0; transform: translateY(16px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes draw { to { transform: scaleX(1); } }
</style>
<rect x="0" y="0" width="${WIDTH}" height="${height}" rx="28" fill="${theme.card}"/>
<g class="rise">
  <text class="serif" x="64" y="106">Hi, I&#8217;m Siwoo &#8212; building from</text>
</g>
<g class="rise" style="animation-delay: 0.18s">
  <text class="serif" x="64" y="160"><tspan class="accent">curiosity</tspan> to product.</text>
</g>
<rect class="underline" x="64" y="170" width="152" height="2" fill="${theme.accent}"/>
<g class="rise" style="animation-delay: 0.4s">
  <text class="sub" x="64" y="208">Computer Science&#160;&#160;&#183;&#160;&#160;Machine Learning&#160;&#160;&#183;&#160;&#160;Student</text>
</g>
</svg>`;
}

export function renderGraph(calendar, theme, fonts) {
  const { weeks, totalContributions } = calendar;
  const cell = 11;
  const gap = 3;
  const pitch = cell + gap;
  const gridWidth = weeks.length * pitch - gap;
  const left = Math.round((WIDTH - gridWidth) / 2) + 14; // optically centered, room for day labels
  const top = 96;
  const height = top + 7 * pitch + 30;

  let rects = "";
  weeks.forEach((week, x) => {
    for (const day of week.contributionDays) {
      const y = day.weekday;
      const level = LEVEL[day.contributionLevel] ?? 0;
      // diagonal cascade in, then a diagonal ripple forever
      const cascade = (0.4 + (x + y) * 0.022).toFixed(3);
      const ripple = ((x + y) * 0.055).toFixed(3);
      rects +=
        `<rect class="c" x="${left + x * pitch}" y="${top + y * pitch}" ` +
        `width="${cell}" height="${cell}" rx="2.5" fill="${theme.levels[level]}" ` +
        `style="animation-delay:${cascade}s,${ripple}s">` +
        `<title>${day.date}: ${day.contributionCount}</title></rect>`;
    }
  });

  let monthLabels = "";
  let lastMonth = -1;
  let lastLabelX = -10;
  weeks.forEach((week, x) => {
    const month = Number(week.contributionDays[0].date.slice(5, 7)) - 1;
    if (month !== lastMonth) {
      if (x - lastLabelX >= 3 && x < weeks.length - 2) {
        monthLabels += `<text class="t" x="${left + x * pitch}" y="${top - 10}">${MONTHS[month]}</text>`;
        lastLabelX = x;
      }
      lastMonth = month;
    }
  });

  const dayLabels = [["Mon", 1], ["Wed", 3], ["Fri", 5]]
    .map(([name, row]) => `<text class="t" x="${left - 34}" y="${top + row * pitch + cell - 2}">${name}</text>`)
    .join("");

  const count = totalContributions.toLocaleString("en-US");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${height}" viewBox="0 0 ${WIDTH} ${height}">
<style>
${fonts}
.title { font-family: "Instrument Serif", Georgia, serif; font-size: 26px; fill: ${theme.ink}; }
.title .n { font-style: italic; fill: ${theme.accent}; }
.t { font: 10px ${SANS}; fill: ${theme.muted}; }
.rise { opacity: 0; animation: rise 0.9s cubic-bezier(0.2, 0.7, 0.2, 1) forwards; }
.c {
  opacity: 0;
  transform-box: fill-box;
  transform-origin: center;
  animation: cascade 0.6s cubic-bezier(0.25, 0.9, 0.35, 1.25) forwards,
             ripple 8s ease-in-out infinite;
}
@keyframes rise {
  from { opacity: 0; transform: translateY(16px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes cascade {
  from { opacity: 0; transform: scale(0); }
  60% { opacity: 1; transform: scale(1.18); }
  to { opacity: 1; transform: scale(1); }
}
@keyframes ripple {
  0%, 10%, 100% { transform: scale(1); }
  5% { transform: scale(1.3); }
}
</style>
<rect x="0" y="0" width="${WIDTH}" height="${height}" rx="28" fill="${theme.card}"/>
<g class="rise">
  <text class="title" x="64" y="48"><tspan class="n">${count}</tspan>&#160;&#160;contributions in the last year</text>
</g>
${monthLabels}
${dayLabels}
${rects}
</svg>`;
}

async function main() {
  const token = process.env.GITHUB_TOKEN;
  const login = process.env.GITHUB_USER;
  if (!token || !login) throw new Error("GITHUB_TOKEN and GITHUB_USER must be set");

  const calendar = await fetchCalendar(login, token);
  const fonts = fontFaces();
  mkdirSync("dist", { recursive: true });
  writeFileSync("dist/header.svg", renderHeader(THEMES.light, fonts));
  writeFileSync("dist/header-dark.svg", renderHeader(THEMES.dark, fonts));
  writeFileSync("dist/contribution-graph.svg", renderGraph(calendar, THEMES.light, fonts));
  writeFileSync("dist/contribution-graph-dark.svg", renderGraph(calendar, THEMES.dark, fonts));
  console.log(`Rendered ${calendar.weeks.length} weeks (${calendar.totalContributions} contributions) for ${login}`);
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  await main();
}

export { fontFaces };
