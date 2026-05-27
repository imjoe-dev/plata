# plata · component → Tailwind cheat sheet

A flat, copy-pasteable reference for hand-translating every component into your
React app. Class names assume `tailwind.preset.js` from this design system is
loaded — that's where `bg-base`, `text-fg-muted`, `border-hairline`, `bg-accent`,
`shadow-sm`, `font-mono` etc. come from.

**House rules (apply to everything):**

- `rounded-none` on every interactive element. There is no border radius.
- `font-sans` by default, `font-mono` for numerals/keyboard hints/codes, `font-serif` for the wordmark and the lone empty-state mark.
- Hover transitions: `transition-colors duration-fast ease-out`.
- **Focus visible** (every focusable element): `focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-fg-muted focus-visible:ring-offset-0`. For elements on a dark surface that already have a border, you can swap to `focus-visible:border-fg-muted`.
- **Disabled** (every interactive element): `disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none`. The `:hover` styles below should not apply when disabled — `disabled:hover:bg-*` resets where needed.
- **Loading**: replace label with a spinner; keep size & padding stable. Disable pointer interaction via `aria-busy="true"` + `pointer-events-none`.
- **Animation classes** (`animate-in`, `animate-out`, `slide-in-from-*`, `fade-in`, etc.) assume the `tailwindcss-animate` plugin is installed. If you're not using it, swap for keyframes or framer-motion equivalents.

---

## Button

Heights are fixed by size. Horizontal padding is roughly 1.5× height.

### Sizes

- **sm** — `h-7 px-2.5 text-xs gap-1.5`
- **md** (default) — `h-[30px] px-3.5 text-xs gap-2`
- **lg** — `h-9 px-4 text-sm gap-2`
- **icon-only** — square, no text. `h-[30px] w-[30px] p-0 gap-0` (md). Provide an `aria-label`.

### Base (every button)

`inline-flex items-center justify-center font-medium border rounded-none transition-colors duration-fast ease-out select-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-fg-muted disabled:opacity-40 disabled:cursor-not-allowed`

### Variants

#### primary

| State    | Classes                                                                                     |
| -------- | ------------------------------------------------------------------------------------------- |
| default  | `bg-accent text-accent-fg border-accent`                                                    |
| hover    | `hover:bg-[oklch(0.96_0.20_118)]`                                                           |
| active   | `active:bg-accent-press active:shadow-[inset_0_1px_0_rgba(0,0,0,0.2)]`                      |
| focus    | (use base ring)                                                                             |
| disabled | inherits base — keep on `bg-accent` so the disabled tint reads as "this would do something" |
| loading  | swap label for spinner, keep `bg-accent`, add `pointer-events-none`                         |

#### secondary

| State    | Classes                                                                                        |
| -------- | ---------------------------------------------------------------------------------------------- |
| default  | `bg-raised text-fg border-hairline`                                                            |
| hover    | `hover:bg-overlay hover:border-hairline-strong`                                                |
| active   | `active:bg-sunken active:border-hairline-strong active:shadow-[inset_0_1px_0_rgba(0,0,0,0.4)]` |
| focus    | (use base ring)                                                                                |
| disabled | inherits base                                                                                  |
| loading  | swap label for spinner                                                                         |

#### ghost

| State    | Classes                                                                                               |
| -------- | ----------------------------------------------------------------------------------------------------- |
| default  | `bg-transparent text-fg-muted border-transparent`                                                     |
| hover    | `hover:text-fg hover:bg-raised hover:border-hairline`                                                 |
| active   | `active:bg-sunken active:text-fg active:border-hairline`                                              |
| focus    | `focus-visible:text-fg focus-visible:border-hairline` (text + border appear) — base ring also applies |
| disabled | inherits base                                                                                         |
| loading  | spinner replaces icon/label                                                                           |

#### destructive

| State            | Classes                                                                       |
| ---------------- | ----------------------------------------------------------------------------- |
| default          | `bg-transparent text-negative border-hairline`                                |
| hover            | `hover:bg-negative/10 hover:border-negative`                                  |
| active (confirm) | `active:bg-negative active:text-[oklch(0.16_0.04_25)] active:border-negative` |
| focus            | `focus-visible:ring-negative`                                                 |
| disabled         | inherits base                                                                 |
| loading          | spinner; keep `text-negative`                                                 |

#### destructive-solid (for confirmation dialogs only)

| State    | Classes                                                                         |
| -------- | ------------------------------------------------------------------------------- |
| default  | `bg-negative text-[oklch(0.16_0.04_25)] border-negative font-medium`            |
| hover    | `hover:bg-[oklch(0.74_0.20_25)]`                                                |
| active   | `active:bg-[oklch(0.60_0.20_25)] active:shadow-[inset_0_1px_0_rgba(0,0,0,0.3)]` |
| disabled | inherits base                                                                   |

### Spinner (drop-in)

`inline-block w-3 h-3 border border-current border-t-transparent animate-spin` — no rounding (it's a hard-edge square that rotates).

### Don't

- Don't add `rounded-md`, drop shadows, or `font-bold`.
- Don't use primary for destructive actions.
- Don't stack two primary buttons next to each other in a footer.
- Don't change the height in a single row of buttons.

---

## Input (text, number, password, search, email)

### Base

`h-[30px] w-full px-2.5 bg-sunken text-fg text-xs font-sans border border-hairline rounded-none outline-none transition-colors duration-fast`

### States

| State                            | Classes                                                              |
| -------------------------------- | -------------------------------------------------------------------- |
| placeholder                      | `placeholder:text-fg-faint`                                          |
| hover (when empty + not focused) | `hover:border-hairline-strong`                                       |
| focus                            | `focus:bg-base focus:border-fg-muted`                                |
| filled (valid, not focused)      | inherits base — no green border                                      |
| error                            | `border-negative` + `aria-invalid="true"`                            |
| error focus                      | `focus:border-negative focus:bg-base`                                |
| disabled                         | `disabled:opacity-40 disabled:cursor-not-allowed disabled:bg-sunken` |
| readonly                         | `read-only:bg-base read-only:text-fg-muted`                          |

### Label

`block mb-1.5 text-[10px] font-mono uppercase tracking-wider text-fg-faint`

- Required marker: append `<span class="text-negative ml-0.5">*</span>`

### Hint / help text

`mt-1 text-[10px] font-mono text-fg-faint`

### Error message

`mt-1 text-[10px] font-mono text-negative`

### Prefixed / suffixed input

Wrap the input in a div that takes the border:

- **Wrapper** — `flex items-stretch h-[30px] bg-sunken border border-hairline focus-within:bg-base focus-within:border-fg-muted aria-invalid:border-negative`
- **Prefix/suffix** — `px-2.5 flex items-center text-[11px] font-mono text-fg-faint border-r border-hairline` (suffix uses `border-l` instead)
- **Inner input** — `flex-1 bg-transparent border-0 outline-none text-xs px-2.5`

### Don't

- Don't use rounded inputs.
- Don't use a colored bg for focus — only the border + bg swap.
- Don't show a green border for "valid". Validation is implicit.

---

## Textarea

Same as Input but multi-line:

- Base — replace `h-[30px]` with `min-h-[72px] py-2 resize-y`.
- Everything else (states, error, disabled) is identical.

---

## Select (native)

### Base

`appearance-none h-[30px] w-full pl-2.5 pr-7 bg-sunken text-fg text-xs border border-hairline rounded-none outline-none transition-colors duration-fast`

### States

| State    | Classes                                           |
| -------- | ------------------------------------------------- |
| hover    | `hover:border-hairline-strong`                    |
| focus    | `focus:bg-base focus:border-fg-muted`             |
| disabled | `disabled:opacity-40 disabled:cursor-not-allowed` |
| error    | `aria-invalid:border-negative`                    |

### Caret container

Wrap the `<select>` with `relative`. Add a chevron-down (Lucide, 1.5 stroke) `absolute right-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-fg-muted pointer-events-none`.

### Custom popover select (when you need search / multi-select)

- **Trigger** — same classes as native select; replace value with span. Add `aria-expanded:bg-base aria-expanded:border-fg-muted` for the open state.
- **Popover** — `mt-1 bg-overlay border border-hairline shadow-sm` (see Dropdown).

---

## Checkbox

### Container (clickable row)

`inline-flex items-center gap-2 text-xs text-fg cursor-pointer select-none has-[:disabled]:opacity-40 has-[:disabled]:cursor-not-allowed`

### Box (replace native via `appearance-none`)

`appearance-none w-3.5 h-3.5 border border-hairline bg-sunken rounded-none transition-colors duration-fast cursor-pointer shrink-0`

### States

| State             | Classes                                                                                                                                                                                                                                                |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| hover (unchecked) | `hover:border-hairline-strong`                                                                                                                                                                                                                         |
| focus             | `focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-fg-muted`                                                                                                                                                                          |
| checked           | `checked:bg-accent checked:border-accent`                                                                                                                                                                                                              |
| checked + hover   | `checked:hover:bg-accent-press`                                                                                                                                                                                                                        |
| indeterminate     | `indeterminate:bg-accent indeterminate:border-accent` — draw the bar via inline style: `background-image: linear-gradient(var(--accent-fg), var(--accent-fg)); background-size: 8px 1.5px; background-position: center; background-repeat: no-repeat;` |
| disabled          | `disabled:cursor-not-allowed`                                                                                                                                                                                                                          |
| error             | `aria-invalid:border-negative`                                                                                                                                                                                                                         |

### Checkmark (pseudo-element)

On `:checked`, render a thin checkmark using `background-image` (a 1.5-stroke SVG in `accent-fg` color), `background-position: center`, `background-size: 10px`.

---

## Radio

Same as Checkbox but the only exception to the no-radius rule (radio buttons must be round).

### Container

`inline-flex items-center gap-2 text-xs text-fg cursor-pointer select-none`

### Dot (native, replaced)

`appearance-none w-3.5 h-3.5 rounded-full border border-hairline bg-sunken transition-colors duration-fast cursor-pointer shrink-0`

### States

| State    | Classes                                                                                                 |
| -------- | ------------------------------------------------------------------------------------------------------- |
| hover    | `hover:border-hairline-strong`                                                                          |
| focus    | `focus-visible:ring-1 focus-visible:ring-fg-muted`                                                      |
| checked  | `checked:border-accent checked:bg-[radial-gradient(circle,oklch(0.90_0.20_118)_0_4px,transparent_5px)]` |
| disabled | `disabled:opacity-40 disabled:cursor-not-allowed`                                                       |

---

## Switch / Toggle

A hard-edged rectangular switch — not a pill. Two `h-4 w-7` rectangles butted together.

### Track

`relative inline-flex items-center w-7 h-4 bg-sunken border border-hairline cursor-pointer transition-colors duration-fast`

### Thumb (absolute child)

`absolute top-0 left-0 w-3 h-[14px] bg-fg-muted transition-[transform,background] duration-fast`

### States

| State         | Classes                                                             |
| ------------- | ------------------------------------------------------------------- |
| off (default) | thumb at `translate-x-0`, track `bg-sunken`                         |
| on            | track `bg-accent border-accent`, thumb `bg-accent-fg translate-x-3` |
| hover off     | `hover:border-hairline-strong`                                      |
| hover on      | `hover:bg-accent-press`                                             |
| focus         | `focus-visible:ring-1 focus-visible:ring-fg-muted`                  |
| disabled      | `opacity-40 cursor-not-allowed pointer-events-none`                 |

---

## Tabs (underline)

### Tablist

`flex items-stretch border-b border-hairline -mb-px`

### Tab base

`px-3.5 py-2 text-sm text-fg-muted border-b border-transparent -mb-px cursor-pointer transition-colors duration-fast focus-visible:outline-none focus-visible:bg-raised`

_Focus uses `bg-raised` only — no `focus-visible:text-fg` — to avoid fighting `text-fg-strong` on a focused-active tab._

### States

| State    | Classes                                                                              |
| -------- | ------------------------------------------------------------------------------------ |
| hover    | `hover:text-fg`                                                                      |
| active   | `text-fg-strong border-fg-strong font-medium`                                        |
| disabled | `opacity-40 cursor-not-allowed pointer-events-none`                                  |
| count    | inside, append `<span class="ml-1.5 text-[11px] font-mono text-fg-faint">412</span>` |

### Segmented control

- **Root** — `inline-flex border border-hairline divide-x divide-hairline`
- **Item base** — `px-3.5 py-1.5 text-xs text-fg-muted cursor-pointer transition-colors duration-fast hover:text-fg`
- **Item active** — `bg-raised text-fg-strong`
- **Item disabled** — `opacity-40 cursor-not-allowed pointer-events-none`
- **Focus** — `focus-visible:bg-raised focus-visible:text-fg`

---

## Table

### Root

`w-full border border-hairline border-collapse`

### Header cell

`text-left px-3.5 py-2 bg-raised border-b border-hairline text-[10px] font-mono font-medium uppercase tracking-wider text-fg-faint`

- Right-aligned numeric: add `text-right`
- Sortable: cursor-pointer + chevron icon; on `aria-sort` apply `text-fg`
- Sorted asc/desc: `text-fg` + replace chevron with `↑` or `↓` glyph

### Body cell base

`px-3.5 py-1.5 border-b border-hairline text-xs text-fg`

- Numeric: `font-mono tabular-nums text-right text-fg-strong`
- Muted/meta: `font-mono text-[11px] text-fg-muted`
- Last row: `[&:last-child>td]:border-b-0`

### Row states

| State                           | Classes                                                  |
| ------------------------------- | -------------------------------------------------------- |
| hover                           | `hover:bg-raised`                                        |
| selected                        | `bg-accent/10 hover:bg-accent/10`                        |
| disabled                        | `opacity-40 pointer-events-none`                         |
| pending                         | `[&>td]:text-fg-muted` (faded while syncing)             |
| destructive (marked for delete) | `bg-negative/5 [&>td]:line-through [&>td]:text-fg-muted` |

### Inline bar inside a cell

`inline-block align-middle h-1.5 bg-accent mr-2` with width via style.

### Empty / loading states

- **Empty** — render a single full-width cell with the Empty State component inside it.
- **Loading** — render skeleton rows (see Skeleton).

---

## Card

### Variants

- **plain** — `bg-raised border border-hairline p-3.5 flex flex-col gap-2`
- **ghost** — `bg-transparent border border-hairline p-3.5`
- **header card** — outer: `bg-raised border border-hairline`
  - Header strip: `flex items-center justify-between px-3.5 py-2 bg-overlay border-b border-hairline`
  - Body: `p-3.5`
- **interactive** (clickable card) — `bg-raised border border-hairline p-3.5 cursor-pointer transition-colors duration-fast hover:bg-overlay hover:border-hairline-strong focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-fg-muted`
  - Active: `active:bg-sunken`
  - Disabled: `opacity-40 cursor-not-allowed pointer-events-none`

### Inside a card

- Label: `text-[10px] font-mono uppercase tracking-wider text-fg-faint`
- Title: `text-sm text-fg-strong font-medium tracking-tight`
- Big number: `font-mono text-2xl text-fg-strong tabular-nums tracking-tight`
- Desc: `text-[11px] text-fg-muted leading-relaxed`

---

## Modal / Dialog

### Backdrop

`fixed inset-0 z-50 bg-black/60 flex items-start justify-center pt-[12vh]`

### Container

`w-[480px] max-w-[90vw] bg-raised border border-hairline shadow-lg flex flex-col`

### Header

`flex items-center justify-between px-4 py-3 border-b border-hairline`

- Title: `text-sm text-fg-strong font-medium`
- Close (×): `text-fg-faint font-mono text-base cursor-pointer hover:text-fg focus-visible:outline-none focus-visible:text-fg focus-visible:bg-raised`

### Body

`px-4 py-3.5 text-xs text-fg leading-relaxed max-h-[70vh] overflow-y-auto`

### Footer

`flex items-center justify-end gap-2 px-4 py-2.5 bg-overlay border-t border-hairline`

### Variants

- **default** — neutral confirmation (Cancel + Primary).
- **destructive** — Cancel + `destructive-solid` button. No icon. Body explains the consequence in one sentence.
- **scrollable** — body uses `overflow-y-auto`; a 1px hairline appears at the top of the body when content scrolls (use a sentinel + shadow trick).

### States

| State    | Classes                                                         |
| -------- | --------------------------------------------------------------- |
| entering | `animate-in fade-in slide-in-from-top-1 duration-slow ease-out` |
| exiting  | `animate-out fade-out duration-fast`                            |

### Don't

- Don't center body text.
- Don't use more than two footer buttons.
- Don't apply `rounded-*`.

---

## Dropdown / Menu

### Container

`min-w-[200px] bg-overlay border border-hairline shadow-sm`

### Group

`py-1 border-b border-hairline last:border-b-0`

### Group label

`px-3 pt-1.5 pb-1 text-[9px] font-mono uppercase tracking-[0.08em] text-fg-faint`

### Item base

`flex items-center justify-between px-3 py-1.5 text-xs text-fg cursor-pointer transition-colors duration-fast`

### Item states

| State                | Classes                                                                                       |
| -------------------- | --------------------------------------------------------------------------------------------- |
| hover (focus-within) | `hover:bg-[oklch(0.28_0.005_240)] focus:bg-[oklch(0.28_0.005_240)] focus:outline-none`        |
| active / checked     | `aria-checked:bg-accent/10 aria-checked:text-accent`                                          |
| destructive          | `text-negative hover:bg-negative/10 hover:text-negative`                                      |
| disabled             | `aria-disabled:opacity-40 aria-disabled:cursor-not-allowed aria-disabled:pointer-events-none` |
| with submenu         | append a `→` glyph in mono on the right                                                       |

### Keyboard hint (right side)

`text-[10px] font-mono text-fg-faint`

### Leading icon

`w-3.5 text-fg-muted mr-2` (1.5 stroke, inherits color)

### Separator

`h-px bg-hairline my-1`

---

## Command palette (⌘K)

### Backdrop

Same as modal backdrop.

### Container

`w-[600px] max-w-[90vw] bg-overlay border border-hairline shadow-lg`

### Input row

`flex items-center gap-3 px-4 py-3.5 border-b border-hairline`

- Caret `›` — `font-mono text-fg-faint`
- Input — `flex-1 bg-transparent border-0 outline-none text-sm text-fg-strong placeholder:text-fg-faint`
- Kbd hint — `border border-hairline px-1.5 py-0.5 text-[10px] font-mono text-fg-faint`

### Result group label

Same as dropdown group label.

### Result item states

| State                                    | Classes                                                                                                  |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| default                                  | `flex items-center justify-between px-4 py-1.5 text-sm text-fg cursor-pointer`                           |
| hover                                    | `hover:bg-[oklch(0.28_0.005_240)]`                                                                       |
| selected (active row, keyboard or hover) | `bg-accent/10 text-fg-strong border-l-2 border-accent pl-[14px]`                                         |
| disabled                                 | `aria-disabled:opacity-40 aria-disabled:pointer-events-none`                                             |
| no-results                               | render a single muted line: `px-4 py-5 text-xs text-fg-muted` — copy: `No match. Press enter to create.` |
| loading                                  | replace results with 3 skeleton rows (`h-7 mx-4 my-1 bg-raised animate-pulse`)                           |

### Item meta (right)

`text-[10px] font-mono text-fg-faint`

---

## Sidebar

### Aside

`w-60 bg-base border-r border-hairline flex flex-col py-3.5`

### Brand

`px-4 pb-4 flex items-baseline gap-2`

- Wordmark: `font-serif italic text-[22px] text-fg-strong tracking-tight leading-none`
- Accent dot: `text-accent not-italic`
- Version chip: `font-mono text-[10px] text-fg-faint`

### Search trigger (opens ⌘K)

`mx-3 mb-3.5 px-2 py-1.5 bg-raised border border-hairline text-xs text-fg-muted flex items-center justify-between cursor-pointer hover:text-fg focus-visible:text-fg focus-visible:border-hairline-strong`

### Group label

`px-4 pt-3 pb-1 text-[9px] font-mono uppercase tracking-[0.1em] text-fg-faint`

### Nav item base

`flex items-center justify-between px-4 py-1.5 text-sm text-fg-muted cursor-pointer select-none transition-colors duration-fast`

### Nav item states

| State    | Classes                                                                    |
| -------- | -------------------------------------------------------------------------- |
| hover    | `hover:text-fg hover:bg-raised`                                            |
| focus    | `focus-visible:outline-none focus-visible:text-fg focus-visible:bg-raised` |
| active   | `text-fg-strong bg-raised font-medium border-l-2 border-accent pl-[14px]`  |
| disabled | `opacity-40 cursor-not-allowed pointer-events-none`                        |

- Leading icon: `w-4 h-4 text-fg-faint shrink-0` (1.5 stroke). Active item: `text-accent`.
- Count badge on the right: `font-mono text-[10px] text-fg-faint`.
- Status dot (for accounts): `w-1.5 h-1.5 bg-current opacity-50`.

### Footer (account)

`mt-auto px-4 py-2.5 border-t border-hairline flex items-center gap-2.5 cursor-pointer hover:bg-raised`

- Avatar: `w-[22px] h-[22px] bg-accent text-accent-fg flex items-center justify-center text-[11px] font-semibold shrink-0`
- Name: `text-xs text-fg leading-tight`
- Email: `text-[10px] font-mono text-fg-faint`

### Mobile

On `< md` breakpoint, hide the sidebar and render as a slide-over: `fixed inset-y-0 left-0 z-40 translate-x-[-100%] data-[open=true]:translate-x-0 transition-transform duration-slow ease-out`.

---

## Topbar / Navbar

### Bar

`h-12 border-b border-hairline flex items-stretch shrink-0`

### Crumbs

`flex items-center gap-2.5 px-5 text-sm text-fg-muted flex-1 truncate`

- Separator (`/`): `text-fg-faint font-mono`
- Current page: `text-fg-strong font-medium`
- Each crumb (when clickable): `cursor-pointer hover:text-fg active:text-fg-strong focus-visible:outline-none focus-visible:text-fg`

### Tool button (right side)

Base: `flex items-center gap-2 px-3.5 border-l border-hairline text-xs text-fg-muted cursor-pointer transition-colors duration-fast`

| State                     | Classes                                                                    |
| ------------------------- | -------------------------------------------------------------------------- |
| hover                     | `hover:text-fg hover:bg-raised`                                            |
| active                    | `active:bg-sunken active:text-fg`                                          |
| focus                     | `focus-visible:outline-none focus-visible:text-fg focus-visible:bg-raised` |
| disabled                  | `opacity-40 cursor-not-allowed pointer-events-none`                        |
| loading (e.g. "Syncing…") | append spinner instead of icon; keep text in `text-fg-muted`               |

- Icon: `w-3.5 h-3.5 stroke-[1.5]`
- Kbd hint: `text-[10px] font-mono text-fg-faint`

### Filter pill row

- Row: `flex items-center gap-2.5 px-5 py-3 bg-sunken border-b border-hairline`
- Label: `text-[10px] font-mono uppercase tracking-wider text-fg-faint`

### Pill states

| State     | Classes                                                                                                                               |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| default   | `px-2.5 py-1 border border-hairline text-[11px] font-mono text-fg-muted cursor-pointer transition-colors duration-fast hover:text-fg` |
| on        | `bg-raised text-fg-strong border-hairline-strong`                                                                                     |
| add       | `border-dashed text-fg-faint hover:text-fg hover:border-fg-muted`                                                                     |
| focus     | `focus-visible:outline-none focus-visible:border-fg-muted focus-visible:text-fg`                                                      |
| active    | `active:bg-sunken active:text-fg-strong`                                                                                              |
| disabled  | `opacity-40 cursor-not-allowed pointer-events-none`                                                                                   |
| removable | append `×` (`ml-1.5 text-fg-faint hover:text-fg`)                                                                                     |

---

## Transaction list

### Container

`border-t border-hairline` (rows handle their own bottom borders)

### Day header

`flex items-center justify-between px-7 py-2.5 bg-sunken border-b border-hairline text-[10px] font-mono uppercase tracking-wider text-fg-faint`

- Total on right: `text-fg-muted tabular-nums`

### Row base

`group grid grid-cols-[36px_1fr_140px_110px_24px] items-center gap-3.5 px-7 py-2 border-b border-hairline cursor-pointer transition-colors duration-fast`

### Row states

| State             | Classes                                                                                                                             |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| hover             | `hover:bg-raised`                                                                                                                   |
| focus             | `focus-visible:outline-none focus-visible:bg-raised focus-visible:border-l-2 focus-visible:border-fg-muted focus-visible:pl-[26px]` |
| selected          | `bg-accent/10 hover:bg-accent/10`                                                                                                   |
| AI-flagged        | `shadow-[inset_2px_0_0_var(--accent)] bg-accent/[0.08] hover:bg-accent/[0.13]`                                                      |
| pending (syncing) | `[&>*]:opacity-50`                                                                                                                  |
| failed sync       | `bg-negative/5 [&>*]:opacity-70`                                                                                                    |

### Row cells

- **Time** — `font-mono text-[10px] text-fg-faint`
- **Body** — `flex items-center gap-3 min-w-0`
  - Merchant icon: `w-6 h-6 bg-overlay border border-hairline flex items-center justify-center font-serif italic text-[13px] text-fg-muted shrink-0`
  - Merchant name: `text-sm text-fg truncate`
  - Inline note: `ml-1.5 text-xs text-fg-faint`
- **Category** — `font-mono text-[10px] uppercase tracking-wider text-fg-muted`
  - Uncategorized: `text-caution`
- **Amount** — `font-mono text-sm text-right text-fg-strong tabular-nums tracking-tight`
  - Positive: `text-positive` (prefix with `+`)
  - Negative: keep `text-fg-strong` (prefix with `−`, U+2212)
- **More menu (⋯)** — `font-mono text-fg-faint text-right opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100`

### AI tag chip (inline in merchant name)

`ml-2 font-mono text-[9px] text-accent px-1.5 py-px border border-accent/40 tracking-wider uppercase`

### Empty / loading

- **Empty** — render the Empty State component.
- **Loading** — render 6 skeleton rows (`h-9 bg-raised animate-pulse border-b border-hairline mx-0`).

---

## Chart (area, line, bar)

### Colors

- Primary series: `oklch(0.90 0.20 118)` (accent)
- Secondary series: `var(--fg-muted)`
- Area fade: gradient from accent @ 22% opacity → 0%
- Reference / prior-period: `var(--fg-faint)`, `strokeDasharray="3 3"`, `strokeWidth=1`
- Gridlines: `var(--hairline)`, `strokeDasharray="1 3"` — Y only, never X
- Axes/labels: `font-family: 'JetBrains Mono'`, `font-size: 9`, fill `var(--fg-faint)`
- Axis baseline: solid `var(--hairline)`

### States

| State                       | How                                                                                                          |
| --------------------------- | ------------------------------------------------------------------------------------------------------------ |
| default                     | as above                                                                                                     |
| hovered (cursor on a point) | render a vertical 1px `var(--hairline)` cursor line and a 3px accent dot on the active point                 |
| tooltip                     | `bg-overlay border border-hairline shadow-sm px-2 py-1.5 text-[11px] font-mono text-fg-strong` — no rounding |
| empty                       | render Empty State centered inside the chart box                                                             |
| loading                     | full-area skeleton (`bg-raised animate-pulse`) at the chart's intended dimensions                            |
| negative trend              | swap series color to `var(--negative)`; everything else identical                                            |

### Geometry

- Line stroke: `1.5`. Never thicker.
- Last-point dot: `r=3`, accent fill.
- Bars: no rounding, no inner stroke. Highlight one bar with accent; others `var(--fg-muted)`.

### Legend

`flex gap-4 text-[10px] font-mono uppercase tracking-wider text-fg-muted`

- Swatch: `w-2 h-0.5` (a rule, not a circle)

### Don't

- Don't use multi-color category palettes.
- Don't draw both X and Y gridlines.
- Don't use rounded tooltips.

---

## Stat block

### Container (single)

`group flex flex-col gap-2 px-5 py-4 border-r border-hairline last:border-r-0 cursor-pointer transition-colors duration-fast`

### States

| State               | Classes                                                                                                                                                                |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| hover               | `hover:bg-raised`                                                                                                                                                      |
| focus               | `focus-visible:outline-none focus-visible:bg-raised focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-fg-muted`                                         |
| active (pressed)    | `active:bg-overlay`                                                                                                                                                    |
| selected            | `bg-raised shadow-[inset_0_-2px_0_var(--accent)]` — 2px accent rule at the bottom inside the cell; this is what differentiates a _selected_ stat from a _hovered_ stat |
| disabled            | `opacity-40 cursor-not-allowed pointer-events-none`                                                                                                                    |
| loading             | replace number with `h-7 w-24 bg-raised animate-pulse`; keep label visible                                                                                             |
| empty (no data yet) | replace number with `—` in `text-fg-faint`; delta line: `text-fg-faint` `No data yet`                                                                                  |

### Row of stats

`grid grid-cols-4 border-y border-hairline`

- On mobile: `grid-cols-2`.

### Inside

- Label: `text-[10px] font-mono uppercase tracking-[0.08em] text-fg-faint`
- Number: `font-mono text-[26px] leading-none tracking-tight text-fg-strong tabular-nums`
  - Trailing cents: `<span class="text-fg-muted">.04</span>`
- Delta line: `flex items-center gap-1.5 text-[11px] font-mono`
  - Positive: `text-positive` with leading `↑ `
  - Negative: `text-negative` with leading `↓ `
  - Flat: `text-fg-muted` with leading `— `
  - Trailing context: `text-fg-muted`

### Inline sparkline (instead of a delta)

`flex items-end gap-px h-4 mt-0.5`

- Bar: `w-[3px] bg-fg-muted` with height via style.
- Highlight final bar: `bg-accent`.

---

## Badge / chip

### Base

`inline-flex items-center h-[18px] px-1.5 border border-hairline font-mono text-[10px] uppercase tracking-wider text-fg-muted bg-transparent`

### Variants

- **outline neutral** (default) — base only
- **solid neutral** — `bg-raised text-fg`
- **accent / AI** — `text-accent border-accent/40 bg-accent/[0.08]`
- **positive** — `text-positive border-accent/40 bg-accent/[0.08]`
- **negative** — `text-negative border-negative/40 bg-negative/10`
- **caution** — `text-caution border-caution/40 bg-caution/10`
- **info** — `text-info border-info/40 bg-info/10`

### States (when interactive)

| State    | Classes                                                                                          |
| -------- | ------------------------------------------------------------------------------------------------ |
| hover    | `hover:text-fg hover:border-hairline-strong` (neutral); for semantic variants, +5% opacity on bg |
| focus    | `focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-fg-muted`                    |
| active   | `active:opacity-80`                                                                              |
| disabled | `opacity-40 cursor-not-allowed pointer-events-none`                                              |

### Leading status dot

`w-[5px] h-[5px] bg-current mr-1.5`

### Removable badge (with × inside)

Append a button after the label: `ml-1.5 -mr-0.5 text-current opacity-60 hover:opacity-100 cursor-pointer`. Render a small `×` glyph.

### Don't

- Don't use a colored badge if the row already uses color elsewhere.
- Don't put more than one badge per table row.

---

## Toast

### Stack

`fixed bottom-5 right-5 z-[60] flex flex-col gap-2 pointer-events-none [&>*]:pointer-events-auto`

### Container (single toast)

`flex items-center justify-between gap-4 px-3.5 py-2.5 bg-overlay border border-hairline shadow-sm max-w-md`

### Layout

- Left side: `flex items-center gap-2.5`
- State bar: `self-stretch w-0.5 bg-fg-muted` — swap by variant
- Message: `text-xs text-fg` (with `<strong class="text-fg-strong font-medium">` for highlights)
- Action link: `font-sans text-[11px] text-accent underline underline-offset-[3px] cursor-pointer hover:text-fg-strong focus-visible:outline-none focus-visible:text-fg-strong`
- Close (×): `text-fg-faint font-mono text-[13px] cursor-pointer hover:text-fg focus-visible:outline-none focus-visible:text-fg`

### Variants (state bar color)

| Variant        | State bar                                                       |
| -------------- | --------------------------------------------------------------- |
| info / default | `bg-fg-muted`                                                   |
| success        | `bg-positive`                                                   |
| error          | `bg-negative`                                                   |
| caution        | `bg-caution`                                                    |
| loading        | `bg-fg-muted` + spinner before the message instead of state bar |

### States

| State                        | Classes                                                            |
| ---------------------------- | ------------------------------------------------------------------ |
| entering                     | `animate-in slide-in-from-bottom-1 fade-in duration-base ease-out` |
| exiting                      | `animate-out fade-out slide-out-to-right-2 duration-fast`          |
| persistent (no auto-dismiss) | no animation difference; close button must be present              |

### Lifecycle

- Auto-dismiss at 4s (8s for error).
- One action max.

---

## Empty state

### Container

`flex flex-col items-start gap-2.5 px-6 py-7 border border-hairline min-h-[120px]`

### Variants by context

| Variant                 | Mark                     | Title example            | Description tone                        |
| ----------------------- | ------------------------ | ------------------------ | --------------------------------------- |
| nothing yet (first run) | `—`                      | `No activity this week.` | "X appears here once Y." + 1 action     |
| all clear (success)     | `·`                      | `All caught up.`         | reassuring, no action or 1 ghost action |
| error / blocked         | `×` (in `text-negative`) | `Sync failed.`           | one sentence cause + retry action       |
| permission required     | `?`                      | `Reconnect to continue.` | + reconnect action                      |

### Inside

- Mark: `font-serif italic text-[36px] leading-none text-fg-faint` (or `text-negative` for error variant)
- Title: `text-sm text-fg-strong font-medium tracking-tight`
- Description: `text-xs text-fg-muted leading-relaxed` — **one sentence max**
- Action: one **primary** or **secondary** button. Never two.

### Don't

- Don't use an illustration, emoji, or Lucide icon — the mark is always a single Instrument Serif italic character.
- Don't include more than one sentence.

---

## Tooltip

### Container

`bg-overlay border border-hairline shadow-sm px-2 py-1.5 text-[11px] font-mono text-fg-strong max-w-xs`

### Variants

- **default** — as above.
- **kbd** — append a kbd chip at the right end (`ml-2 border border-hairline px-1 py-px text-[10px] text-fg-faint`).

### States

| State    | Classes                                                                 |
| -------- | ----------------------------------------------------------------------- |
| entering | `animate-in fade-in duration-fast ease-out` (after 400ms trigger delay) |
| exiting  | `animate-out fade-out duration-fast`                                    |

### Don't

- Don't show a tooltip on a button that already has a visible label.
- Don't use a rounded background or pointer arrow.

---

## Skeleton / loading

### Base

`bg-raised animate-pulse` — no rounding.

### Sizes (composable)

- Text line: `h-3 w-3/4`
- Heading: `h-5 w-1/2`
- Numeral: `h-7 w-24`
- Avatar / icon: `w-6 h-6`
- Row: `h-9 w-full border-b border-hairline`

### Replacement strategy

Skeletons take the exact dimensions of the element they replace. Never use spinners inside content areas — use skeletons. Spinners are reserved for in-button loading and the toast.

---

## Progress bar

### Track

`relative h-0.5 w-full bg-hairline overflow-hidden`

### Fill

`absolute inset-y-0 left-0 bg-accent transition-[width] duration-slow ease-out` with width via style.

### Variants

- **determinate** — fill width = progress %
- **indeterminate** — fill is `w-1/3` and `animate-[slide_1.2s_ease-in-out_infinite]` (keyframes: -33% → 100%)
- **negative trend** — swap fill to `bg-negative`

### Don't

- Don't use rounded ends.
- Don't make it thicker than 4px.

---

## Avatar

The only allowed use of `rounded-full`. Squares are also OK and read more on-brand.

### Sizes

- **xs** — `w-5 h-5 text-[10px]`
- **sm** — `w-[22px] h-[22px] text-[11px]`
- **md** — `w-7 h-7 text-xs`
- **lg** — `w-10 h-10 text-sm`

### Variants

- **initials** — `bg-accent text-accent-fg font-semibold flex items-center justify-center`
- **image** — `bg-cover bg-center`
- **fallback** — `bg-raised text-fg-muted border border-hairline`

### Shape

- **square** (default) — `rounded-none`
- **round** — `rounded-full` (only when reproducing a profile avatar)

### Interactive (when the avatar is a button — e.g. account menu trigger)

Add: `cursor-pointer transition-opacity duration-fast hover:opacity-80 active:opacity-60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-fg-muted`

---

## Link (inline)

### Base

`text-accent underline underline-offset-[3px] decoration-accent/40 transition-colors duration-fast cursor-pointer`

### States

| State    | Classes                                                                                      |
| -------- | -------------------------------------------------------------------------------------------- |
| hover    | `hover:text-fg-strong hover:decoration-fg-strong`                                            |
| visited  | (no special style — keep neutral)                                                            |
| focus    | `focus-visible:outline-none focus-visible:text-fg-strong focus-visible:decoration-fg-strong` |
| active   | `active:text-fg-muted active:decoration-fg-muted`                                            |
| disabled | `opacity-40 cursor-not-allowed pointer-events-none`                                          |

### Muted link (e.g. "view all")

Base: `text-fg-muted underline underline-offset-[3px] decoration-fg-faint hover:text-fg hover:decoration-fg-muted`

---

## Keyboard hint (kbd)

`inline-flex items-center border border-hairline px-1.5 py-px text-[10px] font-mono text-fg-faint leading-none`

Used inline next to actions, in command-palette items, and the sidebar search trigger.

---

## Divider / separator

- Horizontal: `h-px w-full bg-hairline`
- Vertical: `w-px self-stretch bg-hairline`
- Dashed (used between dense info chunks): replace `bg-hairline` with `border-t border-dashed border-hairline` on the horizontal variant. Use sparingly.

---

## Text styles (reuse anywhere)

| Use                     | Classes                                                                      |
| ----------------------- | ---------------------------------------------------------------------------- |
| Page title (h1)         | `font-sans text-3xl leading-tight tracking-tight font-medium text-fg-strong` |
| Section title (h2)      | `font-sans text-xl leading-snug tracking-tight font-medium text-fg-strong`   |
| Subsection (h3)         | `font-sans text-base leading-snug font-medium text-fg`                       |
| Body                    | `font-sans text-sm leading-normal text-fg`                                   |
| Muted body              | `font-sans text-sm leading-normal text-fg-muted`                             |
| Caption                 | `font-sans text-xs leading-normal text-fg-muted`                             |
| All-caps label          | `font-mono text-[10px] uppercase tracking-wider text-fg-faint font-medium`   |
| Inline numeral          | `font-mono tabular-nums tracking-tight text-fg-strong`                       |
| Big numeral             | `font-mono text-4xl leading-none tracking-tight tabular-nums text-fg-strong` |
| Code / kbd / meta       | `font-mono text-xs text-fg-muted`                                            |
| Display (hero/wordmark) | `font-serif text-6xl leading-none tracking-tight text-fg-strong`             |

---

## Quick reference — color → utility

| Token               | Tailwind class              | Use it for                                     |
| ------------------- | --------------------------- | ---------------------------------------------- |
| `--base`            | `bg-base`                   | App canvas                                     |
| `--raised`          | `bg-raised`                 | Cards, hover rows, sidebar items               |
| `--sunken`          | `bg-sunken`                 | Inputs, filter row strip                       |
| `--overlay`         | `bg-overlay`                | Menus, modals, command palette                 |
| `--hairline`        | `border-hairline`           | Every border, every divider                    |
| `--hairline-strong` | `border-hairline-strong`    | Active pill border, section break              |
| `--fg-strong`       | `text-fg-strong`            | Headlines, big numerals, active nav            |
| `--fg`              | `text-fg`                   | Body text                                      |
| `--fg-muted`        | `text-fg-muted`             | Secondary text, inactive nav                   |
| `--fg-faint`        | `text-fg-faint`             | Tertiary text, kbd hints, separators           |
| `--accent`          | `bg-accent` / `text-accent` | Primary action, positive figure, active marker |
| `--accent-press`    | `bg-accent-press`           | Pressed primary button                         |
| `--accent-fg`       | `text-accent-fg`            | Text on accent fill                            |
| `--positive`        | `text-positive`             | Gains, success state bars                      |
| `--negative`        | `text-negative`             | Losses, destructive actions, errors            |
| `--caution`         | `text-caution`              | Uncategorized, warnings                        |
| `--info`            | `text-info`                 | Neutral signal (synced, etc.)                  |

---

## State checklist (use this when building a new component)

For every interactive element, you should have a class string for each:

1. **default** — what it looks like at rest
2. **hover** — pointer over (skip on touch-only)
3. **focus-visible** — keyboard focused
4. **active / pressed** — mouse/touch down
5. **selected / checked / active route** — semantic on-state
6. **disabled** — `opacity-40 cursor-not-allowed pointer-events-none`
7. **loading** — spinner inside (button) / skeleton (content)
8. **error** — `aria-invalid="true"` styles (input, select)
9. **empty** — the Empty State component or `—` glyph
10. **read-only** — flat fill, no border swap on focus

If a component can't meaningfully be in one of these states, that's fine — but verify it intentionally, don't skip it by accident.
