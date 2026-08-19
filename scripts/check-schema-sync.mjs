#!/usr/bin/env node
// Verifies that supabase/schema.sql (the fresh-install bootstrap) reflects
// the latest state of every object touched by supabase/migrations/*.sql
// (the patches applied to existing databases). The two are hand-maintained
// in parallel — this catches the moment they drift, without needing a real
// Postgres to replay migrations against (none is available in this
// environment: no supabase CLI, docker, or psql).
//
// Checked object kinds: functions, policies, triggers, and columns added
// via `alter table ... add column`. For each, we take the LAST definition
// across all migrations (in filename/chronological order — later files
// overwrite earlier ones, same as replaying them against a real database)
// and compare it against schema.sql's definition.
//
// Run: node scripts/check-schema-sync.mjs  (or: npm run check:schema)

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const SCHEMA_PATH = path.join(ROOT, 'supabase', 'schema.sql')
const MIGRATIONS_DIR = path.join(ROOT, 'supabase', 'migrations')

function normalize(text) {
  return text.replace(/\s+/g, ' ').trim()
}

function extractFunctions(text) {
  const re = /create or replace function public\.(\w+)\([\s\S]*?\n\$\$;/g
  const map = new Map()
  let m
  while ((m = re.exec(text))) map.set(m[1], m[0])
  return map
}

function extractPolicies(text) {
  const re = /create policy "([^"]+)" on public\.(\w+)[\s\S]*?;/g
  const map = new Map()
  let m
  while ((m = re.exec(text))) map.set(`${m[2]}::${m[1]}`, m[0])
  return map
}

// Migrations sometimes retire a policy outright (drop with no matching
// re-create - e.g. moving a table to RPC-only writes) rather than redefine
// it. A single ordered pass over create/drop policy statements, in the
// order they actually appear, is what lets "the latest state wins" hold
// for that case too - the same way a later `create or replace function`
// naturally supersedes an earlier one.
function extractPolicyEvents(text) {
  const re = /create policy "([^"]+)" on public\.(\w+)[\s\S]*?;|drop policy if exists "([^"]+)" on public\.(\w+);/g
  const events = []
  let m
  while ((m = re.exec(text))) {
    if (m[1] !== undefined) events.push({ key: `${m[2]}::${m[1]}`, type: 'create', body: m[0] })
    else events.push({ key: `${m[4]}::${m[3]}`, type: 'drop' })
  }
  return events
}

function extractTriggers(text) {
  const re = /create trigger (\w+)[\s\S]*?;/g
  const map = new Map()
  let m
  while ((m = re.exec(text))) map.set(m[1], m[0])
  return map
}

function extractColumnAdds(text) {
  const re = /alter table public\.(\w+) add column(?: if not exists)? (\w+)/g
  const out = []
  let m
  while ((m = re.exec(text))) out.push({ table: m[1], column: m[2] })
  return out
}

function extractTableBlock(schemaText, table) {
  const re = new RegExp(`create table public\\.${table} \\(\\n([\\s\\S]*?)\\n\\);`)
  const m = re.exec(schemaText)
  return m ? m[1] : null
}

function main() {
  const schemaText = fs.readFileSync(SCHEMA_PATH, 'utf8')
  const migrationFiles = fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort()

  const schemaFunctions = extractFunctions(schemaText)
  const schemaPolicies = extractPolicies(schemaText)
  const schemaTriggers = extractTriggers(schemaText)

  const migFunctions = new Map()
  const migPolicies = new Map()
  const migTriggers = new Map()
  const columnAdds = []

  for (const file of migrationFiles) {
    const text = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8')
    for (const [name, body] of extractFunctions(text)) migFunctions.set(name, { body, file })
    for (const event of extractPolicyEvents(text)) {
      migPolicies.set(event.key, event.type === 'drop' ? { dropped: true, file } : { body: event.body, file })
    }
    for (const [name, body] of extractTriggers(text)) migTriggers.set(name, { body, file })
    for (const { table, column } of extractColumnAdds(text)) columnAdds.push({ table, column, file })
  }

  const problems = []

  for (const [name, { body, file }] of migFunctions) {
    const schemaBody = schemaFunctions.get(name)
    if (!schemaBody) {
      problems.push(`function "${name}" defined in ${file} but missing from schema.sql`)
    } else if (normalize(schemaBody) !== normalize(body)) {
      problems.push(`function "${name}" in schema.sql doesn't match its latest definition (${file})`)
    }
  }

  for (const [key, entry] of migPolicies) {
    const schemaBody = schemaPolicies.get(key)
    if (entry.dropped) {
      if (schemaBody) {
        problems.push(`policy ${key} dropped in ${entry.file} but still present in schema.sql`)
      }
      continue
    }
    const { body, file } = entry
    if (!schemaBody) {
      problems.push(`policy ${key} defined in ${file} but missing from schema.sql`)
    } else if (normalize(schemaBody) !== normalize(body)) {
      problems.push(`policy ${key} in schema.sql doesn't match its latest definition (${file})`)
    }
  }

  for (const [name, { body, file }] of migTriggers) {
    const schemaBody = schemaTriggers.get(name)
    if (!schemaBody) {
      problems.push(`trigger "${name}" defined in ${file} but missing from schema.sql`)
    } else if (normalize(schemaBody) !== normalize(body)) {
      problems.push(`trigger "${name}" in schema.sql doesn't match its latest definition (${file})`)
    }
  }

  const seenColumns = new Set()
  for (const { table, column, file } of columnAdds) {
    const dedupeKey = `${table}.${column}`
    if (seenColumns.has(dedupeKey)) continue
    seenColumns.add(dedupeKey)

    const block = extractTableBlock(schemaText, table)
    if (block === null) {
      problems.push(`table "${table}" not found in schema.sql (column "${column}" added in ${file})`)
      continue
    }
    const columnRe = new RegExp(`(^|\\n)\\s*${column}\\b`)
    if (!columnRe.test(block)) {
      problems.push(`column "${column}" added to "${table}" in ${file} but not present in schema.sql's CREATE TABLE`)
    }
  }

  if (problems.length > 0) {
    console.error(`✗ schema.sql is out of sync with supabase/migrations (${problems.length} issue${problems.length === 1 ? '' : 's'}):\n`)
    for (const p of problems) console.error(`  - ${p}`)
    console.error(`\nWhenever a migration changes a function/policy/trigger/column, mirror the same end state into schema.sql.`)
    process.exitCode = 1
    return
  }

  console.log(`✓ schema.sql matches the latest state of all ${migrationFiles.length} migrations (${schemaFunctions.size} functions, ${schemaPolicies.size} policies, ${schemaTriggers.size} triggers checked).`)
}

main()
