# Statflow — Podsumowanie Projektu

## Cel projektu
Osobisty dashboard do śledzenia wyświetleń 3 ostatnich filmów z wielu kanałów YouTube i TikTok. Backend zbiera dane automatycznie co godzinę (YouTube) / 6 godzin (TikTok), niezależnie od tego czy przeglądarka jest otwarta. Każdy użytkownik ma swoje kanały i klucze API — dane przeżywają restarty serwera i zmianę urządzenia.

## Tech Stack
- **Frontend:** React 19 (Vite 8) + JavaScript
- **Backend:** Node.js + Express + node-cron + @supabase/supabase-js
- **Baza danych:** Supabase (PostgreSQL) — tabele: channels, videos, snapshots, api_keys, user_activity
- **Auth:** Supabase Auth (email+hasło), JWT weryfikacja na backendzie
- **Stylizacja:** Tailwind CSS v4 (dark-only, CSS custom properties, breakpoint xs: 480px, md: 768px)
- **Ikony:** Lucide React
- **HTTP:** axios
- **Drag & Drop:** @dnd-kit/core + @dnd-kit/sortable
- **Dane lokalne:** localStorage (sparkline history cache, kolejność kanałów, stan zwinięcia)
- **API:** YouTube Data API v3, RapidAPI "Tiktok Scraper" (tiktok-scraper7.p.rapidapi.com)

## Design System (Kit/Automation style)
- **Ciemny motyw jako jedyny** — brak light mode
- Tło: #0A0A0A z kropkowanym pattern (radial-gradient)
- Sidebar: #0D0D0D, border #1A1A1A, aktywny element: czerwona pionowa kreska 3px po lewej
- Karty: #111111, border #1E1E1E, radius 12px, zero box-shadow
- Karty filmów: #0F0F0F, border #1A1A1A, miniaturka po lewej (80px mobile / 120px desktop)
- Kolor akcentu: czerwony #E53935 (przyciski, aktywne elementy, sparkline wzrost)
- Typografia: Inter, labele text-xs tracking-widest uppercase text-[#52525B]
- Sidebar zwijany: 64px (ikony wycentrowane) / 224px (ikony + tekst), ikony nie zmieniają pozycji przy animacji
- Nazwa aplikacji: **Statflow**
- Polski język w UI
- **Responsywność:** mobile-first, breakpoint md (768px), xs (480px)

## Architektura

### Frontend (React)
- **App.jsx** — główny komponent, trzyma `videosMap` (dane filmów) w stanie, top-down data flow, mobileSidebarOpen state
- **Auth guard:** useAuth hook → gdy loading: spinner, gdy !user: LandingPage, gdy user: dashboard
- **Pobieranie danych:** App.jsx fetchuje dane z backendu z Bearer tokenem i przekazuje jako props
- **Auto-refresh:** setInterval co 2 minuty w App.jsx (cichy, bez spinnera)
- **Ręczne odświeżanie:** klik "Odśwież" → POST /api/refresh (per-user) → spinner → świeże dane
- **Backend jako jedyne źródło prawdy** — brak fallbacku do localStorage, ekran błędu gdy backend niedostępny

### Backend (Node.js + Express)
- **Folder:** `/server`
- **Baza:** Supabase (PostgreSQL) — tabele: channels, videos, snapshots, api_keys, user_activity
- **Auth middleware:** weryfikuje JWT przez supabase.auth.getUser(token), dodaje req.user, aktualizuje last_seen_at
- **Cron joby:** YouTube co godzinę (0 * * * *), TikTok co 6h (0 */6 * * *)
- **Aktywni użytkownicy:** cron zbiera dane tylko dla użytkowników aktywnych w ostatnich 7 dniach
- **Opóźniony start:** pierwsza kolekcja 5s po starcie serwera
- **API klucze:** per-user w tabeli api_keys (Supabase), zamaskowane w odpowiedzi GET /api/settings/status
- **TikTok:** RapidAPI (nie cheerio scraping)

## Zrealizowane funkcjonalności (Status: ✅)

### 1. Supabase — auth i baza danych
- Rejestracja i logowanie email+hasło (Supabase Auth)
- Tabele: channels, videos, snapshots, api_keys, user_activity
- RLS włączone na wszystkich tabelach
- Backend używa service role key (SUPABASE_SECRET_KEY)
- Frontend używa publishable key (VITE_SUPABASE_PUBLISHABLE_KEY)
- Klient Supabase: src/lib/supabase.js (frontend), server/lib/supabase.js (backend)

### 2. Autoryzacja i sesje
- server/middleware/auth.js — weryfikuje JWT token z nagłówka Authorization: Bearer <token>
- Po weryfikacji: req.user = user, aktualizacja last_seen_at w user_activity (fire-and-forget)
- Frontend: useAuth hook (user, loading, signIn, signUp, signOut) + onAuthStateChange listener
- useBackend(user) — fetchuje kanały dopiero gdy backend dostępny AND user zalogowany
- Każdy request do backendu zawiera Bearer token (getAuthHeaders helper)

### 3. Backend — zbieranie danych (per-user)
- Node.js + Express + node-cron + @supabase/supabase-js
- Dwa osobne cron joby: YouTube co 1h, TikTok co 6h
- collector.js pobiera distinct user_id z channels, filtruje po user_activity (aktywni 7 dni)
- Dla każdego użytkownika: pobiera jego kanały i klucze z api_keys, zbiera dane osobno
- Pomija nieaktywnych: "[cron] Skipping inactive user {id}"
- POST /api/refresh — odświeża tylko kanały zalogowanego użytkownika (collectForUser)
- Cleanup: po kolekcji usuwa filmy spoza aktualnej trójki (stare filmy + ich snapshoty)
- Statystyki kanału: subscriber_count, total_view_count, video_count, follower_count

### 4. Integracja YouTube (backend)
- YouTube Data API v3 z kluczem per-user z tabeli api_keys
- Rozwiązywanie @handle na Channel ID
- Pobieranie 3 ostatnich filmów z viewCount, likeCount, commentCount
- Pobieranie statystyk kanału: subscriberCount, viewCount, videoCount
- Snapshoty zapisywane w Supabase (timestamp jako ISO 8601)

### 5. Integracja TikTok (backend)
- RapidAPI "Tiktok Scraper" (tiktok-scraper7.p.rapidapi.com)
- Endpoint: GET /user/posts?unique_id=USERNAME&count=3
- Endpoint: GET /user/info?unique_id=USERNAME (statystyki kanału)
- Mapowanie: play_count → view_count, digg_count → like_count, comment_count
- Statystyki: followerCount, heartCount
- Kolekcja co 6 godzin (oszczędność limitu API)

### 6. Strony logowania (LandingPage + AuthPage)
- LandingPage: nazwa "Statflow", opis, przycisk "Zaloguj się"
- AuthPage: dwa tryby (login/register), pola email+hasło, obsługa błędów, spinner
- Tłumaczenie błędów Supabase na polski
- Styl zgodny z design systemem (ciemne tło, akcent #E53935)

### 7. Nowy design (Kit/Automation style)
- Sidebar zwijany z ikonami bez kontenerów, czerwona pionowa kreska na aktywnym elemencie
- Ikony zawsze w tym samym miejscu (stały padding-left, animacja tylko na width)
- Nawigacja: Dashboard, Kanały, Ustawienia (osobne widoki)
- Topbar: tytuł + przyciski akcji, renderowany raz (poza warunkami widoków), stała wysokość h-[30px]
- Tooltip na "Odśwież": "Odświeża dane YouTube. TikTok aktualizuje się automatycznie co 6 godzin."
- Karty kanałów: ciemne, minimalistyczne, zwijalne
- Karty filmów: miniaturka po lewej (80px mobile / 120px desktop), metryki po prawej
- Badge % zmiany: tło rgba(229,57,53,0.1) dla wzrostu, rgba(100,116,139,0.1) dla spadku, rgba(85,85,85,0.1) dla 0%
- Strona ustawień — identyczny layout jak Dashboard (te same klasy, marginesy, paddingi)
- Loading spinner podczas odświeżania
- Ekran błędu gdy backend niedostępny (WifiOff + "Spróbuj ponownie")
- User info + logout w sidebarze

### 8. Sparkline — wykresy trendu wyświetleń
- Pure SVG (bez biblioteki chartingowej)
- Wykres liniowy pod każdym filmem
- Kolor wzrostu: #E53935 (czerwony akcent), spadek: #64748B, neutralny: #333
- Przełącznik zakresu: 1h / 12h / 24h / Wszystko (scrollowalny na mobile)
- Badge procentowy wyśrodkowany pionowo, wykres nie nachodzi na badge (pr-[68px])
- Dane z backendu (_backendSnapshots) jako priorytet, localStorage jako fallback

### 9. Zarządzanie kanałami
- Dodawanie/usuwanie kanałów przez modal (ChannelManager)
- Obsługa: username, @handle, pełne URL-e
- Dane kanałów w Supabase z user_id (izolacja per użytkownik)
- Komunikat "Dodaj klucz API w Ustawieniach" gdy brak klucza (z linkiem do Settings)
- Modal na mobile: bottom sheet (przyklejony do dołu, zaokrąglone górne rogi, animacja slide-up)

### 10. Funkcjonalności kart kanałów
- **Zwijanie:** przycisk ChevronDown/Up, animacja maxHeight+opacity, stan w localStorage (statflow-collapsed-{id})
- **Przeciąganie:** @dnd-kit/core + @dnd-kit/sortable, GripVertical handle (widoczny na hover), kolejność w localStorage per grupa (youtube/tiktok), klucze: statflow-channels-order-youtube, statflow-channels-order-tiktok
- **Statystyki kanału:** YouTube: subskrybenci, wyświetlenia, filmy. TikTok: obserwujący, polubienia. Formatowane przez formatViewCount. Wyświetlane pod identyfikatorem kanału w nagłówku karty.

### 11. Ustawienia — klucze API
- Zamaskowane klucze z backendu (pierwsze 4 + •••••••• + ostatnie 4)
- Klik w pole → czyści wartość, tryb edycji
- Po zapisaniu → odświeżenie zamaskowanej wartości
- Poradnik "Jak uzyskać klucz" pod każdym polem (rozwijany <details>)
- YouTube: link do console.cloud.google.com, 5 kroków
- TikTok: link do rapidapi.com, 4 kroki
- Sekcja "Konto": email użytkownika + przycisk "Wyloguj"

### 12. Odświeżanie danych
- Przycisk "Odśwież" → POST /api/refresh (per-user, tylko YouTube) → spinner → świeże dane
- Auto-refresh co 2 minuty (cichy, bez spinnera)
- TikTok odświeża się tylko automatycznie co 6h przez cron
- Tooltip wyjaśniający zachowanie (hover na przycisku)

### 13. Responsywność mobile (breakpoint: 768px)
- **Sidebar na mobile:** domyślnie ukryty (translateX(-100%)), wysuwa się z lewej z animacją 300ms ease
- **Hamburger:** przycisk Menu (Lucide) w lewym górnym rogu Topbar, widoczny tylko na mobile (md:hidden)
- **Overlay:** półprzezroczyste ciemne tło (bg-black/60) po otwarciu sidebara, klik zamyka sidebar
- **Sidebar mobile:** zawsze pełna wersja (240px, ikony + tekst), brak trybu zwiniętego
- **Auto-zamykanie:** klik w link nawigacyjny zamyka sidebar, Escape zamyka sidebar
- **Body scroll lock:** gdy sidebar otwarty, body overflow: hidden
- **Topbar mobile:** hamburger po lewej, tytuł obok, przyciski akcji po prawej
- **Przyciski <480px (xs):** "Odśwież" i "Dodaj kanał" pokazują tylko ikony (tekst hidden, widoczny od xs:inline)
- **Karty kanałów:** pełna szerokość, mniejszy padding (p-3.5 mobile / p-5 desktop)
- **Miniaturka filmów:** 80px na mobile, 120px na desktop
- **Przełącznik zakresu:** overflow-x-auto (scrollowalny poziomo na wąskich ekranach)
- **Legend + time range:** kolumna na mobile (flex-col), wiersz na desktop (sm:flex-row)
- **Modal dodawania kanału:** bottom sheet na mobile (items-end, rounded-t-[20px], animacja slide-up z dołu, max-h-[90vh] overflow-y-auto)
- **Inputy:** font-size 16px na mobile (zapobiega zoom na iOS)
- **Main content:** ml-0 na mobile (brak marginesu na sidebar), p-4 mobile / p-6 desktop
- **Brak poziomego scrolla:** overflow-x-hidden na root div
- **Desktop:** sidebar działa jak dotychczas (zwijany 64px/224px, przycisk "Zwiń panel")

## Architektura plików

```
src/
├── App.jsx                    — główny komponent, auth guard, videosMap, mobileSidebarOpen, fetchAllVideos
├── main.jsx                   — entry point
├── index.css                  — dark-only design system, dotted-bg, slide-up animation, xs breakpoint, iOS input fix
├── lib/
│   └── supabase.js            — klient Supabase (frontend, publishable key)
├── components/
│   ├── Sidebar.jsx            — zwijany desktop (64px/224px) + drawer mobile (240px, overlay, slide)
│   ├── Topbar.jsx             — tytuł + hamburger (mobile) + przyciski + tooltip, h-[30px] stała wysokość
│   ├── ChannelCard.jsx        — karta kanału (zwijalna, statystyki, drag handle, responsive padding)
│   ├── SortableChannelList.jsx — drag-and-drop wrapper (dnd-kit), kolejność w localStorage
│   ├── ChannelManager.jsx     — modal dodawania/edycji (centered desktop, bottom sheet mobile)
│   ├── VideoCard.jsx          — karta filmu (miniaturka 80/120px, metryki, sparkline z backendu)
│   ├── SparklineChart.jsx     — pure SVG sparkline z tooltipem
│   ├── AuthPage.jsx           — formularz login/register
│   ├── LandingPage.jsx        — strona powitalna dla niezalogowanych
│   ├── SettingsPage.jsx       — klucze API (zamaskowane) + konto + poradniki, responsive padding
│   ├── EmptyState.jsx         — widok gdy brak kanałów
│   ├── ErrorBanner.jsx        — banner błędów
│   └── LoadingSkeleton.jsx    — skeleton loading
├── hooks/
│   ├── useAuth.js             — sesja Supabase (user, loading, signIn, signUp, signOut)
│   ├── useBackend.js          — komunikacja z backendem, Bearer token, fetchChannels po zalogowaniu
│   ├── useViewHistory.js      — ładowanie historii wyświetleń + trend (localStorage fallback)
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
├── index.js                   — Express app, cors, auth middleware na /api/*, cron scheduling, /api/health (public)
├── package.json               — dependencies (@supabase/supabase-js, axios, cors, dotenv, express, node-cron)
├── .env                       — YOUTUBE_API_KEY, TIKTOK_RAPIDAPI_KEY, SUPABASE_URL, SUPABASE_SECRET_KEY, PORT
├── lib/
│   └── supabase.js            — klient Supabase (backend, service role key)
├── middleware/
│   └── auth.js                — requireAuth: weryfikacja JWT, req.user, aktualizacja last_seen_at
├── routes/
│   ├── channels.js            — GET/POST/DELETE /api/channels (Supabase, filtrowane po user_id)
│   ├── videos.js              — GET /api/channels/:id/videos (Supabase, weryfikacja ownership)
│   ├── refresh.js             — POST /api/refresh (collectForUser — per-user)
│   └── settings.js            — POST /api/settings (upsert api_keys), GET /api/settings/status (zamaskowane klucze)
├── services/
│   ├── youtube.js             — fetchYouTubeVideos + fetchYouTubeChannelStats
│   └── tiktok.js              — fetchTikTokVideos + fetchTikTokChannelStats
└── cron/
    └── collector.js           — collectAll (per-user, aktywni 7 dni), collectForUser, cleanup starych filmów, stats update
```

## Zmienne środowiskowe

### Frontend (.env w root)
```
VITE_SUPABASE_URL=https://xxxxxxxxxx.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIs...
VITE_API_URL=http://localhost:3001
```

### Backend (server/.env)
```
SUPABASE_URL=https://xxxxxxxxxx.supabase.co
SUPABASE_SECRET_KEY=eyJhbGciOiJIUzI1NiIs... (service role key)
PORT=3001
```
> Uwaga: klucze YouTube i TikTok są per-user w tabeli api_keys (Supabase), nie w .env.

## Baza danych (Supabase)

### Tabele
- **channels** — id, user_id (FK → auth.users), type, name, identifier, subscriber_count, total_view_count, video_count, follower_count, created_at
- **videos** — id, channel_id (FK → channels), video_id, title, thumbnail, published_at, updated_at, like_count, comment_count. Unique: (channel_id, video_id)
- **snapshots** — id, video_id (FK → videos), view_count, timestamp (TIMESTAMPTZ)
- **api_keys** — user_id (PK, FK → auth.users), youtube_api_key, tiktok_rapidapi_key, updated_at. Unique: user_id
- **user_activity** — user_id (PK, FK → auth.users), last_seen_at (TIMESTAMPTZ)

## Testy
- **Framework:** Vitest + fast-check + @testing-library/react
- **Pokrycie:** 83+ testów (formatters, trendCalculator, viewHistory, SparklineChart)
- **Uruchomienie:** `npm test`

## Deployment
- **Repozytorium:** https://github.com/ReformedPepe/creator-dashboard
- **Backend:** Render.com (https://creator-dashboard-jztf.onrender.com) — zmienne: SUPABASE_URL, SUPABASE_SECRET_KEY, PORT
- **Frontend:** lokalnie (npm run dev) — docelowo Vercel
- **Monitoring:** UptimeRobot pinguje backend co 5 minut (zapobiega uśpieniu free tier Rendera)

## Co dalej (następne kroki)
1. **Deploy frontendu na Vercel** — produkcyjny hosting z custom domeną
2. **Liczniki odliczające** — do następnego odświeżenia YouTube (1h) i TikTok (6h)
3. **Paginacja filmów** — przewijanie w prawo → starsze filmy
4. **Google i GitHub login** — dodatkowe metody logowania przez Supabase Auth
5. Porównanie kanałów — podsumowanie na górze (łączne views, najlepszy film)
6. Sortowanie i filtrowanie filmów
7. Powiadomienia o milestones (10k, 100k, 1M)
8. Eksport danych (CSV/JSON)
9. PWA — instalacja na telefonie, push notifications
10. Tryb offline — cache danych w Service Worker
