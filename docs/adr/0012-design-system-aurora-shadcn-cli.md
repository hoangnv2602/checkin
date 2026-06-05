# 0012. Design system: custom palette "Aurora" + shadcn CLI workflow

- **Status:** Accepted (D11)
- **Date:** 2026-06-04

## Context

Palette mặc định của shadcn/ui và Tailwind trông generic và không thể hiện brand. Một số vấn đề lặp lại:
- Code rải rác với `bg-indigo-500` / `text-zinc-900` thô — không có semantic, không có câu chuyện dark mode.
- Dev mới tự viết component Button/Dialog/Input dựa trên blog cũ → drift, bug, không có upgrade path.
- File "design system" trong wiki nào đó không ai đọc.

Team muốn:
1. Một **palette tuỳ chỉnh, có chủ đích** cảm thấy hiện đại và tràn năng lượng (brand check-in event).
2. **Không màu mặc định** trong code — mọi màu là semantic token map với biến CSS.
3. **Mọi component shadcn cài qua CLI** để giữ upstream-compatible.

## Decision

Áp dụng design system tên **"Aurora"** (D11) và enforce shadcn CLI workflow cho mọi component.

### Palette

- **Primary:** Electric Indigo (`hsl(247 80% 62%)`, `#5b4dee`) — brand chính, CTA, focus
- **Accent:** Sunset Coral (`hsl(16 100% 60%)`, `#ff6b35`) — scan thành công, highlight, badge
- **Surface (light):** Off-white ấm (`hsl(40 20% 98%)`)
- **Surface (dark):** Gần đen (`hsl(240 10% 6%)`)
- Danh sách token đầy đủ trong [`docs/design-system.md` § Color tokens](../design-system.md#color-tokens)

Mọi màu lưu dưới dạng HSL channel bên trong biến CSS trong `apps/web/src/app/globals.css` (đường dẫn mặc định shadcn). Tailwind đọc qua pattern `hsl(var(--token))` mặc định shadcn.

### Chỉ semantic token

Code dùng token, không class palette thô:

```tsx
<button className="bg-primary text-primary-foreground">Check in</button>   // ✅
<button className="bg-indigo-500 text-white">Check in</button>          // ❌ cấm
```

### shadcn CLI workflow

Mọi component shadcn cài qua:

```bash
cd apps/web
yarn dlx shadcn@latest add button
```

Component đặt trong `apps/web/src/components/ui/` — đường dẫn install **mặc định** shadcn. Không cần alias override cho path UI; giữ alias mặc định (`@/components`, `@/lib`, `@/hooks`).

**Quy tắc tuỳ chỉnh:**
- Thêm biến thể feature → wrap file CLI-managed trong `apps/web/src/modules/<module>/components/<name>-brand.tsx`. **Không** edit file bên trong `src/components/ui/`.
- Đổi theme → chỉ edit `src/app/globals.css` và `tailwind.config.ts` (mapping token).
- Upgrade shadcn → chạy `yarn dlx shadcn@latest diff` trước, rồi `yarn dlx shadcn@latest add <name> --overwrite` sau khi review diff.

## Consequences

### Positive
- Brand nhất quán và có chủ đích xuyên suốt các bề mặt.
- Dark mode "just works" vì mọi màu là biến CSS.
- Upgrade shadcn upstream dễ (mình không edit source).
- Rule ESLint có thể flag class palette thô (`no-restricted-syntax` trên tên class `bg-{color}-{shade}` Tailwind).
- Designer tweak palette trong 1 file mà không đụng component.

### Negative
- Công tác design token ban đầu (~½ ngày để author + verify contrast).
- Dev copy-paste ví dụ shadcn từ web sẽ đưa vào màu cấm; cần PR review.
- Upgrade component shadcn tuỳ chỉnh nặng cần merge thủ công.

### Neutral
- File `color-tokens.ts` nhỏ export tên token cho typed access trong TS (hữu ích cho chart, ECharts, v.v.).
- Asset brand (logo SVG, favicon, OG image) nằm trong `apps/web/public/brand/`.

## Anti-pattern (enforce bằng review + lint)

- ❌ `bg-indigo-500`, `bg-zinc-100`, `text-gray-900`, `border-slate-200` — dùng semantic token
- ❌ Tự viết `Button.tsx` re-implement Radix Slot
- ❌ Edit file bên trong `src/components/ui/button.tsx` để thêm biến thể tuỳ chỉnh
- ❌ Để `baseColor: "neutral"` sống trong `components.json` / `globals.css`
- ❌ Quên commit `components.json` sau khi chạy lại `yarn dlx shadcn@latest init`
- ❌ Inline giá trị màu (`style={{ color: '#5b4dee' }}`) — dùng token

## Alternatives considered

- **Giữ palette Tailwind mặc định** — start nhanh, trông generic, dark mode đau đớn, không có brand.
- **Tự build component library** — vài tháng công, không có upstream maintain, ROI thấp.
- **Dùng Mantine / Chakra / MUI** — opinionated hơn, khó tuỳ chỉnh theo brand, bundle lớn hơn.

## Revisit if

- Palette Aurora cảm thấy lỗi thời hoặc lệch brand sau 6 tháng → lặp qua ADR mới (vẫn semantic, chỉ đổi giá trị).
- A/B testing cho thấy biến thể palette khác convert tốt hơn → cùng cách, swap token.
- shadcn không còn được maintain → migrate sang fork; kỷ luật token vẫn giữ nguyên.
