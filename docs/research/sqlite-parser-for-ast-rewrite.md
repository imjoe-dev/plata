# Research: Workers-compatible SQLite parser for the AST rewrite layer

Resolves #33 (part of #32). Researched 2026-07-18.

## Question

Which JS/TS SQL parser can power the AST rewrite layer on Cloudflare Workers? The layer must:

1. Parse SQLite-dialect SQL authored by the LLM.
2. Verify it is a **single SELECT statement**.
3. Verify every referenced table against an allowlist.
4. Rewrite each table reference into a scoped subquery
   (`transactions` → `(SELECT * FROM transactions WHERE user_id = ? AND deleted_at IS NULL)`).
5. Re-serialize the AST back to SQL for D1 execution.

## Recommendation

**`node-sql-parser` (single-dialect import `node-sql-parser/build/sqlite`), confidence: high.**

It was verified hands-on (v5.4.0, scratch install, not from memory): every representative
analytics query parsed, rewrote, and re-serialized correctly, and every abuse case was
rejected. It is the only candidate that combines SQLite-dialect parsing, AST→SQL
serialization, a built-in `tableList()` for allowlist enforcement, a permissive license,
and a small Workers-friendly bundle.

## Candidates compared

|                        | node-sql-parser 5.4.0                                                                                                    | sql-parser-cst 0.42.1                                                                                             | sqlite-parser 1.0.1                     | pgsql-ast-parser 12.0.2   |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- | --------------------------------------- | ------------------------- |
| SQLite dialect         | Dedicated `Sqlite` build; all probes below passed                                                                        | "Full support (SQLite 3.45)" per README; probes passed                                                            | SQLite-only, but frozen at 2017 grammar | **No — Postgres dialect** |
| AST→SQL                | `sqlify()` — verified                                                                                                    | `show()` — byte-identical round-trip verified                                                                     | **None** (parse only)                   | `toSql` + `astMapper`     |
| Verify single SELECT   | AST `type === "select"`, array for multi-stmt — verified                                                                 | `statements[].type === "select_stmt"` — verified                                                                  | AST inspection                          | AST inspection            |
| Table allowlist        | Built-in `tableList()` / `whiteListCheck()` — verified                                                                   | Manual CST visiting (table refs are plain `identifier` nodes; disambiguating from column refs needs context work) | Manual                                  | `astVisitor`              |
| Table→subquery rewrite | Swap node `table` → `expr: { ast }`, keep alias — **verified end-to-end**                                                | CST surgery or range-based splicing; fiddlier, must preserve whitespace nodes                                     | No serializer, so no                    | Wrong dialect             |
| Workers compat         | Pure JS (PEG.js-generated + `big-integer`); bundles clean for browser platform, no Node built-ins — verified via esbuild | Pure TS, zero runtime deps; bundles clean — verified                                                              | Pure JS                                 | Pure JS (nearley/moo)     |
| Bundle (min / gzip)    | **220 KB / 54 KB** (sqlite-only build)                                                                                   | 700 KB / 94 KB (all dialects in one bundle; dialect is a runtime option)                                          | small, moot                             | ~small, moot              |
| Maintenance            | 5.4.0 Jan 2026, pushed May 2026, 1.0k stars, 72 open issues                                                              | 0.42.1 Jun 2026, pushed Jul 2026, 187 stars, active                                                               | **Dead since 2017**                     | 12.0.2 Jan 2026, active   |
| License                | **Apache-2.0**                                                                                                           | **GPL-2.0-or-later**                                                                                              | MIT                                     | MIT                       |

Also considered and ruled out quickly:

- **tree-sitter (`web-tree-sitter` + a SQLite grammar, WASM)** — parses on Workers, but has
  no CST→SQL serializer (manual byte-range splicing only), and its error-_tolerant_ parsing
  is a liability for a security gate: malformed input yields a partial tree with `ERROR`
  nodes instead of a hard failure. A gate should fail closed.
- **`sql-surveyor`, `js-sql-parser`, `flora-sql-parser`** — no SQLite dialect and/or no serializer.
- **`sql-formatter`** — formatter, not a parser (no AST).
- **sqlglot (Python) via Pyodide** — dialect-perfect but absurd runtime cost for a Worker.

## Hands-on verification (node-sql-parser 5.4.0, `build/sqlite`)

Fidelity probes — all parsed, re-serialized via `sqlify()`, and the output re-parsed:

- The representative query: `SELECT c.name, SUM(t.amount) AS total FROM transactions t JOIN categories c ON c.id = t.category_id WHERE t.date >= '2026-01-01' GROUP BY c.name ORDER BY total DESC`
- CTEs (`WITH`, `WITH RECURSIVE`), window functions (`SUM(...) OVER (PARTITION BY ... ORDER BY ...)`)
- `strftime`, `date('now', '-30 days')`, `julianday`, `||` concat, `CASE WHEN`, `CAST`,
  `LIMIT/OFFSET`, `HAVING`, `UNION ALL`, `DISTINCT`, `COALESCE`/`ROUND`, `IN (subquery)`,
  nested derived tables, scalar subqueries in the SELECT list

Gate probes — all correctly handled:

- `DELETE FROM transactions` → parses with `type: "delete"` → rejected by the SELECT-only gate
- `SELECT 1; SELECT 2` → astify returns an array of 2 → rejected by the single-statement gate
- `SELECT * FROM users` / `SELECT * FROM sqlite_master` → rejected by the allowlist
- `PRAGMA table_info(...)` → **parse error** (fails closed — ideal)
- `ATTACH DATABASE ...` → parses as `type: "attach"` → rejected by the SELECT-only gate
- `SELECT (SELECT secret FROM users LIMIT 1)` → `users` still surfaces in `tableList()` → rejected

End-to-end rewrite of the representative query produced (and the output re-parses):

```sql
SELECT "c"."name", SUM("t"."amount") AS "total"
FROM (SELECT * FROM "transactions" WHERE "user_id" = ? AND "deleted_at" IS NULL) AS "t"
INNER JOIN (SELECT * FROM "categories" WHERE "user_id" = ? AND "deleted_at" IS NULL) AS "c"
  ON "c"."id" = "t"."category_id"
WHERE "t"."date" >= '2026-01-01'
GROUP BY "c"."name" ORDER BY "total" DESC
```

CTE handling verified: `WITH monthly AS (...) SELECT ... FROM monthly` rewrites the base
table inside the CTE body and leaves the `monthly` self-reference alone. `?` placeholders
survive `sqlify()`, so the scope predicate stays parameterized for D1 `.bind()`.

## Code sketch

```ts
import { Parser } from "node-sql-parser/build/sqlite";

const parser = new Parser();
const OPT = { database: "Sqlite" } as const;
const ALLOWED_TABLES = new Set(["transactions", "categories"]);

export function guardAndScopeSql(rawSql: string): { sql: string; bindCount: number } {
  // 1. Parse (throws on anything the SQLite grammar rejects — PRAGMA, etc.)
  const ast = parser.astify(rawSql, OPT);
  const stmts = Array.isArray(ast) ? ast : [ast];

  // 2. Single SELECT only
  if (stmts.length !== 1) throw new QueryRejected("exactly one statement required");
  const stmt = stmts[0];
  if (stmt.type !== "select") throw new QueryRejected("only SELECT is allowed");

  // 3. Belt: every table ref anywhere (incl. scalar subqueries) must be allowlisted
  for (const entry of parser.tableList(rawSql, OPT)) {
    const [, db, table] = entry.split("::"); // "select::null::transactions"
    if (db !== "null") throw new QueryRejected(`schema-qualified ref not allowed: ${entry}`);
    if (!ALLOWED_TABLES.has(table) && !cteNames(stmt).has(table))
      throw new QueryRejected(`table not allowed: ${table}`);
  }

  // 4. Suspenders: rewrite each base-table ref into a scoped subquery.
  //    Snapshot refs BEFORE mutating, or the walk descends into the
  //    freshly inserted subquery and recurses forever.
  const refs = collectTableRefs(stmt); // nodes with a string `table` prop and no `expr`
  let bindCount = 0;
  for (const ref of refs) {
    if (cteNames(stmt).has(ref.table)) continue; // CTE self-reference
    const scoped = parser.astify(
      `SELECT * FROM "${ref.table}" WHERE user_id = ? AND deleted_at IS NULL`,
      OPT,
    );
    ref.as ??= ref.table; // preserve how the outer query addresses it
    ref.expr = { ast: Array.isArray(scoped) ? scoped[0] : scoped, parentheses: true };
    delete ref.table;
    delete ref.db;
    bindCount++;
  }

  // 5. Serialize for D1: db.prepare(sql).bind(...Array(bindCount).fill(userId))
  return { sql: parser.sqlify(stmt, OPT), bindCount };
}
```

(`collectTableRefs` / `cteNames` are ~15-line recursive walks over the AST; both were
exercised in the verification above.)

## Risks and mitigations

1. **A table ref shape the walk misses** (data-leak risk: allowlisted but unscoped). The
   `tableList()` allowlist check runs on the _raw_ SQL independently of the rewrite walk,
   so a missed shape can never reach a non-allowlisted table; and since D1 binds one DB per
   user-facing worker anyway, the residual risk is cross-user rows from an _allowlisted_
   table. Mitigation: after rewriting, assert `collectTableRefs` on the result finds no
   bare refs outside the injected fragments (cheap invariant), and keep a probe test suite.
2. **Table-valued functions** (`json_each(...)` in FROM) are invisible to `tableList()` —
   verified. They read only their arguments, so they cannot leak rows, but if strictness is
   preferred, reject FROM entries whose `expr.type === "function"`.
3. **Parser gaps vs. real SQLite** (open issues: VALUES-in-CTE #2631/#2669, an escape-char
   edge #2512, a "1 in 10,000 D1-exported SQL" report #2493). All gaps fail closed — a
   parse error rejects the query, which degrades UX (LLM retries), never safety.
4. **`sqlify()` normalizes formatting** (double-quotes identifiers, adds `AS`, `ASC`).
   Verified harmless: the output is for D1, and it re-parses. If SQL is echoed to the user,
   show the normalized form — it is what actually ran.
5. **92 MB unpacked install** — dev-time only; the `build/sqlite` import bundles to
   54 KB gzip, far under the Workers script limit (3 MB free / 10 MB paid plan, compressed).
6. **The parser is the security boundary.** The design is default-deny at every step
   (parse failure, non-select type, multi-statement, allowlist miss all reject), and D1
   itself executes a single statement per `.prepare()`, giving a second engine-level
   barrier against multi-statement smuggling.

## Runner-up and fallback stance

**Runner-up: `sql-parser-cst`** — byte-identical round-trip (verified), zero deps, very
active, and stricter dialect discipline. Passed all the same parse probes. Not chosen
because (a) **GPL-2.0-or-later** (fine for a personal, non-distributed server app, but a
mark against for hygiene), (b) ~2× the gzip size (all dialects ship in one bundle), and
(c) the rewrite needs context-aware CST surgery — table refs are plain `identifier` nodes,
so distinguishing them from column refs takes parent-context tracking that node-sql-parser
gives for free via typed table nodes and `tableList()`. It is a credible fallback if
node-sql-parser's grammar gaps ever bite in practice.

**Constrained-enum fallback: not needed.** The map's fallback (a tool exposing only
enumerated query shapes) would only be warranted if no parser could both parse SQLite
analytics SQL and re-serialize it on Workers. Two candidates verifiably can, one with a
worked end-to-end rewrite. Confidence that the AST-rewrite layer is viable on
node-sql-parser: **high**. The failure mode of residual grammar gaps is a rejected query
and an LLM retry — a UX papercut, not a safety or architecture problem.
