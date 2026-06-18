#!/usr/bin/env node
// Fills star counts into the README's ★ column (the 3rd column of the project
// tables). No markers needed: any table row with a GitHub link and four cells
// gets its 3rd cell rewritten; the repo is read from the link on that row, and
// the Archive table (three columns) is skipped automatically.
//
// Counts are bucketed to ~2 significant figures with a `k` suffix (rounded to
// the nearest 0.1k); anything below 0.3k is left blank — so updates
// (and commits) only happen on meaningful changes. Fetches via the `gh` CLI,
// which uses GITHUB_TOKEN/GH_TOKEN when available.

import {readFileSync, writeFileSync} from 'fs';
import {execFileSync} from 'child_process';

const FILE = 'README.md';
const STAR_COL = 2; // 3rd column (0-indexed)
const LINK = /github\.com\/([^/)\s]+\/[^/)\s]+)/;

const lines = readFileSync(FILE, 'utf8').split('\n');

const repoFor = (line) => {
    const cells = line.split('|');
    if (cells.length !== 4) return null; // not a 4-column project row
    return line.match(LINK)?.[1] ?? null; // null for the header/separator rows
};

const repos = [...new Set(lines.map(repoFor).filter(Boolean))];

const stars = {};
for (const repo of repos) {
    try {
        const out = execFileSync('gh', ['api', `repos/${repo}`, '--jq', '.stargazers_count'], {encoding: 'utf8'});
        stars[repo] = parseInt(out.trim(), 10);
    } catch (err) {
        console.error(`Failed to fetch ${repo}: ${err.message}`);
        process.exitCode = 1; // leave this repo's existing value untouched
    }
}

function bucket(n) {
    if (!n) return '';
    if (n >= 10000) return `${Math.round(n / 1000)}k`;
    const tenths = Math.round(n / 100); // count of 0.1k units
    return tenths < 3 ? '' : `${tenths / 10}k`; // drop anything below 0.3k
}

const updated = lines.map((line) => {
    const repo = repoFor(line);
    if (!repo) return line;
    const cells = line.split('|');
    const val = repo in stars ? bucket(stars[repo]) : cells[STAR_COL].trim();
    cells[STAR_COL] = val ? ` ${val} ` : ' ';
    return cells.join('|');
});

writeFileSync(FILE, updated.join('\n'));
console.log(`Updated ${Object.keys(stars).length}/${repos.length} repos.`);
