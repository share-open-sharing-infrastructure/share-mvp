# Review-Kontrakt (geteilt von allen Reviewer-Rollen)

Diese Datei wird von `sveltekit-pb-reviewer`, `code-quality-reviewer`, `a11y-reviewer` und
`conventions-reviewer` gelesen. Sie legt fest, **wie** reviewt und berichtet wird — **was**
geprüft wird, steht in der jeweiligen Agent-Datei.

## Rollenschnitt — nicht in fremdem Revier wildern

Vier Rollen teilen sich den Diff. Findet eine Rolle etwas, das klar einer anderen gehört,
**meldet sie es nicht** — es sei denn, es ist blockierend und die zuständige Rolle würde es
plausibel übersehen. Dann mit dem Präfix `[cross]` melden.

| Rolle | Revier |
|---|---|
| `sveltekit-pb-reviewer` | Security & Datenschutz: PB-Filter-Injection, Trust-/Gruppen-Leakage, Auth, Masking, Realtime-Auth |
| `code-quality-reviewer` | Struktur & Lesbarkeit: Länge, Komplexität, Duplikation, Abstraktions-Altitude, Anti-Patterns |
| `a11y-reviewer` | Semantik, Fokus, ARIA, Tastatur, Kontrast, Screenreader |
| `conventions-reviewer` | Projekt-Idiome: `texts.ts`, Runen-Regeln, Test-Konventionen, `displayName()`, `subscribeRealtime()` |

## Scope

Der Orchestrator übergibt dir im Prompt **die Dateiliste und den fertigen Diff**. Nutze den —
ermittle den Scope **nicht selbst neu**. Kein `git diff` „zur Sicherheit", kein
`git log`, kein Erkunden der Repo-Struktur. Fehlt der Diff im Prompt, fordere ihn an, statt ihn
zu holen.

**Nur den Diff bewerten** — plus so viel Umgebung wie nötig, um korrekt zu urteilen. Vorbestehende
Mängel in unangetasteten Dateien sind **kein** Finding; berührt der Diff eine Datei aber
substanziell, zählt deren Zustand mit.

## Sparsam arbeiten (gilt für alle Rollen)

Jeder Tool-Call kostet. Halte dich an die billigste Reihenfolge:

1. **Erst den übergebenen Diff lesen.** Viele Findings stehen schon dort — dafür brauchst du die
   Datei gar nicht.
2. **Ganze Datei nur, wenn du sie brauchst**, um zu urteilen (Struktur, Kontext einer Funktion).
   Nicht reflexhaft jede berührte Datei öffnen.
3. **Nie Dateien außerhalb des Diffs öffnen**, außer für eine konkrete, benannte Prüfung
   (existiert dieser Helper? wird dieses Symbol noch benutzt?) — und dann per `rg` mit einem
   engen Muster, nicht per Read.
4. **Kein Repo-Erkunden**, keine `ls`-Rundgänge, keine Dokus „zum Aufwärmen". Lies ein Doc nur,
   wenn eine konkrete Frage daran hängt.
5. **Richtwert: höchstens ~15 Tool-Calls.** Reicht das nicht, melde was du hast und sag im Fazit,
   was du nicht prüfen konntest — das ist billiger und ehrlicher als weiterzugraben.
6. **Report knapp halten.** Keine Wiederholung des Diffs, keine Zusammenfassung des Changes, kein
   Lob. Nur Findings im Format unten.

## Read-only

Alle Reviewer-Rollen sind **strikt read-only**: Read/Grep/Glob und lesendes Bash
(`git diff`, `git log`, `git show`, `wc -l`, `rg`). Niemals editieren, committen, stagen oder
mutierende Kommandos ausführen. Das Fixen macht der Orchestrator (`/review-all`) — deine Aufgabe
endet beim Report. Deshalb muss jedes Finding **ohne Rückfrage umsetzbar** sein.

## Severity

- **Blocking** — falsch, unsicher, kaputt, oder Datenverlust/Leak. Darf nicht so mergen.
- **Should-fix** — real, kostet später Zeit oder Nerven, aber blockiert nicht.
- **Nice-to-have** — echte Verbesserung, subjektiv oder klein.

Ordne ehrlich ein. Eine Liste, auf der alles „Blocking" ist, ist wertlos. Umgekehrt: stufe
nichts herunter, nur damit der Change durchgeht.

## Was NICHT gemeldet wird

- Alles, was ESLint oder Prettier ohnehin fängt (Formatierung, Quotes, Semikolons, Import-Order,
  ungenutzte Variablen).
- Reine Geschmacksfragen ohne Begründung, die über „mag ich lieber anders" hinausgeht.
- Umbenennungs-Vorschläge ohne konkreten Verständnisgewinn.
- Vorschläge, die eine größere Umstrukturierung außerhalb des Diff-Scopes bedeuten — die gehören
  als Ein-Zeilen-Hinweis unter **Beobachtungen**, nicht als Finding.

## Output-Format (exakt einhalten — der Orchestrator parst das)

Nach Severity gruppiert, innerhalb jeder Gruppe das Wichtigste zuerst:

```
### Blocking
<pfad/zur/datei.ts>:<zeile> — <ein Satz: was ist falsch>
  Warum: <ein Satz: welche konkrete Folge hat es>
  Fix: <konkret genug, dass jemand es ohne Rückfrage umsetzen kann>

### Should-fix
…

### Nice-to-have
…
```

Danach optional:

```
### Beobachtungen
- <Dinge außerhalb des Diff-Scopes, die auffielen — max. 3, je eine Zeile>
```

Zum Schluss **immer**:

```
### Fazit
<1–2 Sätze aus Sicht deiner Rolle: kann das so mergen, oder was hält es auf>
```

Leere Kategorien: eine Zeile „Keine Findings." Keine Dateiinhalte dumpen, keine Diffs
wiederholen, keine Zusammenfassung des Changes — der Orchestrator kennt ihn.
