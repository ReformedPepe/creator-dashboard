# Statflow — Podsumowanie Projektu

## Cel projektu
Osobisty dashboard do śledzenia wyświetleń 3 ostatnich filmów z wielu kanałów YouTube i TikTok. Backend zbiera dane automatycznie co godzinę (YouTube) / 6 godzin (TikTok), niezależnie od tego czy przeglądarka jest otwarta.

## Tech Stack
- **Frontend:** React 19 (Vite 8) + JavaScript
- **Backend:** Node.js + Express + better-sqlite3 + node-cron
- **Stylizacja:** Tailwind CSS v4 (dark-only, CSS custom properties)
- **Ikony:** Lucide React
- **HTTP:** axios
- **Dane:** SQLite (backend, źródło prawdy), localStorage (sparkline history, klucze API cache)
- **API:** YouTube Data API v3, RapidAPI "Tiktok Scraper" (tiktok-scraper7.p.rapidapi.com)

## Design System (Attio/Linear style)
- **Ciemny motyw jako jedyny** — brak light mode
- Tło: #0A0A0A z kropkowanym pattern (radial-gradient)
- Sidebar: #111111, border #1E1E1E
- Karty: #111111, border #1E1E1E, radius 12px, zero box-shadow
- Karty filmów: #0F0F0F, border #1A1A1A, miniaturka po lewej (120px)
- Kolor akcentu: czerwony #E53935 (przyciski, aktywne elementy, sparkline wzrost)
- Typografia: Inter, labele text-xs tracking-widest uppercase text-zinc-600
- Sidebar zwijany: 64px (ikony w kontenerach 36×36px) / 240px (ikony + tekst)
- Kontener ikon: tło #1C1C1C, border #2A2A2A, aktywny: tło #E53935
- Nazwa aplikacji: **Statflow**
- Polski język w UI

## Architektura

### Frontend (React)
- **App.jsx** — główny komponent, trzyma `videosMap` (dane filmów) w stanie, top-down data flow
- **Pobieranie danych:** App.jsx fetchuje dane z backendu i przekazuje jako props do ChannelCard
- **Auto-refresh:** setInterval co 2 minuty w App.jsx (cichy, bez spinnera)
- **Ręczne odświeżanie:** klik "Odśwież" → czyści videosMap (spinner) → POST /api/refresh → 2s delay → fetch świeżych danych → aktualizacja widoku
- **Backend jako jedyne źródło prawdy** — brak fallbacku do localStorage, ekran błędu gdy backend niedostępny

### Backend (Node.js + Express)
- **Folder:** `/server`
- **Baza:** SQLite (server/data/dashboard.db) — tabele: channels, videos (z like_count, comment_count), snapshots
- **Cron joby:** YouTube co godzinę (0 * * * *), TikTok co 6h (0 */6 * * *)
- **Opóźniony start:** pierwsza kolekcja 5s po starcie serwera (czeka na sync kluczy z frontendu)
- **API klucze:** persystowane w server/.env (POST /api/settings zapisuje do pliku)
- **TikTok:** RapidAPI (nie cheerio scraping)

## Zrealizowane funkcjonalności (Status: ✅)

### 1. Backend — zbieranie danych
- Node.js + Express + better-sqlite3 + node-cron
- Dwa osobne cron joby: YouTube co 1h, TikTok co 6h
- Natychmiastowa kolekcja przy starcie (z 5s opóźnieniem na sync kluczy)
- Niezależne przetwarzanie kanałów (błąd jednego nie blokuje innych)
- Logi do konsoli przy każdym snapshot
- REST API: GET/POST/DELETE /api/channels, GET /api/channels/:id/videos, POST /api/refresh, GET /api/health, POST /api/settings, GET /api/settings/status

### 2. Integracja YouTube (backend)
- YouTube Data API v3 z kluczem z server/.env
- Rozwiązywanie @handle na Channel ID
- Pobieranie 3 ostatnich filmów z viewCount, likeCount, commentCount
- Snapshoty zapisywane w SQLite przy każdej kolekcji

### 3. Integracja TikTok (backend)
- RapidAPI "Tiktok Scraper" (tiktok-scraper7.p.rapidapi.com)
- Endpoint: GET /user/posts?unique_id=USERNAME&count=3
- Mapowanie: play_count → view_count, digg_count → like_count, comment_count
- Kolekcja co 6 godzin (oszczędność limitu API)

### 4. Synchronizacja frontend ↔ backend
- useBackend.js — health check, migracja kanałów z localStorage, sync kluczy API
- Migracja kanałów: porównuje po identifier, migruje tylko brakujące (nie tylko gdy backend pusty)
- Sync kluczy: sprawdza GET /api/settings/status — wysyła klucze tylko gdy backend ich nie ma
- Klucze persystowane w server/.env (przeżywają restart serwera)

### 5. Nowy design (Attio/Linear style)
- Sidebar zwijany z ikonami w kontenerach (PanelLeft/PanelRight toggle)
- Nawigacja: Dashboard, Kanały, Ustawienia (osobne widoki)
- Topbar: tytuł + przyciski akcji (Odśwież, Dodaj kanał)
- Karty kanałów: ciemne, minimalistyczne, bez box-shadow
- Karty filmów: miniaturka po lewej (120px), metryki po prawej
- Badge % zmiany: tło rgba(229,57,53,0.1) dla wzrostu, rgba(100,116,139,0.1) dla spadku
- Strona ustawień (nie modal) — klucze API + placeholder konta
- Loading spinner podczas odświeżania (kręcące się kółko zamiast filmów)
- Ekran błędu gdy backend niedostępny (WifiOff + "Spróbuj ponownie")

### 6. Sparkline — wykresy trendu wyświetleń
- Pure SVG (bez biblioteki chartingowej)
- Wykres liniowy pod każdym filmem
- Kolor wzrostu: #E53935 (czerwony akcent), spadek: #64748B, neutralny: #333
- Przełącznik zakresu: 1h / 12h / 24h / Wszystko
- Badge procentowy z kolorowym tłem
- Snapshoty z localStorage (useViewHistory hook)

### 7. Zarządzanie kanałami
- Dodawanie/usuwanie kanałów przez modal (ChannelManager)
- Obsługa: username, @handle, pełne URL-e
- Dane kanałów w SQLite (backend)
- Migracja z localStorage przy pierwszym połączeniu z backendem

### 8. Odświeżanie danych
- Przycisk "Odśwież" → POST /api/refresh (tylko YouTube) → spinner → świeże dane
- Auto-refresh co 2 minuty (cichy, bez spinnera)
- TikTok odświeża się tylko automatycznie co 6h przez cron

## Architektura plików

```
src/
├── App.jsx                    — główny komponent, videosMap state, fetchAllVideos, top-down data flow
├── main.jsx                   — entry point, cleanupSeedPoints
├── index.css                  — dark-only design system, dotted-bg pattern
├── components/
│   ├── Sidebar.jsx            — zwijany sidebar (64px/240px), nawigacja, logo
│   ├── Topbar.jsx             — tytuł strony + przyciski akcji
│   ├── ChannelCard.jsx        — karta kanału (prezentacyjna, videos jako prop)
│   ├── ChannelManager.jsx     — modal dodawania/edycji kanałów
│   ├── VideoCard.jsx          — karta filmu (miniaturka po lewej, metryki po prawej)
│   ├── SparklineChart.jsx     — pure SVG sparkline
│   ├── SettingsPage.jsx       — strona ustawień (klucze API + konto placeholder)
│   ├── EmptyState.jsx         — widok gdy brak kanałów
│   ├── ErrorBanner.jsx        — banner błędów
│   └── LoadingSkeleton.jsx    — skeleton loading
├── hooks/
│   ├── useBackend.js          — komunikacja z backendem, health check, migracja, sync kluczy
│   ├── useChannelData.js      — (legacy, nieużywany przez ChannelCard)
│   ├── useViewHistory.js      — ładowanie historii wyświetleń + trend (localStorage)
│   └── useApiUsage.js         — reaktywny stan licznika API
├── test/
│   └── setup.js               — @testing-library/jest-dom setup
└── utils/
    ├── youtube.js             — YouTube Data API v3 client (frontend, legacy)
    ├── tiktok.js              — TikTok RapidAPI client (frontend, legacy)
    ├── viewHistory.js         — History Store (snapshoty w localStorage, max 50/film)
    ├── trendCalculator.js     — obliczanie trendu (up/down/neutral, % change)
    ├── apiKeys.js             — Key Resolution Service (localStorage > .env)
    ├── apiTracker.js          — śledzenie zużycia API TikTok
    ├── rateLimiter.js         — TikTok 6h cooldown (legacy, frontend-only)
    ├── storage.js             — localStorage helpers
    └── formatters.js          — formatowanie liczb, dat, czasu, procentów

server/
├── index.js                   — Express app, middleware, cron scheduling, delayed start
├── package.json               — dependencies (better-sqlite3, axios, cheerio, cors, dotenv, express, node-cron)
├── .env                       — YOUTUBE_API_KEY, TIKTOK_RAPIDAPI_KEY, PORT
├── data/
│   └── dashboard.db           — SQLite database (gitignored)
├── db/
│   └── index.js               — better-sqlite3 init, schema, WAL mode, migrations
├── routes/
│   ├── channels.js            — GET/POST/DELETE /api/channels
│   ├── videos.js              — GET /api/channels/:id/videos
│   ├── refresh.js             — POST /api/refresh (z filtrem type), GET /api/health
│   └── settings.js            — POST /api/settings, GET /api/settings/status
├── services/
│   ├── youtube.js             — YouTube Data API v3 (viewCount, likeCount, commentCount)
│   ├── tiktok.js              — TikTok RapidAPI (play_count, digg_count, comment_count)
│   └── settings.js            — in-memory + .env persistence dla kluczy API
└── cron/
    └── collector.js           — collectAll, collectYouTube, collectTikTok, per-channel isolation
```

## Testy
- **Framework:** Vitest + fast-check + @testing-library/react
- **Pokrycie:** 83+ testów (formatters, trendCalculator, viewHistory, SparklineChart)
- **Uruchomienie:** `npm test`

## Deployment
- **Repozytorium:** https://github.com/ReformedPepe/creator-dashboard
- **Backend:** Render.com (https://creator-dashboard-jztf.onrender.com)
- **Frontend:** lokalnie (npm run dev) — docelowo Vercel
- **Monitoring:** UptimeRobot pinguje backend co 5 minut (zapobiega uśpieniu free tier Rendera)

## Co dalej (następne kroki)
1. **Supabase** — rejestracja/logowanie (email+hasło, Google, GitHub), każdy użytkownik ma swoje kanały i klucze API, dane przeżywają restarty Rendera
2. **Deploy frontendu na Vercel** — produkcyjny hosting z custom domeną
3. **Liczniki odliczające** — do następnego odświeżenia YouTube (1h) i TikTok (6h)
4. **Paginacja filmów** — więcej niż 3 filmy na kanał
5. Porównanie kanałów — podsumowanie na górze (łączne views, najlepszy film)
6. Sortowanie i filtrowanie filmów
7. Powiadomienia o milestones (10k, 100k, 1M)
8. Eksport danych (CSV/JSON)
