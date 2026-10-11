# AQCTA Customer Portal (frontend)

Customer-facing side of AQCTA. It lives in the same Vite app as the admin
dashboard but is otherwise a separate product: its own branding, its own
stylesheet, its own component kit, and **no authentication requirement** —
every route under `/customer` is public.

## Routes

| Path                     | Screen                                    |
| ------------------------ | ----------------------------------------- |
| `/customer/login`        | Sign in                                   |
| `/customer/register`     | 4-step registration wizard                |
| `/customer/forgot-password` | Request password-reset OTP             |
| `/customer/verify-otp`   | OTP verification (login / register / reset) |
| `/customer/reset-password` | Set a new password after OTP           |
| `/customer/enquiry`      | Public enquiry form                       |
| `/customer/dashboard`    | Portal dashboard                          |
| `/customer/<module>`     | one route per `config/navigation.js` entry |
| `/customer` (or unknown) | redirects to `/customer/login`            |

The enquiry form is not linked from the auth screens (those match the Figma
frames exactly); link to `/customer/enquiry` from wherever enquiries should
originate, e.g. the marketing site.

Mounted in [`src/App.jsx`](../App.jsx) as
`<Route path="/customer" component={CustomerRoutes} />`, placed **before** the
admin `Layout` catch-all. The prefix is also registered in
[`src/utils/tenantHost.js`](../utils/tenantHost.js) → `isTenantPublicRoute`, which
is what stops `AppShell` from bouncing unauthenticated visitors to `/login`.

## Layout

```
src/customer/
├── branding/          brand.config.js  — all design tokens + copy (edit here)
│                      CustomerBrandingProvider.jsx — publishes them as CSS vars
├── config/            navigation.js — the module registry (drives the sidebar)
├── styles/            base · layout · components · portal (imported by routes)
├── layouts/           PortalLayout.jsx — sidebar + topbar + content column
├── components/
│   ├── layout/        SplitAuthLayout · CenteredAuthLayout · BrandPanel · AuthHeader
│   ├── portal/        Sidebar · Topbar
│   └── ui/            Button · Field · Card · StatCard · StatusPill · DataTable
│                      StepChevrons · OtpInput · FileDropzone · icons · charts/*
├── context/           RegistrationContext (wizard draft) · AccountContext (session)
├── data/              registrationOptions · enquiryOptions · dashboardMock
├── pages/             auth screens · dashboard/ · ModulePlaceholder
├── routes/            CustomerRoutes.jsx · paths.js
└── utils/             validation.js
```

## Adding a module

The portal is built to grow. A new module is two edits:

1. Add an entry to `config/navigation.js` (label, path, icon, section). The
   sidebar, its active state and the breadcrumb all read from that list, and the
   module immediately gets a working route rendering `ModulePlaceholder`.
2. Build the screen and register it in `MODULE_SCREENS` in
   `routes/CustomerRoutes.jsx`.

Wrap the screen in `<PortalLayout>` and it inherits the whole chrome. The
building blocks are already there: `Card`/`CardHeader`/`CardLink` for panels,
`StatCard` for metric tiles, `DataTable` for column-driven lists (selection,
header checkbox and indeterminate state included), `StatusPill` for state, and
`charts/BarChart` + `charts/Sparkline` for visuals.

## Branding

`branding/brand.config.js` is the single source of truth. Every key in
`brandTokens` is published on the portal root as `--epc-<key>`, so changing a
value there restyles every screen — nothing is hard-coded in a component.

Signature palette (sampled from the Figma file):

| Token             | Value     | Use                                    |
| ----------------- | --------- | -------------------------------------- |
| `--epc-primary`   | `#A32927` | buttons, links, active step, eyebrows   |
| `--epc-brand-rose`| `#F4D6D3` | completed step fill, gradient stop      |
| `--epc-brand-coral`| `#E47662`| gradient stop                           |
| `--epc-brand-sun` | `#F9ED54` | gradient stop                           |
| `--epc-brand-mist`| `#F8F8F7` | gradient stop                           |
| `--epc-page-bg`   | `#EDEDED` | page behind the card                    |

To re-skin the portal for another entity, override tokens at the mount point
without touching any screen:

```jsx
<CustomerBrandingProvider tokenOverrides={{ primary: "#0C2E5A" }}>
```

### Two rules worth knowing

1. **Everything is `px`.** The admin app sets `html { font-size: 14px }`, so
   `rem` would silently rescale the portal. Authoring in `px` keeps the Figma
   measurements exact.
2. **Everything is scoped to `.epc-root`.** `CustomerBrandingProvider` renders
   that wrapper; no portal rule can reach admin markup and vice-versa. The
   portal also does not use the admin Tailwind scale.

### Full-bleed layout

The auth surface fills the viewport rather than floating in it. The brand panel
is `clamp(440px, 36%, 640px)` — 36% lands on the Figma's 520px at a 1440px
frame and stays sane either side of it — and the form column (480px sign-in /
536px wizard) centres in the remaining space, with the footer taking the same
constraint so the two stay aligned.

To restore the boxed Figma frame, three tokens in `brand.config.js` do it:
`card-max-width: 1184px`, `card-radius: 24px`, `shell-padding: 32px 24px`.

### Scrolling

Both shells are pinned to the viewport (`position: fixed; inset: 0`) and only
one inner column scrolls — the form column on auth screens, the content column
in the portal. Two reasons: the gradient panel and the sidebar must never be
dragged out of view by a scroll gesture that lands outside the scrollable area,
and a form that grows without bound (the contacts step gains six fields per
extra contact) has to stay fully reachable. Below 900px the auth card returns to
normal document flow and stacks.

The scrolling columns carry `scroll-padding-block`, so tabbing to a field near
an edge scrolls it in with breathing room instead of flush against the boundary,
and they use a visible (not hairline) scrollbar so there is an affordance for
the overflow. Of the auth screens only the enquiry form ever overflows, and only
below roughly 700px of viewport height.

### Fitting a short viewport

Because the card is `min-height: 100vh`, fixed-px vertical spacing would push
the last field below the fold on short screens — a 1080p laptop at 125% display
scaling is only ~700 CSS px tall. So the **vertical** rhythm is `vh`-clamped
(`space-section`, `space-footer`, `form-panel-padding-y`, `grid-gap-y`,
`textarea-min-height`, `dropzone-height`): tall screens get the full Figma
spacing, short ones compress instead of overflowing. Font sizes stay fixed —
only the space between things moves.

### Typography

`--epc-font-display` / `--epc-font-body` are set to
`"Gilroy", "Figtree", …`. Gilroy is the licensed face used in the Figma file;
**Figtree** (loaded from Google Fonts in `index.html`) is the near-metric
fallback that ships today. If Gilroy gets self-hosted, add the `@font-face`
block and the stack picks it up with no other change.

## Enquiry form

Fields, per the enquiry spec:

| Field           | Type     | Required | Notes                                 |
| --------------- | -------- | -------- | ------------------------------------- |
| Name            | text     | yes      |                                       |
| Email           | text     | yes      | valid address                         |
| Phone           | phone    | yes      | dial-code picker + national number    |
| Company Name    | text     | no       |                                       |
| Enquiring For   | select   | yes      | Inspection, Certification             |
| Enquiry Channel | select   | yes      | Walk-in, Domestic, International      |
| Status          | select   | yes      | Spam, Open, Converted, Closed         |
| Enquiry         | textarea | no       | spec says "text"; a body field reads better as a textarea |

The spec annotates **Enquiry Channel** and **Status** as *"SU will update. Not
shown at client side"*; they are on the form anyway by explicit request, so a
customer picks them rather than a super-user. If they should later become
admin-only, delete the two `SelectField`s from `pages/CustomerEnquiry.jsx` and
their two rules from the `validate` call — the option lists stay in
`data/enquiryOptions.js` for the admin screen.

## Address: country / state / city

Registration step 2 does not carry its own country, state or city lists. It
reads them from `@/utils/locationCascade` (backed by `country-state-city`) —
the same module the admin customer form uses — and applies the same reset rules
via the shared `applyLocationCascade`:

- choosing a **country** clears the state, city and coordinates below it
- choosing a **state** clears the city and coordinates
- choosing a **city** fills the GPS coordinates from that city's centroid
- state is required only when the chosen country actually has states
- state is disabled until a country is picked, city until a state is

Field order matches the admin form (Address Label · Country → State · City →
Company Address · Post Code → GPS Coordinates) so a record reads the same way on
both sides, and `ADDRESS_LABEL_OPTIONS` is kept identical to the admin's list —
a label the customer picks has to be one the admin record can display.

## Backend integration

The screens are complete and validated client-side; four places are marked
for the customer API once those endpoints exist:

- `pages/CustomerLogin.jsx` → `handleSubmit`
- `pages/register/CustomerRegister.jsx` → `handleCreateAccount`
- `pages/CustomerVerifyOtp.jsx` → `handleSubmit` / `handleResend`
- `pages/CustomerEnquiry.jsx` → `handleSubmit`

Select options in `data/registrationOptions.js` are front-end defaults meant to
be replaced by lookups; the steps read only from that module.
