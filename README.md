# Onboarding Agent

An AI agent that onboards new hires and offboards departing employees. You describe the person in plain words; the agent works through a simulated company directory one tool call at a time, pauses for a person's approval before anything sensitive, and records every change in an audit log.

**Live demo:** https://it-onboarding-agent-nine.vercel.app/

Built by [Anthony Jaimez](https://portfolio-eosin-delta-24.vercel.app/), from years of doing this work by hand on enterprise service desks.

## What it does

**Onboarding:** reads the department's access policy, finds the manager, creates the account (handling username collisions), assigns the license, adds groups, reserves the laptop and peripherals, opens an imaging task for Desktop Support and drafts a welcome email for the manager.

**Offboarding:** finds the user, disables the account, removes group memberships and licenses, schedules the equipment pickup and drafts a note to the manager about mailbox and file handover.

When something goes wrong it doesn't stop: out-of-stock hardware gets backordered, an exhausted license pool becomes a Procurement task, and the final summary separates what's done from what still needs a person.

## How it works

- **Agent loop** (`src/lib/agent.ts`): Claude (`claude-haiku-5-5`) with tool use, one tool call per turn so every step is visible and auditable. A hard cap of 30 model calls per run.
- **Tools** (`src/lib/tools.ts`): 13 tools that read and change the simulated directory (`src/lib/company.ts`): users, groups, license pools, hardware inventory, tasks, email drafts.
- **Approvals enforced in code, not in the prompt.** Adding someone to a sensitive group (payroll files, employee records) or disabling an account pauses the run until a person approves or denies it. Domain-Admins and Prod-Access are refused outright, so a request that asks for them can't talk its way in.
- **Stateless server, signed state.** The run's conversation, directory and step count travel with the browser between requests, signed with HMAC-SHA256 (`src/lib/state.ts`), so a visitor can't edit the history, the directory or the step budget between calls.
- **Live progress**: the API streams newline-delimited JSON, so each tool call and directory change appears as it happens.
- **Audit log**: every action by the agent and every approval decision is recorded with time, actor, target and result.

Nothing touches a real system. Emails are drafts and never sent.

## Running locally

```bash
npm install
cp .env.example .env.local   # add your ANTHROPIC_API_KEY
npm run dev
```

Set `MOCK_AGENT=1` to run a scripted agent without an API key, for working on the UI.

## Guardrails on the public demo

- Requests are capped at 800 characters.
- Each visitor can start 6 runs per 10 minutes.
- Each run is limited to 30 model calls, tracked in the signed state.
- The API key lives only on the server, and a monthly spend limit in the Claude Console caps cost.
