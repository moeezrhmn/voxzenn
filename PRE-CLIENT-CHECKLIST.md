# Voxzenn — Pre-Client Readiness Checklist

---

## Deployment Strategy — One App, Many Clients (Multi-Tenant)

**Short answer: Do NOT deploy a separate instance per client. Keep everyone on one app.**

This is already how the codebase is built — each user gets their own `user_id` and their config, calls, and bookings are fully isolated in the database. When a client signs up at `voxzenn.quanter.dev`, they get their own account and their own AI. They never see anyone else's data.

**Why this is the right model for you:**

- One codebase to maintain — you fix a bug once, every client benefits
- One deployment to manage — no per-client servers, no per-client bills
- When you add a new feature, all clients get it automatically
- Scale to 100 clients without doing 100 deployments
- This is exactly how Calendly, Notion, and every SaaS you use works

**When to consider a separate deployment:**
Only if a client has strict data isolation requirements (enterprise, healthcare, government) and is willing to pay a significant premium (e.g. $500+/month). That is a later conversation, not now.

---

## How to Handle Custom Client Requirements

US small businesses will inevitably ask for things not in the product. Here is the right way to think about it:

### Rule: Build features, not one-offs

When a client asks for something custom, ask yourself: **"Would 5 other businesses also want this?"**

- **Yes** → Build it properly into the product. Add it to config options. Every client benefits. This is how the product grows.
- **No** → It is a custom development request. Charge for it separately or politely decline.

### Examples of common custom requests and how to handle them:

| Client asks | Right response |
|---|---|
| "Can my AI also handle Spanish callers?" | Build multilingual detection — add to product for everyone |
| "Can the AI mention our specific promotions?" | Already handled via FAQs — show them how to add it |
| "Can I get a text when someone books?" | Build SMS notifications (Twilio/Resend) — add to product |
| "Can the AI book into my specific calendar software?" | New integration — charge extra or add to roadmap |
| "Can I have a custom voice for my brand?" | Add voice selection to config — build for everyone |
| "Can you change the dashboard colors to match my brand?" | White-label tier — charge premium, not a standard feature |

### The right mindset:
Every client complaint or request is a product improvement signal. Keep a running list. The clients paying attention to details are doing your product research for free.

---

## Phase 1 — Before the First Demo (Do This Now)

These are the only things you need before showing this to any US client.

### 1. Deploy to a Live URL
- [ ] Deploy frontend to Vercel — free, takes 5 minutes, gives you `voxzenn.vercel.app`
  - Connect GitHub repo → Vercel auto-deploys on every push
  - Set `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_WS_URL` to your VPS backend URL
- [ ] Deploy backend to VPS at `api-voxzenn.quanter.dev`
  - Use PM2: `pm2 start "uvicorn main:app --host 0.0.0.0 --port 8000" --name voxzenn-api`
  - Nginx reverse proxy + SSL via certbot
- [ ] Verify `/health` endpoint returns `{"status": "ok"}`

### 2. AI Disclosure in Greeting (Legal — 10 min fix)
- [ ] Default greeting template must start with: *"Hi, I'm an AI assistant for [Business Name]..."*
- [ ] Update `DEFAULT_GREETING` in onboarding page and system prompt in `ws_handler.py`
- [ ] Required by FTC + multiple US state laws — non-negotiable

### 3. Polished Demo Business
- [ ] Create one pre-configured demo account in the database
- [ ] Use a realistic business: e.g. *"Peak Fitness Studio"* or *"Riverside Law Group"*
- [ ] Fill in realistic FAQs (5-8 questions), working hours, polished greeting
- [ ] This is what you show every client — never demo with empty or test data

### 4. Settings Page (Clients will ask "how do I change things?")
- [ ] Build `/dashboard/settings` — edit business name, hours, personality, FAQs, greeting
- [ ] This completes the loop: sign up → onboard → use → edit → use again

### 5. After-Hours Handling
- [ ] AI should detect calls outside `working_hours` and respond appropriately
- [ ] *"Thanks for calling! We're currently closed. Our hours are [hours]. I can take a message or you can call back."*
- [ ] Every US small business owner asks this in the first 2 minutes of a demo

### 6. CORS + Security for Production
- [ ] Set `allow_origins` in FastAPI to your actual frontend domain (not `localhost`)
- [ ] Set `AUTH_SECRET` in `.env.local` to a long random string (not the placeholder)
- [ ] Rotate the Groq API key if it has ever been in a public repo or shared anywhere

---

## Phase 2 — After First Client Shows Interest (Before They Pay)

Do these before asking anyone to pay or use it for real business calls.

### Legal Pages
- [ ] `/privacy` — Privacy Policy page (use Termly or PrivacyPolicies.com generator, 15 min)
- [ ] `/terms` — Terms of Service (include: no liability for missed calls, AI errors, or booking mistakes)
- [ ] Add disclaimer on signup: *"By signing up you agree to our Terms and Privacy Policy"*
- [ ] Add to Terms: *"Not intended for HIPAA-regulated industries (medical, dental, therapy)"*

### Transfer to Human
- [ ] `[TRANSFER]` signal in LLM — AI says *"Let me have someone from the team follow up with you"*
- [ ] Add `transfer_number` field to config — AI reads it back to caller
- [ ] Every US business owner asks: *"What if the caller needs a real person?"*

### Fallback for Unknown Questions
- [ ] System prompt must instruct: *"If you don't know the answer, say 'I don't have that info right now — I'll make sure someone follows up with you soon.'"*
- [ ] AI should never guess or hallucinate an answer to a question not in the FAQs

### Rate Limiting
- [ ] Add `slowapi` to FastAPI — limit WebSocket connections per IP to prevent abuse
- [ ] Groq API has free tier limits — runaway calls will get you cut off

### Database Backups
- [ ] Set up a daily `pg_dump` cron job on the VPS
- [ ] Store backup in a separate location (even a local folder is better than nothing)

---

## Phase 3 — Growth (When You Have 5+ Clients)

Do not do these yet. They are premature until you have proven demand.

### Real Phone Number (Twilio)
- [ ] Single biggest gap between demo and sellable product
- [ ] Browser-only call is fine for demos — real businesses need a real number
- [ ] Twilio: ~$1.15/month per number + $0.0085/min inbound
- [ ] Add `twilio_number` field to config — client provides their own or you assign one

### Email Notifications
- [ ] Resend API (free up to 3,000 emails/month) — notify business owner on new booking
- [ ] Welcome email after signup

### Dashboard Subpages
- [ ] `/dashboard/calls` — call log with expandable transcript viewer
- [ ] `/dashboard/bookings` — bookings table with confirm/cancel actions

### Conversation Summary
- [ ] Second LLM call after each call ends — generates a 2-line summary
- [ ] Store in `calls.summary` — shown in dashboard call log

### Uptime Monitoring
- [ ] UptimeRobot (free) — ping `/health` every 5 minutes, email alert if down
- [ ] You cannot have a paying client's AI go down unnoticed

### Domain
- [ ] Register `voxzenn.com` when you have the first paying client or first serious interest
- [ ] `.com` costs ~$12/year — worth it before any public marketing

---

## Phase 4 — When Clients Ask for More (Later)

Things clients will eventually ask for that are worth building into the product:

| Feature | Who asks for it | Effort |
|---|---|---|
| Spanish / bilingual AI | Any business in CA, TX, FL | Medium |
| Custom AI voice | Salons, boutique businesses | Low (edge-tts has voice options) |
| Google Calendar integration | Law firms, consultants | Medium |
| SMS booking confirmation to caller | Any business | Low (Twilio SMS) |
| Multiple staff / locations | Larger businesses | High |
| White-label (their own brand, no Voxzenn mention) | Agencies reselling your product | High — charge $200+/month |
| Analytics export (CSV) | Any business owner | Low |
| Voicemail-to-email transcription | Any business | Low |

---

## Priority Summary

| Phase | Item | Time to build |
|---|---|---|
| **Demo now** | Deploy (Vercel + VPS) | 1-2 hours |
| **Demo now** | AI disclosure in greeting | 15 min |
| **Demo now** | Demo business setup | 30 min |
| **Demo now** | Settings page | 3-4 hours |
| **Demo now** | After-hours handling | 1 hour |
| **Demo now** | CORS + secrets for prod | 15 min |
| **Before payment** | Privacy Policy + Terms | 30 min |
| **Before payment** | Transfer to human | 2 hours |
| **Before payment** | Fallback for unknown questions | 30 min |
| **Before payment** | Rate limiting | 1 hour |
| **Before payment** | DB backups | 30 min |
| **5+ clients** | Twilio real phone number | 1-2 days |
| **5+ clients** | Email notifications | 2-3 hours |
| **5+ clients** | Dashboard subpages | 1 day |
| **Later** | Multilingual | 1-2 days |
| **Later** | Calendar integrations | 3-5 days |
| **Later** | White-label tier | 1 week |
