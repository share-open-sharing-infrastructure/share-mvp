# Groups

Groups let a user share specific items with a chosen circle of people — for
example a neighbourhood, a sports club, or an office — without making those items
public and without adding everyone to their personal "trusted" list.

Groups **extend** the existing [trust model](domain-model.md): they are a second,
independent way to widen who may see and borrow a restricted item.

---

## What it does (at a glance)

- Any logged-in user can **create** groups and is their **manager** (owner).
- The owner invites people via a **shareable invite link** (with optional expiry
  and a usage cap) or by adding a member through a **user search**.
- A group can be made **public**: any logged-in user can then find it, read its
  name + description, and **self-join** without an invite. Private (default) groups
  are invite-only.
- When listing an item, the owner can tick **which groups** may see it — per item,
  independently of the "visible to trustees" setting. The same group checklist is
  available in the **AI bulk upload**.
- Members see and can borrow the items shared with their group; non-members
  cannot, and the items never become public. Members can open the group page
  **read-only** to see the description and the other members.

### Roles

Each membership carries a **role** (`admin` | `member`). The owner is stored as a
member row with role `admin`; invited or self-joined people are `member`. Today
only the owner is an admin and the management UI is owner-only — the role field is
the groundwork for **co-admins** (promoting a member to admin) in a later round.
Modelling the owner as a member also fixes two quirks: the owner now sees items a
member shared with the owner's own group, and the member count / roster is correct
for everyone.

---

## The visibility model (important)

An item has two **independent** audience controls:

| `trusteesOnly` | `groups` | Who can see the item |
|---|---|---|
| `false` | *(none)* | **Public** — every logged-in user |
| `true` | *(none)* | Owner + the owner's **trusted** contacts |
| `false` | A, B | Owner + **members of groups A or B** (trustees do **not** see it) |
| `true` | A, B | Owner + trusted contacts **and** members of A or B (union) |

The single rule to remember:

> An item is **public only when `trusteesOnly` is `false` AND it is shared with no
> group.** Otherwise it is restricted, and its audience is the union of whichever
> of the two channels are switched on.

Consequences worth noting:

- **"Group-only"** sharing (`trusteesOnly = false` + a group) deliberately
  **excludes** your general trusted contacts — only the group sees it.
- A trusted contact who *also* happens to be in the group simply sees the item
  (via the group); there is no conflict.
- Visibility is enforced at the **data layer** (PocketBase collection rules and
  SQL views), not just in the UI — see [data-model.md](data-model.md).

---

## How it works

### Data model

Three new collections plus one new field on `items` (see
[data-model.md](data-model.md) for the full ER diagram and rules):

- **`groups`** — `name`, `description`, `owner` (→ user), `isPublic` (bool,
  default `false`). The owner relation `cascadeDelete`s the group, so deleting an
  account removes the groups it owns.
- **`group_members`** — join table (`group`, `user`, `role` = `admin` | `member`);
  a unique `(group, user)` index prevents duplicates. Both relations
  `cascadeDelete` (delete the group or the user → the membership goes away). The
  **owner is stored here too**, as an `admin` row (created by a hook on group
  creation, and backfilled for pre-existing groups by a migration).
- **`group_invites`** — `group`, random `token`, optional `expiresAt`, optional
  `maxUses` (0 = unlimited), `uses`, `createdBy`. Owner-only; not publicly
  listable (no token enumeration).
- **`items.groups`** — multi-relation to `groups`, `cascadeDelete = false` (so
  deleting a group drops the reference from the item rather than deleting the
  item).

### Backend enforcement

- **`items` list/view rule** — public *iff* `trusteesOnly = false && groups:length
  = 0`; otherwise visible to the owner, the owner's trustees (only when
  `trusteesOnly`), members of any attached group, **and** the **requester** of a
  conversation about the item (the owner already sees it via the owner clause; see
  below).
- **`items_searchable`** (search view) — same audience logic, but **without** the
  conversation clause, so conversation access never leaks an item into search.
- **`items_public`** (public, content-masked view) — masks `name`/`image`/
  `description`/… whenever an item is restricted (`trusteesOnly` **or** shared
  with a group), so a group-only item never leaks its content publicly.
- **`conversations` create rule** — you may start a borrow request only for an
  item you can see (public, owner, trusted, or group member).
- **`group_members` rules** — the roster (list/view) is readable by the **owner or
  any member** of the group (so members see each other and the count is correct).
  `createRule` allows the owner to add anyone **and** self-join of a **public**
  group (`group.isPublic = true && @request.auth.id = user && role = "member"`,
  i.e. you may add only yourself, and only as a plain `member` — a self-joiner
  cannot grant themselves `admin`). A `member`-create hook also defaults an empty
  `role` to `member`, so an owner-added row is always a `member`. `updateRule` is owner-only (groundwork for role promotion).
  `deleteRule` lets a member leave (delete their own row) or the owner remove
  someone, **but** the owner's own `admin` row cannot be "left" (they must delete
  the whole group instead).
- **`groups` read rule** — a group is readable by its owner, its members, **or**
  anyone when `isPublic = true` (so prospective members can see the name +
  description before joining).
- **Invite endpoints** (`pb_hooks/group.pb.js`, elevated context so private
  invites aren't enumerable):
  - `GET /api/group-invite/{token}` → preview `{ group: { id, name }, valid }`
  - `POST /api/group-invite/{token}/join` → join (requires auth; idempotent;
    honours `expiresAt`/`maxUses` atomically inside a transaction; new members get
    role `member`).
- **Owner-admin hook** (`onRecordAfterCreateSuccess('groups')`) — every newly
  created group gets the owner inserted as an `admin` member automatically.
- **Group-delete safeguard** (`onRecordDelete` hook) — before a group is deleted,
  any item shared **only** with that group and not trustees-visible is flipped to
  `trusteesOnly = true` (private) first, so it falls back to private rather than
  silently becoming public when the relation reference is removed. Runs for every
  record-level delete path; if a flip can't be saved, the whole deletion rolls
  back (fail-safe).

### Frontend

- **`/user/groups`** — overview of groups you manage and groups you're a member
  of; create a group (description full-width, submit bottom-right). Public groups
  show a badge.
- **`/user/groups/[id]`** — manage one group:
  - **Owner**: rename, **public toggle**, invite link (create / copy / **share**
    via the native share sheet, revoke), public self-join link (when public), add a
    member via a **user search/autosuggest**, remove a member, delete the group.
    The roster shows a **Verwalter:in** badge for admins; a member with an active
    loan of one of your items shows an **"aktive Leihe"** warning (explained inline)
    before removal. Admins can't be removed.
  - **Member** (read-only): the description, the full member roster, and a **leave**
    button. Management controls are hidden.
- **`/groups/join/[token]`** — invite landing page. The preview is public; a guest
  is shown a "log in to join" link and returns here after login; joining itself
  requires an account. Reports "joined" vs. "already a member".
- **`/groups/[id]`** — public-group landing page (self-join, no token). A logged-in
  non-member sees the name + description and a **Beitreten** button; owners and
  existing members are redirected to the group page. Private groups they aren't part
  of render as "invalid".
- **Nav** — a **"Mein Netzwerk"** dropdown groups *Vertraute* (`/social`) and
  *Gruppen* (`/user/groups`).
- **Item row** (`UserItemRow.svelte`) — a small group indicator shows how many
  groups an item is shared with (tooltip lists their names).
- **AI bulk upload** (`bulk-add/ReviewStep.svelte`) — each detected draft has the
  same group checklist as the item modal; selected groups are persisted per item
  (server re-validates them against the user's attachable groups).
- **Item modal** (`ItemModal.svelte`) — two independent controls: a "Nur für
  Vertraute sichtbar" toggle and a group checklist (shown when you belong to groups;
  otherwise a prompt to create one), plus an "is public" hint when neither is set.
- **Profile / search / sitemap** read the trust-filtered surfaces
  (`items_searchable` / masked `items_public`), so an item you can only reach via
  a conversation never shows up there.

### Lifecycle & edge cases

| Event | Behaviour |
|---|---|
| Group deleted | Items shared only with it fall back to **private** (never public); memberships and the group's invites are removed (cascade). |
| Owner deletes their account | Their groups are deleted (cascade), taking memberships and invites with them. |
| Member removed while borrowing | The running loan/conversation is unaffected; the UI warns the owner first. The ex-member keeps access to **that conversation's** item only (so the chat keeps working), not to the rest of the group's items. |
| Member leaves a group | Loses access to that group's items; their conversations still work. |
| Owner tries to leave | Blocked — the owner's `admin` row can't be removed; they must delete the group (the rule allows cascade so group-delete still works). |
| Group made public | Any logged-in user can read it and self-join via `/groups/[id]`; the invite link still works in parallel. **Privacy note:** members' items shared with the group then become visible to anyone who joins — so the owner is warned on the public toggle, and item owners are warned in the share UI when a selected group is public. |
| Self-join | Allowed only for public groups, only for yourself, and only as `member` (never `admin`); idempotent. |
| Invite expired / used up | Preview and join both return `410` with a clear message. |

---

## How to test it

### Manually (local dev)

Start the backend then the frontend (see the repo READMEs) and prepare three
accounts to play the roles — just register them in the UI (or use whatever local
seed data you have; the project's own seed script is kept out of the repo). Use
two browser windows (one normal, one incognito) so you can act as two users at
once — **A** (group owner), **B** (member), **C** (outsider).

> Note: these are accounts *you* create for clicking through the UI. The
> automated backend tests are self-contained — they spin up their own throwaway
> users — so they need no seed data (see *Automated* below).

1. **Create & invite** — as A: menu → *Gruppen* → create a group → create an invite
   link → open it as B (incognito) → join. B now appears in A's member list.
2. **Share an item** — as A, edit an item: toggle *Für Vertraute sichtbar* and/or
   tick the group. With neither set the modal shows it's public.
3. **Check visibility** — search/open the item as **B** (sees it) and as **C**
   (does not). For a *group-only* item, verify a *trusted-but-not-member* user
   still does **not** see it.
4. **Edge cases** — delete the group and confirm a group-only item becomes private
   (not public); remove a member mid-loan and confirm the warning + that their
   chat still works.

A detailed click-through checklist is kept out of the repo (personal QA notes).

### Automated

- **Backend (authoritative)** — integration tests run the real migrations, rules
  and hooks against a throwaway PocketBase instance:

  ```bash
  cd allerleih-backend && npm test
  ```

  Coverage lives in `tests/` (`groups`, `visibility`, `invites`, `members`,
  `edge`, `cascade`, `conversations`, `public-groups`) — visibility for owner/member/non-member,
  group-only excluding trustees, `items_public` masking, invite semantics
  (cap/expiry/idempotency), member management permissions, cascade-to-private on
  group deletion, and conversation access scoping. See the *Testing* section of
  the `allerleih-backend` repository's README for details.

- **Frontend** — Vitest unit tests for the groups routes/actions:

  ```bash
  cd allerleih && npm test
  ```

---

## Key source files

**Backend (`allerleih-backend`)**
- `pb_migrations/17819000{40..50}_*.js` (incl. `..._items_*_independent_groups.js`,
  `..._items_public_mask_grouped.js`, `1781900050_items_conversation_access.js`) — schema
  + visibility rules
- `pb_migrations/1782300001_group_members_role_and_roster.js` — `role` field,
  owner-admin backfill, roster rule, admin-leave guard
- `pb_migrations/1782300002_groups_public_self_join.js` — `isPublic` field, public
  read rule, self-join `createRule`
- `pb_hooks/group.pb.js`, `pb_hooks/services/group.js` — invite endpoints,
  owner-admin-on-create hook, group-delete safeguard
- `tests/*.mjs` — integration tests (incl. `public-groups.test.mjs`)

**Frontend (`allerleih`)**
- `src/routes/user/groups/**`, `src/routes/groups/join/[token]/**`,
  `src/routes/groups/[id]/**` (public self-join) — UI + actions
- `src/lib/server/groups.ts` — group queries (owned/member by role, member counts
  incl. owner)
- `src/routes/user/items/ItemModal.svelte`, `…/items/+page.server.ts`,
  `…/items/UserItemRow.svelte`, `…/items/bulk-add/**` — item sharing controls + AI
  upload group picker
- `src/lib/components/InviteShareButton.svelte` — reused for sharing group invites
- `src/lib/components/NavBarComponent.svelte` — "Mein Netzwerk" dropdown
- `src/lib/types/models.ts` — `Group` (+`isPublic`), `GroupMember` (+`role`),
  `GroupInvite`, `Item.groups`
- `src/lib/texts.ts` — `texts.groups.*` strings
