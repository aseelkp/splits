# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Backend: Python, FastAPI, SQLAlchemy 2.0, Alembic, Pydantic, official MCP Python SDK (FastMCP). Database: Supabase Postgres via transaction pooler. Frontend: React + Vite, mobile-first PWA, plain CSS or Tailwind. Hosting: Vercel free plan. (Source: user's written brief.)

## Users

One person, the owner. They log gym sessions and treadmill/outdoor runs on their phone, one-handed, between sets. Single user, no accounts.

## Product Purpose

A personal gym and running logbook. Success is logging a set in a few taps with no friction, seeing last time's numbers next to today's, and being able to log and read history from Claude chat through an MCP connector.

## Positioning

A serious training logbook, not a SaaS dashboard or a fitness-influencer app. Calm, focused, fast. Two input paths to the same data: a phone UI and Claude chat.

## Operating Context

Used in a gym on a phone, mid-workout, often with one hand. Logging style is shorthand such as "30x2x10" (weight x sets x reps) or "35x10". Timezone is Asia/Kolkata. Session types: push, pull, lower, upper, run, other. A session can hold both sets and a run. Units (kg/lbs) are stored per set and never auto-converted.

## Capabilities and Constraints

- Log sessions with sets (exercise, weight, unit, reps or duration, remark, warmup flag) and runs (mode, duration, distance, incline, avg/max HR, structure, remark).
- Pre-fill a new session from the last session of the same type, showing last time's weight x reps.
- Exercise history list and a line chart of best set over time.
- Autosave; no data lost when switching apps.
- Single password login (signed httpOnly cookie). MCP endpoint at a secret path.
- Free hosting only. Out of scope for v1: multiple users, OAuth, social, in-app AI, offline mode.

## Brand Commitments

Binding visual constraints from the user: dark theme by default with a light theme; one accent color used only for primary actions and progress; no gradients, no glassmorphism, no emoji, no stock illustrations, no cards-inside-cards, no generic hero sections; large tabular numerals; big tap targets. Two visual directions must be proposed as static mockups and the user picks one before the frontend is built.

## Evidence on Hand

No real data in the repo yet. The user will supply a JSON history file for import. No logo or brand assets exist. Do not fabricate sample history beyond clearly labelled placeholders.

## Product Principles

1. Speed at the gym beats feature count: every screen is judged by taps between sets.
2. Numbers are the hero; text is minimal.
3. Show progress honestly: last time versus today, side by side, with no inflated charts.
4. One source of truth: the web app and Claude see the same data through the same service layer.
5. Never convert or guess units silently.

## Accessibility & Inclusion

Large tap targets and readable tabular numerals under gym lighting; sufficient contrast in both dark and light themes. No other product-specific requirement established.
