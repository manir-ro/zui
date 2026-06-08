# Wander — AI Travel Planner

## Original Problem Statement
Build an AI travel planner that plans day-to-day itineraries. User selects preferences (place, number of days, budget, traveler type like family/friends, etc.) and gets a plan of places to visit and hotels for each day with images and Google Maps location links. Users should be able to store their trip plans and upload trip photos.

## User Choices
- AI model: **Claude Sonnet 4.5** (`claude-sonnet-4-5-20250929`) via Emergent Universal LLM Key
- Place/hotel images: **Stock images** via Unsplash source URLs (`source.unsplash.com/?{query}`)
- Authentication: **JWT email/password** login
- Photo storage: **Emergent Object Storage** (persistent cloud)
- Maps: **Simple Google Maps redirect** URLs (no key required)

## Architecture
- **Backend**: FastAPI (`/app/backend/server.py`) + MongoDB (Motor) + emergentintegrations
  - Routes: `/api/auth/{signup,login,me}`, `/api/trips/{generate,/,/{id}}`, `/api/trips/{id}/photos`, `/api/photos/{id}/{download,/}`
  - Auth: bcrypt + PyJWT with `JWT_SECRET`
  - Storage: `init_storage()` boot-time init; uploads at `travelplanner/trips/{user_id}/{trip_id}/{photo_id}.{ext}`
- **Frontend**: React 19 + react-router 7 + Shadcn UI + Tailwind, Outfit + Manrope fonts
  - Pages: `Landing`, `Login`, `Signup`, `Dashboard`, `PlanTrip`, `TripDetail`
  - Design: Light theme, Organic & Earthy archetype (#E27D60 terracotta + #81B29A sage on #F7F5F0)
- **Database**: MongoDB collections: `users`, `trips`, `photos` (all use `id` UUID strings; `_id` projected out)

## Core Requirements (Static)
1. AI-generated multi-day itineraries scoped by destination/days/budget/travelers/interests
2. Each day contains 3-4 places (with time-of-day) + 1 hotel, all with images & maps links
3. Per-user authentication and trip storage
4. Photo gallery per trip with cloud storage
5. Google Maps redirect from every place/hotel card

## User Personas
- **Solo / Couple / Family / Friends** travelers planning leisure or vacation trips wanting an instant, customised plan + place to keep memories.

## What's Been Implemented (2026-02-08)
- ✅ JWT email/password auth (signup/login/me) with bcrypt + 30-day tokens
- ✅ AI itinerary generation via Claude Sonnet 4.5 (Anthropic) — JSON-strict prompt
- ✅ Trip CRUD: create (via AI), list, get, delete (with photo cascade soft-delete)
- ✅ Photo upload (multipart) to Emergent Object Storage + DB record
- ✅ Photo list/download/delete — download supports header & `?auth=` query
- ✅ Landing page with hero, feature bento grid
- ✅ Auth pages (Login/Signup) with toast feedback
- ✅ Dashboard with trip cards (image, badges, delete dialog)
- ✅ Plan Trip form (destination, days, budget, travelers, interest pills)
- ✅ Trip detail with day-by-day bento itinerary, place + hotel cards, Maps buttons, photo gallery upload
- ✅ Protected routes & redirect-if-logged-in routes
- ✅ Backend tested: 26/26 pytest tests passing (auth, AI, CRUD, photos, isolation)

## Backlog (P0/P1/P2)
- **P1**: Trip share link (public read-only URL with shortened token)
- **P1**: Allow user to edit/regenerate a single day
- **P1**: Add daily budget estimates from AI
- **P2**: Drag-and-drop reorder of places within a day
- **P2**: Export itinerary as PDF
- **P2**: Multi-photo upload progress bar + EXIF date grouping
- **P2**: Activity tags filter on dashboard
- **P2**: Email itinerary to traveler

## Next Action Items
- Validate frontend end-to-end with a real user signup → plan trip → upload photo flow
- Consider Stripe paywall for >3 generated trips/month (revenue lever)
