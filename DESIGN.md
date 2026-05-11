# Voxzenn — Design Redesign Plan (Option A: Dark & Premium)

## Visual Direction

**Inspiration:** Linear, Vercel, Resend, Raycast  
**Feel:** Serious, technical, premium — a product built by people who care about craft  
**Concept:** "The phone rings at 2am. Voxzenn answers." — dark theme fits the 24/7 always-on nature of the product.

---

## Color Palette

Replace the current light/indigo palette entirely.

```css
/* Backgrounds */
--color-bg:           #0a0a0f;   /* near-black with a hint of blue */
--color-bg-card:      #111118;   /* card surfaces */
--color-bg-subtle:    #1a1a24;   /* hover states, subtle fills */
--color-border:       #222230;   /* borders */
--color-border-focus: #7c6ff7;   /* focused inputs */

/* Text */
--color-text-primary:   #f0f0ff;  /* near-white with slight blue tint */
--color-text-secondary: #9090b0;  /* muted */
--color-text-muted:     #50506a;  /* very muted */

/* Brand — shift from indigo to violet/purple */
--color-brand:          #7c6ff7;  /* violet — more distinctive than #6366f1 */
--color-brand-hover:    #9b90ff;
--color-brand-light:    #1e1a3a;  /* dark brand tint for badges/highlights */

/* Accent — for highlights, glows */
--color-accent-glow:  rgba(124, 111, 247, 0.15);

/* Status colors — slightly adjusted for dark mode */
--color-success:        #34d399;
--color-success-light:  #0a2a1e;
--color-danger:         #f87171;
--color-danger-light:   #2a0f0f;
--color-warning:        #fbbf24;
--color-warning-light:  #2a1f0a;
```

---

## Typography

- **Font:** Keep Inter — but use it more aggressively (bolder weights, larger size contrasts)
- **Hero h1:** 64-80px, weight 800, tight line-height (1.05)
- **Key change:** The headline should have one word or phrase in a gradient (brand violet → lighter violet)

```css
.gradient-text {
  background: linear-gradient(135deg, #7c6ff7, #b8b0ff);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}
```

---

## Landing Page Layout Changes

### Nav
- Dark background, no visible border (use shadow or very subtle separator)
- Logo: wordmark only (no emoji)
- Add a subtle "Status: All systems operational" indicator (green dot)

### Hero Section
- **Left-aligned** (not centered) — more editorial, less template
- Large stat: "**12,400+** calls answered" — social proof in the hero itself
- Background: subtle radial gradient glow behind the headline
- Right side: a **live animated transcript** — fake but realistic conversation bubbles that type in, showing the AI booking an appointment. This is the key differentiator.

```
[LEFT]                              [RIGHT - animated]
Your business                       ┌─────────────────────────┐
never misses                        │ 🟢 Connected             │
a call again.                       │                          │
                                    │ Caller: Hi I need to     │
[Start Free →]  [Live Demo]         │ book an appointment      │
                                    │                          │
12,400+ calls · 4.9★ · 24/7        │ AI: Of course! What day  │
                                    │ works best for you?      │
                                    │                          │
                                    │ Caller: Thursday morning │
                                    │                          │
                                    │ ✅ Appointment booked    │
                                    └─────────────────────────┘
```

### Social Proof Bar (new section)
A dark strip below the hero: "Trusted by businesses in 12 industries" + small logos or industry names as pills.

### Features Section
- **No emoji icons** — use SVG icons (Lucide React)
- Dark cards with a very subtle border glow on hover
- 3-column grid (not 2)
- Each card has a thin colored top border to add visual interest

### How It Works
- Replace numbered circles with a **vertical timeline** on the left
- Right side shows a mock UI screenshot for each step
- More visual, less listicle

### Pricing Section (new — currently missing)
- Dark cards, one highlighted with a glow border (the recommended plan)
- Simple: Free / Pro / Business
- Even if not fully implemented, showing pricing builds product credibility

### CTA Section
- Replace the flat purple banner with a **gradient + noise texture** background
- Large centered text + input field "Enter your email" inline with button (no separate signup page friction)

### Footer
- Multi-column: Product / Company / Legal
- Dark with slightly lighter background than the page

---

## Component Changes

### Buttons
```css
.btn-primary {
  background: linear-gradient(135deg, #7c6ff7, #6358e0);
  box-shadow: 0 0 20px rgba(124, 111, 247, 0.3);
}
.btn-primary:hover {
  box-shadow: 0 0 30px rgba(124, 111, 247, 0.5);
}
```

### Cards
```css
.card {
  background: #111118;
  border: 1px solid #222230;
  /* on hover: */
  border-color: rgba(124, 111, 247, 0.3);
  box-shadow: 0 0 20px rgba(124, 111, 247, 0.08);
}
```

### Input
```css
.input {
  background: #0a0a0f;
  border: 1px solid #222230;
  color: #f0f0ff;
}
.input:focus {
  border-color: #7c6ff7;
  box-shadow: 0 0 0 3px rgba(124, 111, 247, 0.15);
}
```

---

## Icons

Install Lucide React (lightweight, consistent, professional):
```bash
npm install lucide-react
```

Replace emojis with icons:
- 🎙️ → `<Mic />` 
- 📅 → `<Calendar />`
- ⚡ → `<Zap />`
- 🔧 → `<Settings />`
- 📊 → `<BarChart2 />`
- 🌐 → `<Globe />`
- 📞 → `<Phone />`

---

## Animated Hero Transcript (Key Feature)

A React component that types out a fake conversation using `useEffect` + `setTimeout` — gives immediate visual proof of what the product does without the user having to make a call.

```tsx
// Transcript bubbles animate in one by one, ~800ms apart
const demoConversation = [
  { role: "caller", text: "Hi, I need to book an appointment" },
  { role: "ai", text: "Of course! What day works best for you?" },
  { role: "caller", text: "Thursday morning if possible" },
  { role: "ai", text: "Thursday at 10am works. Can I get your name?" },
  { role: "caller", text: "Sarah Johnson" },
  { role: "ai", text: "Perfect. Booking confirmed for Sarah — Thursday 10am." },
  { role: "system", text: "✅ Appointment saved to dashboard" },
];
```

---

## Implementation Order

1. **Update `globals.css`** — new dark tokens, button styles, card styles, gradient text
2. **Update `app/page.tsx`** — new landing layout (left-aligned hero, animated transcript, features with Lucide icons, pricing)
3. **Add `components/DemoTranscript.tsx`** — animated conversation component
4. **Update dashboard** — dark sidebar layout
5. **Update auth pages** — dark login/signup

---

## What Stays the Same

- CSS custom property system (just updating the values)
- Component class names (`.btn`, `.card`, `.input` etc.)
- Next.js structure and routing
- All backend code — zero changes needed
