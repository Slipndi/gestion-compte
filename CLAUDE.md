# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

A personal family budget PWA (Progressive Web App) in French. No build step, no package manager — the entire application is a single `index.html` with all JavaScript inline. Dependencies are loaded via CDN (Tailwind CSS JIT, Supabase JS v2).

## Running the app

Open `index.html` directly in a browser, or serve the directory with any static file server:

```bash
python3 -m http.server 8080
# or
npx serve .
```

There is no build step, no compilation, no `npm install`.

## Supabase setup

The app requires a Supabase project. To set one up:

1. Create a project at supabase.com
2. Run `schema.sql` in the Supabase SQL Editor to create all tables and RLS policies
3. Set `SUPABASE_URL` and `SUPABASE_ANON_KEY` in `index.html` (currently hardcoded at the top of the `<script>` block)

For GitHub Pages deployment, the workflow in `.github/workflows/deploy.yml` injects these values from GitHub secrets (`SUPABASE_URL`, `SUPABASE_ANON_KEY`) at deploy time via `sed`.

## Architecture

**Single-file SPA**: All app logic lives inside an IIFE in `index.html`. There are no modules, no components, no framework — just vanilla JS with imperative DOM manipulation via `innerHTML`.

**State**: Six module-level variables hold all in-memory state: `session`, `tab`, `cur` (current month as a Date), `categories`, `recurrents`, `depenses`, `revDefault`, `revMonth`.

**Data flow**:
- On login → `bootstrap()` seeds default data if tables are empty, then calls `loadMonth()`
- `loadMonth()` fetches `depenses` and `revenu_months` for the current month key (`YYYY-MM-01`)
- `render()` dispatches to one of four tab renderers: `renderMois()`, `renderRecurrents()`, `renderCategories()`, `renderRevenus()`
- Each renderer overwrites `app.innerHTML` entirely, then wires event listeners
- Modals are rendered into `#modal-root` via `openModal()` / `closeModal()`

**Database (Supabase / PostgreSQL)**:

| Table | Purpose |
|---|---|
| `categories` | Expense categories with name + color |
| `recurrents` | Recurring payments with `start_month`/`end_month` date range and `active` flag |
| `depenses` | One-time expenses, linked to a `month` (first of month) and optional `category_id` |
| `revenu_defaults` | One row per user — baseline monthly income (ludovic, marie_laure, aides) |
| `revenu_months` | Per-month income override; if absent for a month, `revenu_defaults` is used |

All tables use Supabase RLS: `auth.uid() = user_id` so each user only sees their own data. The `user_id` column defaults to `auth.uid()` on insert.

**Month key convention**: months are stored as the first day of the month in ISO format (`YYYY-MM-01`). The `monthKey()` helper generates this from a `Date`, and `k()` returns the key for the current `cur` month.

**PWA**: `sw.js` caches the app shell (index.html, manifest, icon) using a cache-first strategy. Supabase API calls (`*.supabase.co`) are always fetched from the network.

**Seed data**: `SEED_CATS` and `SEED_RECS` constants in `index.html` define default categories and recurring payments that are inserted on first use (bootstrap) or via the "Importer le modèle" button.
