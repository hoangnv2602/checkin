# 07 · Frontend (Next.js 16.2.x)

> **Tổ chức code: feature module** (D10). Thư mục `src/app/` chỉ chứa shell của route; toàn bộ code nghiệp vụ nằm trong `src/modules/<module>/`.
>
> **Component shadcn: đường dẫn mặc định** (D11) — `src/components/ui/` (cài qua `yarn dlx shadcn@latest add <name>`).
>
> **Design system: custom palette "Aurora"** (D11) — xem [`docs/design-system.md`](./design-system.md). Cấm dùng class palette Tailwind / shadcn mặc định.

## Kiến trúc 2 lớp

```
apps/web/
├── public/                              ← asset tĩnh (ở root, KHÔNG trong src/)
├── src/                                 ← toàn bộ source code
│   ├── app/                             ← Next.js routing layer (mỏng)
│   │   ├── globals.css                  ← biến CSS Aurora
│   │   ├── layout.tsx
│   │   ├── (group)/<route>/page.tsx     ← import page từ @/modules/<m>, export default
│   │   └── api/<webhook>/route.ts       ← route handler
│   ├── components/
│   │   └── ui/                          ← component shadcn (CLI install — đường dẫn mặc định)
│   │       ├── button.tsx
│   │       ├── card.tsx
│   │       ├── dialog.tsx
│   │       └── …                        ← mọi component shadcn
│   ├── lib/                             ← utility cross-module
│   │   ├── utils.ts                     ← shadcn helper `cn()` (CLI-managed)
│   │   ├── date.ts
│   │   ├── format.ts
│   │   ├── validate.ts
│   │   └── permissions.ts
│   └── modules/                         ← feature module (D10)
│       ├── <module>/                    ← components/ hooks/ schemas/ services/ types/ + index.ts
│       └── _shared/                     ← primitive cross-module
│           ├── api/                     ← fetch client, query factory
│           ├── config/                  ← env, route
│           └── providers/               ← provider context cấp app
├── components.json                      ← cấu hình shadcn
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json                        ← path alias: @/* → src/*
└── package.json
```

**Tại sao tách như vậy:**
- Thư mục `src/app/` là bản đồ route dễ điều hướng — bất kỳ ai cũng có thể tìm trang chủ bằng cách đọc 1 file.
- Component shadcn nằm ở đường dẫn **mặc định** `src/components/ui/` để `yarn dlx shadcn@latest add` chạy ngay không cần config.
- Utility cross-module không phải component shadcn nằm ở `src/lib/` (cũng là mặc định của shadcn cho `utils.ts`).
- Feature module trong `src/modules/<module>/` tự sở hữu component, hook, schema, service và type của mình.
- Thêm feature = tạo `src/modules/<module>/` + 1 route mỏng trong `src/app/`. Không còn tranh luận "hook này để đâu?".

## Cấu trúc module (bắt buộc)

Mọi feature module tuân theo layout này (D10):

```
src/modules/<module>/
├── components/
│   ├── <Entity>DeleteDialog.tsx        ← dialog xác nhận xoá
│   ├── <Entity>Form.tsx                ← form tạo / sửa (import từ @/components/ui)
│   ├── <Entity>Table.tsx               ← list/table view
│   ├── <Entity>Card.tsx                ← (tuỳ chọn) card cho 1 item
│   ├── <Entity>Details.tsx             ← (tuỳ chọn) detail view read-only
│   ├── <Module>Filters.tsx             ← (tuỳ chọn) widget filter cấp module
│   ├── <Module>Stats.tsx               ← (tuỳ chọn) thẻ thống kê cấp module
│   ├── <Module>Page.tsx                ← component page đã compose
│   └── index.ts                        ← barrel: re-export public component
├── hooks/
│   ├── index.ts                        ← barrel
│   └── use<Entities>.ts                ← collection: use<Entities>(), use<Entity>(id), useCreate<Entity>(), useUpdate<Entity>(), useDelete<Entity>() + Zustand store (vd use<Entities>Filters)
├── schemas/
│   ├── index.ts                        ← barrel
│   └── <entity>.schema.ts              ← zod: <entity>Schema, create<Entity>Schema, update<Entity>Schema
├── services/
│   ├── index.ts                        ← barrel
│   └── <entities>Api.ts                ← service object: <entities>Api.list(), .get(id), .create(...), .update(...), .delete(id)
├── types/
│   ├── index.ts                        ← barrel
│   └── <entity>.ts                     ← domain type suy ra từ schema + enum
└── index.ts                            ← barrel top-level — public API của module
```

### Quy ước đặt tên

| Placeholder | Dạng | Ví dụ |
|-------------|------|-------|
| `<Entity>` | **số ít**, PascalCase | `Event`, `Ticket`, `User`, `Registration` |
| `<Entities>` | **số nhiều**, PascalCase | `Events`, `Tickets`, `Users`, `Registrations` |
| `<Module>` | **số ít**, PascalCase | `Events`, `Checkin`, `Auth`, `Billing` |

### Khi nào dùng prefix nào

- **`<Entity>Xxx.tsx`** — component gắn với một entity: `EventForm`, `EventTable`, `EventDeleteDialog`, `EventCard`, `EventDetails`.
- **`<Module>Xxx.tsx`** — component phạm vi toàn module, không thuộc entity đơn lẻ: `EventsFilters` (thanh filter cho tất cả event), `EventsStats` (card tổng hợp cấp module), `EventsPage` (page đã compose).
- **`use<Entities>.ts`** — toàn bộ hook liên quan một collection nằm trong MỘT file: `useEvents` (list), `useEvent(id)` (đơn), `useCreateEvent`, `useUpdateEvent`, `useDeleteEvent`, `useEventsFiltersStore` (Zustand). Chỉ tách file khi vượt ~300 dòng.
- **`<entity>.schema.ts`** — một file / entity cho zod schema. Được dùng lại bởi component form VÀ validation request của API service.
- **`<entities>Api.ts`** — một file / collection cho API service object. Export duy nhất tên `<entities>Api`.
- **`<entity>.ts`** — một file / entity cho domain type. Type thường suy ra từ zod schema (`z.infer<typeof eventSchema>`), kèm enum / branded type riêng.

### Quy tắc module

- Module **được phép import** từ `_shared/` và từ module khác qua barrel public `index.ts`.
- Module **không được** với vào file nội bộ của module khác (`@/modules/events/components/EventTable` là private; chỉ `@/modules/events` mới import được).
- Module **không được** tự thêm folder UI top-level. Tất cả UI component nằm trong `components/`.
- Module **không được** thêm folder `store/`. Zustand store nằm trong hook ở `hooks/use<Entities>.ts`.
- Code share cross-module → `_shared/` (hoặc `packages/ui/` nếu thực sự cross-app).
- Mỗi `index.ts` là **barrel** re-export chỉ public API — không phải tất cả internal.

### Anti-pattern (enforce bằng ESLint `no-restricted-paths`)

- ❌ `@/modules/events/components/EventForm` (deep import) → ✅ `@/modules/events` (barrel)
- ❌ `import { useEvents } from '@/modules/events/hooks/useEvents'` → ✅ `import { useEvents } from '@/modules/events'`
- ❌ Folder mới ở root module (`utils/`, `helpers/`, `constants/`, `api/`) → dùng folder đã có
- ❌ Folder `pages/` → component page cấp page là `components/<Module>Page.tsx`
- ❌ Folder `store/` → Zustand store là hook trong `hooks/use<Entities>.ts`

## Ví dụ module: `events`

```
src/modules/events/
├── components/
│   ├── EventDeleteDialog.tsx
│   ├── EventForm.tsx
│   ├── EventTable.tsx
│   ├── EventCard.tsx
│   ├── EventDetails.tsx
│   ├── EventStatusBadge.tsx
│   ├── EventsFilters.tsx
│   ├── EventsStats.tsx
│   ├── EventsPage.tsx                 ← page đã compose (được import bởi app/(dashboard)/.../events/page.tsx)
│   └── index.ts
├── hooks/
│   ├── index.ts
│   └── useEvents.ts                   ← useEvents, useEvent(id), useCreateEvent, useUpdateEvent, useDeleteEvent, useEventsFiltersStore
├── schemas/
│   ├── index.ts
│   └── event.schema.ts                ← eventSchema, createEventSchema, updateEventSchema
├── services/
│   ├── index.ts
│   └── eventsApi.ts                   ← eventsApi.list({orgId, ...filters}), .get(id), .create(...), .update(id, ...), .delete(id)
├── types/
│   ├── index.ts
│   └── event.ts                       ← type Event = z.infer<typeof eventSchema>; type EventStatus = 'draft' | 'published' | 'cancelled'
└── index.ts                           ← export { EventsPage, EventForm, EventTable, useEvents, eventsApi, ... }
```

## Shell của route (`src/app/`)

`src/app/` chỉ chứa:
- File `page.tsx` / `layout.tsx`
- Route handler (`api/webhook/stripe/route.ts`)
- Stylesheet global (`globals.css` với biến CSS Aurora)

Mỗi `page.tsx` là wrapper mỏng import composed page từ module:

```tsx
// src/app/(dashboard)/[orgSlug]/events/page.tsx
import { EventsPage } from '@/modules/events';

export default function Page() {
  return <EventsPage />;
}
```

```tsx
// src/app/(dashboard)/[orgSlug]/events/[eventId]/checkin/page.tsx
import { CheckInDashboard } from '@/modules/checkin';

export default async function Page({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  return <CheckInDashboard eventId={eventId} />;
}
```

## `src/components/ui/` — component shadcn (đường dẫn mặc định)

```
src/components/ui/
├── button.tsx                          # shadcn — CLI-installed, không edit
├── input.tsx                           # shadcn — CLI-installed
├── card.tsx                            # shadcn — CLI-installed
├── dialog.tsx                          # shadcn — CLI-installed
├── dropdown-menu.tsx                   # shadcn — CLI-installed
├── …                                   # mọi component shadcn nằm ở đây
└── (không có barrel — import từng cái trực tiếp)
```

**Dùng từ module:**

```tsx
// src/modules/events/components/EventForm.tsx
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
```

> **Mọi component shadcn được thêm qua CLI** (D11) — xem [`docs/design-system.md`](./design-system.md) § "shadcn CLI workflow". Đường dẫn install mặc định của shadcn là `src/components/ui/`, đúng chỗ mình cần. **Không bao giờ tự viết component tương đương shadcn. Không bao giờ edit file trong `src/components/ui/`** để thêm biến thể feature — wrap nó trong `src/modules/<module>/components/`.

## `src/lib/` — utility cross-module

```
src/lib/
├── utils.ts                            # shadcn helper `cn()` (CLI-managed)
├── date.ts                             # helper date-fns
├── format.ts                           # format number/currency
├── validate.ts                         # zod schema dùng chung (email, phone, slug, ...)
├── permissions.ts                      # helper check role
└── theme/
    ├── color-tokens.ts                 # typed export tên token Aurora
    └── motion.ts                       # variant framer-motion
```

**Dùng từ module:**

```tsx
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/format';
import { isValidEmail } from '@/lib/validate';
```

## `src/modules/_shared/` — primitive cross-module

Cho primitive điều phối cần biết nhiều module, nhưng chưa đủ generic để vào `src/lib/`:

```
src/modules/_shared/
├── api/
│   ├── client.ts                       # wrapper fetch, inject Authorization + X-Tenant-Id
│   ├── errors.ts                       # chuẩn hoá error
│   └── query-client.ts                 # factory TanStack QueryClient
├── config/
│   ├── env.ts                          # typed env reader
│   └── routes.ts                       # hằng số route
└── providers/
    ├── app-providers.tsx               # tất cả ClientProvider được wrap ở đây
    └── theme-provider.tsx              # toggle theme dark/light
```

> **Quy tắc ngón tay cái:** nếu chỉ MỘT module dùng, giữ trong module đó. Nếu 2+ module cần VÀ là utility generic (date, format, validate, cn), để vào `src/lib/`. Nếu 2+ module cần VÀ là domain-aware (API client, env reader, provider), để vào `src/modules/_shared/`.

## Path alias (tsconfig)

```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

> Một alias `@/*` là đủ — `@/components/ui/button` và `@/modules/events` đều resolve tự nhiên.

## Lựa chọn tech (theo layer)

- **UI:** Tailwind 4 + shadcn/ui + Radix primitive — cài trong `src/components/ui/` qua `yarn dlx shadcn@latest add <component>` (đường dẫn mặc định shadcn). Xem [`docs/design-system.md`](./design-system.md) về color token, typography và shadcn CLI workflow.
- **Design system:** custom palette **"Aurora"** (primary Electric Indigo + accent Sunset Coral) — **không dùng class palette shadcn/Tailwind mặc định trong code**. Dùng semantic token (`bg-primary`, `text-foreground`, `border-border`).
- **Data fetching:** TanStack Query trong `src/modules/_shared/api/query-client.ts`; RSC cho initial server data
- **Realtime:** Socket.IO client, đặt trong `services/<entities>Api.ts` của module (vd `services/checkInSocket.ts` trong `src/modules/checkin/`)
- **Form:** react-hook-form + zod (zod schema trong `src/modules/<module>/schemas/<entity>.schema.ts` — share với validation request API)
- **State:** Zustand store expose dạng hook trong `src/modules/<module>/hooks/use<Entities>.ts` (vd `useEventsFiltersStore`); React Query cho server state
- **i18n:** next-intl (EN / VI / JP ở MVP)
- **Auth:** **Custom JWT** (D2) — gọi NestJS `/v1/auth/login` + `/v1/auth/refresh` trực tiếp
- **Chart (dashboard):** Recharts hoặc visx, đặt trong `src/modules/checkin/components/`
- **Table:** TanStack Table, đặt trong `src/modules/events/components/EventTable.tsx` (compose với shadcn `<Table>`)
- **Date/time:** date-fns + date-fns-tz trong `src/lib/date.ts`
- **Hiển thị QR (attendee):** package `qrcode` npm, đặt trong `src/modules/registration/components/`
- **Animation:** framer-motion trong `src/lib/theme/motion.ts`
- **Utility:** `cn()`, formatter, validator trong `src/lib/`

## Tích hợp Custom JWT (D2)

```ts
// src/modules/auth/services/authApi.ts
import { apiClient } from '@/modules/_shared/api/client';   // (cross-module coordinator path)

export const authApi = {
  async login(input: { email: string; password: string; orgSlug: string }) {
    return apiClient.post<LoginResponse>('/v1/auth/login', input);
  },
  async refresh(refreshToken: string) {
    return apiClient.post<LoginResponse>('/v1/auth/refresh', { refreshToken });
  },
  async logout(refreshToken: string) {
    return apiClient.post<void>('/v1/auth/logout', { refreshToken });
  },
};
```

- Server Component gọi `getServerSession()` cho initial render
- Client component nhận session context tối thiểu (user id, orgId, role)
- Access token không bao giờ tới client; chỉ dùng bởi RSC → API gateway qua mạng nội bộ

## Ví dụ dashboard realtime (checkin)

```ts
// src/modules/checkin/services/checkInSocket.ts
import { io, Socket } from 'socket.io-client';

export function createCheckInSocket(eventId: string, token: string): Socket {
  return io(`/v1/realtime?eventId=${eventId}`, {
    auth: { token },
    transports: ['websocket'],
  });
}
```

```ts
// src/modules/checkin/hooks/useCheckIns.ts
'use client';
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { createCheckInSocket } from '../services/checkInSocket';

export function useCheckInSocket(eventId: string, token: string) {
  const qc = useQueryClient();
  useEffect(() => {
    const s = createCheckInSocket(eventId, token);
    s.on('AttendeeCheckedIn', (evt) => {
      qc.setQueryData(['checkin', eventId, 'stats'], (prev) => merge(prev, evt));
    });
    return () => { s.disconnect(); };
  }, [eventId, token, qc]);
}
```

## Trang event công khai

- Server-render cho SEO (`src/app/(public)/e/[slug]/page.tsx`)
- Compose từ `src/modules/registration/components/RegistrationPage.tsx` (hoặc `EventLandingPage.tsx`)
- Form có validation zod (schema từ `src/modules/registration/schemas/registration.schema.ts`)
- Payment provider selector (Stripe / VNPay) — server trả `checkoutUrl`
- Sau Stripe: webhook → redirect tới `/e/{slug}/register/success?order=...`
- Sau VNPay: client redirect tới `/v1/public/payment/{orderId}/return`

## Hiệu năng

- Lighthouse target: 95+ performance trên dashboard, 90+ trên trang event công khai
- LCP < 2.5s trên 4G
- Code splitting theo route (mặc định Next.js)
- Cache static asset qua Cloudflare (TTL dài, content-hash filename)

## Test

- **Unit:** Vitest + React Testing Library cho component và hook
- **Integration:** Playwright cho e2e (login → tạo event → đăng ký → thanh toán → check-in flow)
- **A11y:** jest-axe trong unit test
- **Module boundary:** ESLint `no-restricted-paths` ngăn deep import chéo module
- **Codegen check:** CI fail nếu module mới thiếu `index.ts` barrel ở mọi cấp
