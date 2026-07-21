---
name: review-all
description: >
  Multi-Rollen-Review des aktuellen AllerLeih-Changes: vier spezialisierte Reviewer
  (Security & Datenschutz, Code-Qualität, Accessibility, Konventionen) laufen parallel gegen den
  Diff, danach werden die Findings konsolidiert, dedupliziert und direkt gefixt — mit einem
  Änderungsprotokoll, das für jeden Fix was/wo/warum festhält. Use when a change should be
  reviewed from all angles and the findings fixed in one go, without opening a PR. Nicht für
  GitHub-PR-Reviews (dafür /review) und ohne Browser-Test (dafür /review-and-test).
---

# review-all

Du bist der **Orchestrator**. Du reviewst nicht selbst — du spawnst die Rollen-Agents,
konsolidierst ihre Reports und **fixt danach**. Die Agents sind read-only; das Schreiben passiert
ausschließlich hier, sequenziell, damit sich parallele Läufe nicht gegenseitig überschreiben.

Diese Skill **committet und pusht nicht** und öffnet keinen PR. Sie endet mit sauberem
Arbeitsverzeichnis voller Fixes plus Protokoll — der Rest ist `/create-pr`.

**Repos:** Frontend (dieses Repo, SvelteKit) und PocketBase-Backend liegen als Schwester-Ordner
im selben Workspace; ein e2e-Worktree kann daneben existieren. Der Default-Scope ist der aktuelle
Change gegen `main` in jedem betroffenen Repo.

## Stage 0 — Scope

1. Default = aktueller Change gegen `main`. Je Repo: `git -C <repo> diff --name-only main...HEAD`
   plus `git -C <repo> status --porcelain`. Nennt der Nutzer Branch/Dateien, gilt das stattdessen.
2. Sind die Repos sauber, sag das und **stoppe** — es gibt nichts zu reviewen.
3. Nenne den Scope in einem deutschen Satz, bevor du Agents startest.

## Stage 1 — Rollen auswählen und starten

Ein Agent-Start kostet unabhängig davon, ob er etwas findet. **Starte nur Rollen, die auf diesem
Diff überhaupt etwas finden können.**

### Kleiner Diff ⇒ gar keine Agents

Ist der Diff **≤ 40 geänderte Zeilen über ≤ 3 Dateien**, reviewst du **selbst** — Kontrakt lesen,
Diff gegen die vier Checklisten prüfen, fertig. Vier Agents für einen Zweizeiler sind reine
Verschwendung. Sag im Report, dass du den Direktweg genommen hast.

### Sonst: Rollen per Gate

Starte eine Rolle nur, wenn ihr Gate zutrifft:

| Agent | Startet nur, wenn der Diff … |
|---|---|
| `sveltekit-pb-reviewer` | Server-Code, Routen, Hooks, Migrations, PB-Queries, Auth oder Felder mit Personenbezug berührt |
| `code-quality-reviewer` | ≥ 80 geänderte Zeilen **oder** eine neue Datei **oder** eine berührte Datei über der Längen-Schwelle enthält |
| `a11y-reviewer` | `.svelte`-Dateien mit Markup-Änderung enthält (reine Script-Blöcke zählen nicht) |
| `conventions-reviewer` | Frontend-`src/` oder Backend-`pb_hooks/` berührt |

Trifft kein Gate zu (z. B. nur Doku, Konfig, Tests), sag das und **stoppe**.

**Die passenden Rollen in einer einzigen Nachricht spawnen** (`run_in_background: false`), damit
sie nebenläufig laufen.

### Prompt an jede Rolle — den Diff mitgeben

Der teuerste Fehler ist, dass mehrere Agents denselben `git diff` nochmal selbst ausführen und
sich durchs Repo lesen. Gib deshalb **im Prompt** mit:

- den **fertigen Diff-Text** (`git -C <repo> diff main...HEAD`) — einmal von dir geholt, nicht
  von jedem Agent erneut,
- die Liste der geänderten Dateien mit Zeilenzahlen (`wc -l`),
- den Hinweis, dass der Review-Kontrakt in `.claude/review-contract.md` (im Wurzelverzeichnis
  dieses Repos) liegt,
- den Hinweis auf die `CLAUDE.md` des betroffenen Repos.

Ist der Diff sehr groß (> ~1500 Zeilen), gib statt des Volltextes die Dateiliste + die Anweisung,
gezielt zu lesen — dann ist der Diff im Prompt teurer als das Nachlesen.

Das eingebaute `/security-review` als **zweite** Linse nur bei wirklich sicherheitskritischen
Diffs (Auth, Sichtbarkeitsregeln, neue öffentliche Routen) — nicht routinemäßig, es dupliziert
sonst nur `sveltekit-pb-reviewer`.

## Stage 2 — Konsolidieren

Bevor du irgendetwas anfasst:

1. **Deduplizieren.** Melden zwei Rollen dieselbe Stelle, behalte die fachlich zuständige
   Formulierung und die **höhere** Severity.
2. **Widersprüche auflösen.** Kollidiert ein Vorschlag mit einem anderen (typisch: „extrahiere
   Helper" vs. „eine Abstraktion mit einem Aufrufer"), entscheide begründet — und schreibe die
   Entscheidung ins Protokoll.
3. **Nach Datei gruppieren**, nicht nach Rolle — so entsteht pro Datei ein Edit statt mehrere.
4. **Plausibilisieren.** Prüfe jedes Finding kurz am echten Code, bevor du es umsetzt. Agents
   irren; ein Fix auf Basis eines falschen Findings ist schlimmer als kein Fix. Verworfene
   Findings kommen ins Protokoll mit Begründung, nicht stillschweigend weg.

## Stage 3 — Fixen

- **Blocking und Should-fix werden gefixt.** Ohne Rückfrage — das ist die stehende Freigabe.
- **Nice-to-have** wird **nicht** automatisch gefixt: auflisten und den Nutzer am Ende fragen.
- **Nicht autonom fixbar** (Design-Entscheidung nötig, Fix sprengt den Scope, Fachlichkeit
  unklar): nicht anfassen, im Protokoll unter „offen" mit dem, was zur Entscheidung fehlt.
- Nutze für die Umsetzung den `allerleih-coder`-Agent, wenn ein Fix mehrere Dateien oder echtes
  Neuschreiben bedeutet; triviale Fixes machst du direkt.
- Fixe **sequenziell** und halte den Diff minimal: nur das Finding beheben, keine
  Gelegenheits-Umbauten. Was dir dabei zusätzlich auffällt, wird ein Finding, kein Ad-hoc-Edit.

Nach den Fixes im betroffenen Repo verifizieren, dass nichts kaputtging: `npm run lint`,
`npm run check`, die relevanten `npx vitest run <dateien>` bzw. Backend-`npm test`.
**Gotcha:** läuft parallel ein lokaler Dev-Stack (PocketBase auf Port 8091), fallen Backend-Tests
breit mit „superuser auth failed" aus — dann den Dev-Stack stoppen und erneut laufen. Bekannte
vorbestehende Fehlschläge (z. B. `$env`-Sync-Variablen bei `check`/`build`) klar als *nicht vom
Change verursacht* kennzeichnen, nicht wegfixen.

## Stage 4 — Bericht mit Änderungsprotokoll

Ein deutscher Report:

- **Scope** — Repos, Flow, welche Rollen liefen (und welche warum nicht).
- **Änderungsprotokoll** — der Kern. Pro Fix eine Zeile, gruppiert nach Datei:

  ```
  <datei>:<zeile> — [Severity, Rolle] <was geändert wurde>
    Warum: <die Begründung aus dem Finding, ein Satz>
  ```

- **Offen** — nicht gefixte Findings: Nice-to-have (mit der Frage, ob du sie noch machen sollst)
  und nicht autonom Fixbares (mit der fehlenden Entscheidung).
- **Verworfen** — Findings, die der Plausibilisierung nicht standhielten, je ein Satz warum.
- **Verifikation** — was gelaufen ist, mit PASS/FAIL; vorbestehende Fehler getrennt ausgewiesen.
- **Fazit** — ein bis zwei Sätze: ist der Change jetzt sauber, was bleibt.

## Notes

- Alle nötigen Agents in **einer** Nachricht starten; erst schreiben, wenn **alle** zurück sind.
- Niemals stagen, committen oder pushen.
- Bleibt ein Blocking-Finding ungefixt, sag das im Fazit ausdrücklich — es darf nicht in der
  Liste untergehen.
- Ist der Scope unklar (welcher Branch, welches Feature), einmal nachfragen statt raten.
