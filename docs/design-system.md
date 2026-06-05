# Design System

> **Nguồn gốc** cho mọi quyết định visual trong `apps/web` và web client tương lai. **Không** dùng màu shadcn / Tailwind mặc định — mọi màu dưới đây đều có chủ đích.
> **Mọi component shadcn phải thêm qua CLI** (D11), không tự viết tay, để chúng inherit theme và dễ upgrade.

## Brand: "Aurora"

- **Tên (working):** Aurora — gợi năng lượng sự kiện bừng sáng.
- **Tone:** hiện đại, nhanh, đáng tin, điểm nhấn ấm (không corporate-lạnh).
- **Tagline hạt giống:** *"Check-in, the way it should be."*

## Color token

Mọi giá trị được lưu dưới dạng **HSL channel only** (`H S% L%`) bên trong biến CSS trong `apps/web/src/app/globals.css`. Tailwind đọc chúng qua pattern `hsl(var(--token))` (mặc định shadcn). Cách này làm theme và dark mode trở nên đơn giản.

### Light theme (mặc định)

| Token | HSL | Hex | Cách dùng |
|-------|-----|-----|-----------|
| `--background` | `40 20% 98%` | `#fafaf7` | Bề mặt trang (off-white ấm) |
| `--foreground` | `240 10% 9%` | `#17171a` | Chữ body |
| `--card` | `0 0% 100%` | `#ffffff` | Bề mặt card / panel |
| `--card-foreground` | `240 10% 9%` | `#17171a` | Chữ trong card |
| `--popover` | `0 0% 100%` | `#ffffff` | Popover / menu |
| `--popover-foreground` | `240 10% 9%` | `#17171a` | Chữ trong popover |
| `--primary` | `247 80% 62%` | `#5b4dee` | **Electric Indigo** — primary CTA, link, focus |
| `--primary-foreground` | `0 0% 100%` | `#ffffff` | Chữ trên primary |
| `--secondary` | `240 5% 96%` | `#f4f4f5` | Nút phụ, chip |
| `--secondary-foreground` | `240 6% 10%` | `#18181b` | Chữ trên secondary |
| `--muted` | `240 5% 96%` | `#f4f4f5` | Bề mặt muted |
| `--muted-foreground` | `240 4% 46%` | `#71717a` | Chữ muted (zinc-500) |
| `--accent` | `16 100% 60%` | `#ff6b35` | **Sunset Coral** — scan thành công, highlight, badge |
| `--accent-foreground` | `0 0% 100%` | `#ffffff` | Chữ trên accent |
| `--destructive` | `0 84% 60%` | `#ef4444` | Lỗi, nút xoá |
| `--destructive-foreground` | `0 0% 98%` | `#fafafa` | Chữ trên destructive |
| `--success` | `160 84% 39%` | `#10b981` | Trạng thái thành công, check-in hợp lệ |
| `--success-foreground` | `0 0% 100%` | `#ffffff` | Chữ trên success |
| `--warning` | `38 92% 50%` | `#f59e0b` | Trạng thái cảnh báo, plan limit |
| `--warning-foreground` | `0 0% 100%` | `#ffffff` | Chữ trên warning |
| `--border` | `240 6% 90%` | `#e4e4e7` | Border card / input |
| `--input` | `240 6% 90%` | `#e4e4e7` | Border input |
| `--ring` | `247 80% 62%` | `#5b4dee` | Focus ring (match primary) |
| `--radius` | `0.625rem` | `10px` | Radius mặc định |

### Dark theme (`<html class="dark">`)

| Token | HSL | Hex |
|-------|-----|-----|
| `--background` | `240 10% 6%` | `#0f0f12` |
| `--foreground` | `0 0% 98%` | `#fafafa` |
| `--card` | `240 10% 9%` | `#17171a` |
| `--card-foreground` | `0 0% 98%` | `#fafafa` |
| `--popover` | `240 10% 9%` | `#17171a` |
| `--popover-foreground` | `0 0% 98%` | `#fafafa` |
| `--primary` | `247 80% 68%` | `#7a6df5` (nâng cho contrast) |
| `--primary-foreground` | `240 10% 9%` | `#17171a` |
| `--secondary` | `240 4% 16%` | `#27272a` |
| `--secondary-foreground` | `0 0% 98%` | `#fafafa` |
| `--muted` | `240 4% 16%` | `#27272a` |
| `--muted-foreground` | `240 5% 65%` | `#a1a1aa` |
| `--accent` | `16 100% 62%` | `#ff7e4d` |
| `--accent-foreground` | `240 10% 9%` | `#17171a` |
| `--destructive` | `0 72% 51%` | `#dc2626` |
| `--destructive-foreground` | `0 0% 98%` | `#fafafa` |
| `--success` | `160 70% 45%` | `#15b783` |
| `--success-foreground` | `0 0% 100%` | `#ffffff` |
| `--warning` | `38 95% 56%` | `#f7a619` |
| `--warning-foreground` | `240 10% 9%` | `#17171a` |
| `--border` | `240 4% 16%` | `#27272a` |
| `--input` | `240 4% 16%` | `#27272a` |
| `--ring` | `247 80% 68%` | `#7a6df5` |

### Cách dùng trong code

```tsx
// ✅ dùng semantic token (themable)
<button className="bg-primary text-primary-foreground">Check in</button>
<div className="border border-border bg-card text-card-foreground">…</div>
<span className="bg-accent text-accent-foreground">VIP</span>

// ❌ không bao giờ dùng class palette Tailwind thô
<button className="bg-indigo-500 text-white">  // cấm
<div className="bg-zinc-100 border-zinc-200"> // cấm
```

Ngoại lệ: một shade zinc/neutral đơn lẻ bên trong micro-element không theo theme (vd backdrop focus) thì OK nếu comment `// neutral-utility`.

## Typography

| Vai trò | Family | Fallback | Size / line-height | Weight |
|---------|--------|----------|--------------------|--------|
| Display (hero, h1) | Geist | system-ui | 48 / 56 | 600 |
| Heading (h2–h4) | Geist | system-ui | 24–32 / 32–40 | 600 |
| Body | Inter | system-ui | 14 / 22 | 400 |
| Body emphasis | Inter | system-ui | 14 / 22 | 500 |
| Small / caption | Inter | system-ui | 12 / 18 | 400 |
| Numeric (count, timer) | JetBrains Mono | ui-monospace | 14–48 / 1.2 | 500 |
| QR / scan code | JetBrains Mono | ui-monospace | 12 / 16 | 400 |

Load qua `next/font/google` (Geist + Inter) và self-host JetBrains Mono.

## Spacing

Dùng scale mặc định của Tailwind (base 4 px) với **2 utility tuỳ chỉnh** trong `tailwind.config.ts`:

| Token tuỳ chỉnh | Giá trị | Dùng cho |
|------------------|---------|----------|
| `spacing-section` | `6rem` | Padding section trên landing page |
| `spacing-stack` | `1.25rem` | Nhịp dọc mặc định giữa các field form |

## Radius

- Mặc định `--radius: 0.625rem` (10 px)
- Lớn hơn: `rounded-xl` (12 px) cho card
- Pill: `rounded-full` cho badge, tag, status chip
- **Không bo vuông hoàn toàn** (`rounded-none`) — lệch brand

## Shadow

- `--shadow-sm`: `0 1px 2px 0 rgb(0 0 0 / 0.05)`
- `--shadow-md`: `0 4px 6px -1px rgb(0 0 0 / 0.08), 0 2px 4px -2px rgb(0 0 0 / 0.05)`
- `--shadow-lg`: `0 10px 25px -5px rgb(0 0 0 / 0.10), 0 8px 10px -6px rgb(0 0 0 / 0.05)`
- Brand glow: `0 0 0 4px hsl(247 80% 62% / 0.15)` (focus ring + halo CTA hero)

## Animation

- Dùng `framer-motion` cho page transition và modal/drawer
- Duration: 120 ms (micro), 200 ms (small), 320 ms (medium), 500 ms (large)
- Easing: `cubic-bezier(0.4, 0, 0.2, 1)` (`ease-out` của Tailwind)
- **Tôn trọng `prefers-reduced-motion`** — tắt transition không thiết yếu

## Biến thể component (override trên shadcn)

| Component | Biến thể tuỳ chỉnh |
|-----------|---------------------|
| `Button` | thêm `variant="brand"` (gradient primary + accent), `size="xl"` (CTA hero) |
| `Card` | thêm `variant="elevated"`, `variant="outline"` |
| `Badge` | thêm `tone="success"`, `tone="warning"`, `tone="info"`, `tone="accent"` |
| `Input` | size mặc định tăng lên 40 px |
| `Table` | header sticky, row zebra, hover state dùng `bg-muted/50` |
| `Toast` | accent cho success, destructive cho error |

Các cái này thêm bằng wrapper component trong `src/modules/<module>/components/`, **không** edit file shadcn gốc trong `src/components/ui/` (để `yarn dlx shadcn@latest add …` không ghi đè).

## Bề mặt branding

- **Logo:** wordmark "**checkin.**" bằng Geist 700, dấu chấm bằng màu `--accent`. Dùng SVG, không dùng font cho app icon.
- **Favicon:** monogram "c" trong vòng tròn indigo
- **OG image:** 1200×630, nền gradient indigo, wordmark lớn + tagline
- **Email template:** cùng palette, inline style (Resend)

---

## Workflow shadcn CLI (bắt buộc)

> **Quy tắc:** mọi component shadcn thêm qua CLI. Không copy-paste từ docs, không tự viết `Button.tsx` re-implement Radix. CLI đảm bảo code upstream-compatible và mình có thể kéo patch.

### Setup ban đầu (một lần / app)

```bash
cd apps/web
yarn dlx shadcn@latest init
```

Lệnh này ghi `components.json` và patch `tailwind.config.ts` + `src/app/globals.css`. Với cấu trúc monorepo, đường dẫn install **mặc định** của shadcn (`src/components/ui/`) đúng chỗ mình muốn — không cần alias override cho path `ui`. Giữ alias ở mặc định shadcn (trỏ tới `@/components`, `@/lib`, `@/hooks`):

```json
// apps/web/components.json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "tailwind.config.ts",
    "css": "src/app/globals.css",
    "baseColor": "neutral",
    "cssVariables": true
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  },
  "iconLibrary": "lucide"
}
```

> Mình dùng `baseColor: "neutral"` chỉ là **điểm khởi đầu** cho CLI; sau đó **override mọi token** trong `globals.css` sang giá trị Aurora. Không bao giờ để neutral còn nguyên trong commit.

### Thêm component

```bash
cd apps/web
yarn dlx shadcn@latest add button
yarn dlx shadcn@latest add card
yarn dlx shadcn@latest add dialog
yarn dlx shadcn@latest add input
yarn dlx shadcn@latest add label
yarn dlx shadcn@latest add form
yarn dlx shadcn@latest add table
yarn dlx shadcn@latest add toast
yarn dlx shadcn@latest add dropdown-menu
yarn dlx shadcn@latest add select
yarn dlx shadcn@latest add tabs
yarn dlx shadcn@latest add badge
yarn dlx shadcn@latest add avatar
yarn dlx shadcn@latest add sheet
yarn dlx shadcn@latest add tooltip
yarn dlx shadcn@latest add skeleton
yarn dlx shadcn@latest add alert
```

> Thêm nhiều component một lúc: `yarn dlx shadcn@latest add button card input` — nhanh hơn, lockfile update 1 lần.

### Thêm theo phase

**Phase 0 (foundation):**
```bash
yarn dlx shadcn@latest add button input label
```

**Phase 1 (auth):**
```bash
yarn dlx shadcn@latest add card form input-otp alert
```

**Phase 2 (events):**
```bash
yarn dlx shadcn@latest add table dropdown-menu dialog select calendar
```

**Phase 3 (ticketing / public pages):**
```bash
yarn dlx shadcn@latest add card separator aspect-ratio
```

**Phase 4 (check-in dashboard):**
```bash
yarn dlx shadcn@latest add tabs badge tooltip skeleton toast sheet
```

### Upgrade sau khi shadcn release

```bash
# Check component lỗi thời
yarn dlx shadcn@latest diff

# Upgrade 1 component (sẽ ghi đè local — review diff!)
yarn dlx shadcn@latest add button --overwrite
```

> Khi tuỳ chỉnh component shadcn (vd thêm `variant`), đặt **wrapper** trong `src/modules/<module>/components/<name>-brand.tsx` và import từ đó. **Không** edit file bên trong `src/components/ui/`.

### Cấm

- ❌ Copy-paste component shadcn từ blog
- ❌ Tự viết `Button.tsx` re-implement Radix Slot
- ❌ Edit file nguồn trong `src/components/ui/button.tsx` để thêm biến thể feature (dùng wrapper)
- ❌ Để `baseColor: neutral` sống trong `globals.css` (phải là token Aurora)
- ❌ Dùng `bg-indigo-500` / `bg-zinc-100` v.v. — dùng semantic token
- ❌ Quên commit thay đổi `components.json` khi chạy lại `init`

## Vị trí file cho asset design

```
apps/web/
├── components.json                       # cấu hình shadcn (D11)
├── tailwind.config.ts                    # extend theme để map CSS var
├── src/
│   ├── app/
│   │   └── globals.css                   # biến CSS (Aurora light + dark) — ở đường dẫn mặc định shadcn
│   ├── components/
│   │   └── ui/                           # component shadcn (CLI-installed, không edit)
│   │       ├── button.tsx
│   │       ├── card.tsx
│   │       ├── …
│   │       └── index.ts                  # (tuỳ chọn) barrel — không bắt buộc theo mặc định shadcn
│   ├── lib/
│   │   ├── utils.ts                      # shadcn helper `cn()` (CLI-managed)
│   │   ├── theme/
│   │   │   ├── color-tokens.ts           # export TypeScript tên token (cho typed access)
│   │   │   └── motion.ts                 # variant framer-motion
│   │   └── …                             # date, format, validate
│   └── modules/                          # feature module
└── public/
    └── brand/
        ├── logo.svg
        ├── logo-mark.svg
        ├── favicon.svg
        └── og.png
```
