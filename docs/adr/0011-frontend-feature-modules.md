# 0011. Tổ chức code Next.js: feature module

- **Status:** Accepted (D10)
- **Date:** 2026-06-04
- **Revised:** 2026-06-04 (chuẩn hoá về layout `src/modules/<module>/` bắt buộc `components/`, `hooks/`, `schemas/`, `services/`, `types/` + barrel ở mọi cấp)

## Context

App web sẽ có ~10–15 feature riêng biệt (auth, events, checkin dashboard, registration, billing, members, settings, public event page, v.v.). Tổ chức mặc định của Next.js trộn business code với route definition trong `app/`, và shared code nằm trong `components/` + `lib/` — chạy tốt cho 2–3 feature nhưng xuống cấp nhanh.

Hai lựa chọn chính:
- **Default Next.js** — mọi thứ trong `app/`, `components/`, `lib/`, `hooks/`. Quen thuộc, nhưng không scale.
- **Feature module** — `src/modules/<module>/` với layout nghiêm ngặt (components / hooks / schemas / services / types + barrel mọi cấp). Scale, dự đoán được, dễ review.

## Decision

Dùng **feature module** (D10) cho toàn bộ business code trong `apps/web/`, với layout **chuẩn hoá bắt buộc** / module.

- `apps/web/src/app/` chỉ chứa route Next.js, layout, route handler, và `globals.css` (biến CSS Aurora). Mỗi `page.tsx` là wrapper mỏng import page-level component từ module.
- `apps/web/src/modules/<module>/` sở hữu toàn bộ code cho feature đó, theo layout chính xác:

```
src/modules/<module>/
├── components/
│   ├── <Entity>DeleteDialog.tsx
│   ├── <Entity>Form.tsx
│   ├── <Entity>Table.tsx
│   ├── <Entity>Card.tsx            (tùy chọn)
│   ├── <Entity>Details.tsx         (tùy chọn)
│   ├── <Module>Filters.tsx         (tùy chọn, widget cấp module)
│   ├── <Module>Stats.tsx           (tùy chọn, widget cấp module)
│   ├── <Module>Page.tsx            (page đã compose — import bởi app/)
│   └── index.ts                    (barrel — re-export public component)
├── hooks/
│   ├── index.ts                    (barrel)
│   └── use<Entities>.ts            (collection + item + mutation + Zustand store)
├── schemas/
│   ├── index.ts                    (barrel)
│   └── <entity>.schema.ts          (zod: schema, createSchema, updateSchema)
├── services/
│   ├── index.ts                    (barrel)
│   └── <entities>Api.ts            (service object: list/get/create/update/delete)
├── types/
│   ├── index.ts                    (barrel)
│   └── <entity>.ts                 (domain type suy ra từ schema)
└── index.ts                        (barrel top-level — public API của module)
```

- `src/modules/_shared/` chứa primitive coordination cross-module (API client base, query factory, env reader, hằng số route, provider cấp app).
- **`src/components/ui/`** là đường dẫn install **mặc định** của shadcn — mọi component shadcn nằm ở đó (`button.tsx`, `card.tsx`, `dialog.tsx`, v.v.). Feature module import từ `@/components/ui/button` v.v.
- **`src/lib/`** chứa utility cross-module generic KHÔNG liên quan shadcn: `date.ts`, `format.ts`, `validate.ts`, `permissions.ts`, và `utils.ts` (helper `cn()` của shadcn, CLI-managed).
- `packages/ui/` (đã có) chứa component phải share với app khác (vd widget embeddable, white-label portal). Nếu không, share qua `src/components/ui/` hoặc `src/lib/`.
- Boundary module enforce bằng ESLint `no-restricted-paths` — deep import chéo module fail build.

## Quy tắc

- Module **được phép import** từ `_shared/` và từ top-level `index.ts` barrel của module khác.
- Module **không được** với vào file nội bộ của module khác (`@/modules/events/components/EventForm` là private; chỉ `@/modules/events` mới import được).
- Đặt tên:
  - `<Entity>` = **số ít** PascalCase (vd `Event`, `Ticket`, `User`)
  - `<Entities>` = **số nhiều** PascalCase (vd `Events`, `Tickets`, `Users`)
  - `<Module>` = **số ít** PascalCase (vd `Events`, `Checkin`, `Auth`)
- Module **không được** thêm folder top-level mới (không `utils/`, `helpers/`, `constants/`, `api/`, `store/`, `pages/`). Tất cả fit vào 5 folder chuẩn.
- Module **không được** thêm folder `store/` — Zustand store là hook trong `hooks/use<Entities>.ts`.
- Module **không được** thêm folder `pages/` — component page-level là `components/<Module>Page.tsx`.
- Code share được ≥ 2 module dùng → chuyển vào `_shared/`.
- Feature mới = tạo `src/modules/<module>/` và route mỏng trong `src/app/`.
- Xoá feature = xoá thư mục module + route của nó.

## Consequences

### Positive
- Thư mục `app/` là bản đồ route dễ điều hướng — ai cũng có thể tìm trang chủ bằng cách đọc 1 file.
- Dev mới own trọn một module end-to-end và ship mà không đụng module khác.
- Module có thể nâng cấp thành package sau (hoặc tách thành micro-app) mà không cần viết lại.
- ESLint boundary làm illegal import fail ở build time.
- Test đặt cùng module (hoặc dưới `__tests__/` mỗi module).
- Layout chuẩn nghĩa là PR reviewer điều hướng được mọi module mà không cần học convention.
- Schema là first-class: cùng zod schema validate input form VÀ request API — zero drift.

### Negative
- Một ít duplication giữa các module chấp nhận được và thậm chí đáng mong (mỗi module tự sở hữu `<entities>Api.ts`).
- Một file lớn (`hooks/use<Entities>.ts`) có thể vượt ~300 dòng cho entity rất giàu. Tách chỉ khi justified ở header file.
- Dev mới cần học quy ước 5-folder + barrel.
- Path alias setup (`@/*` → `src/*`) bắt buộc trong `tsconfig.json`.

### Neutral
- `_shared/` là lớp mềm — chỉ promote lên `packages/ui/` khi được app khác reuse.
- Tree-shaking OK vì `no-restricted-paths` ngăn deep import.

## Anti-pattern (enforce bằng review + lint)

- ❌ `import { useEvents } from '@/modules/events/hooks/useEvents'` (deep import) — dùng `@/modules/events`
- ❌ Folder mới ở root module (`utils/`, `helpers/`, `constants/`, `api/`, `store/`, `pages/`)
- ❌ Folder `pages/` — component page-level là `components/<Module>Page.tsx`
- ❌ Folder `store/` — Zustand store là hook trong `hooks/use<Entities>.ts`
- ❌ Đặt business code trong `app/` (vd form phức tạp trong `app/(dashboard)/events/page.tsx`)
- ❌ Edit file shadcn CLI-managed bên trong `src/components/ui/button.tsx` để thêm biến thể feature — wrap trong `src/modules/<module>/components/`
- ❌ Quên `index.ts` barrel ở bất kỳ cấp nào — CI check fail build

## Alternatives considered

- **Default Next.js (route-first)** — quen thuộc nhưng không scale tới 10+ feature.
- **Feature-Sliced Design (FSD)** — hierarchy layer nghiêm ngặt (`app/pages/widgets/features/entities/shared`); opinionated hơn, khó hơn cho dev Next.js mới học, và không idiomatic cho App Router.
- **Atomic Design** — components/atoms → molecules → organisms; không giải quyết hooks/services/schemas/store.

## Revisit if

- Module trở nên quá lớn cần sub-module nội bộ → tách thành `src/modules/<module>/<sub>/`.
- App mới (vd widget white-label) cần share 50%+ `src/components/ui/` → promote lên `packages/ui`.
- Concern cross-cutting mới xuất hiện (vd analytics, feature flag) → hoặc thêm vào `_shared/` hoặc thêm folder top-level mới và sửa ADR này.
