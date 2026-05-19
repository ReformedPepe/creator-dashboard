# Requirements Document

## Introduction

Rozszerzenie dashboardu o trzy powiązane ulepszenia metryk: (1) badge procentowej zmiany obok sparkline, (2) statystyki kanału (subskrybenci/obserwujący + łączne wyświetlenia) w nagłówku karty kanału, (3) liczba polubień i komentarzy na kartach filmów. Celem jest dostarczenie twórcom pełniejszego obrazu kondycji kanału i poszczególnych filmów bez konieczności opuszczania dashboardu.

## Glossary

- **Percent_Change_Badge**: Mały element tekstowy (np. "+12%" / "-3%") wyświetlany obok Sparkline_Chart, informujący o procentowej zmianie wyświetleń między najstarszym a najnowszym Data_Point w serii
- **Channel_Stats_Section**: Sekcja w nagłówku ChannelCard wyświetlająca statystyki kanału: liczbę subskrybentów/obserwujących oraz łączną liczbę wyświetleń kanału
- **ChannelCard**: Komponent React wyświetlający kartę kanału z nagłówkiem (ikona platformy, nazwa, identyfikator) i siatką filmów
- **VideoCard**: Komponent React wyświetlający kartę pojedynczego filmu z miniaturą, tytułem, statystykami i sparkline
- **Sparkline_Chart**: Mały wykres liniowy wizualizujący trend wyświetleń w czasie, renderowany pod statystykami filmu
- **Subscriber_Count**: Liczba subskrybentów kanału YouTube (pole `subscriberCount` z YouTube Data API v3 channels endpoint)
- **Follower_Count**: Liczba obserwujących profilu TikTok (pole `follower_count` z TikTok Scraper API user/info endpoint)
- **Total_View_Count**: Łączna liczba wyświetleń kanału YouTube (pole `viewCount` z YouTube channels statistics) lub łączna liczba polubień profilu TikTok (pole `heart_count` z TikTok user/info)
- **Like_Count**: Liczba polubień filmu — YouTube: pole `likeCount` ze statistics, TikTok: pole `digg_count`
- **Comment_Count**: Liczba komentarzy filmu — YouTube: pole `commentCount` ze statistics, TikTok: pole `comment_count`
- **Data_Point**: Pojedynczy punkt danych w View_History — para: timestamp (Unix ms) + viewCount
- **formatViewCount**: Istniejąca funkcja w formatters.js formatująca liczby (1234 → "1,2K", 1234567 → "1,2M")

## Requirements

### Requirement 1: Badge procentowej zmiany obok sparkline

**User Story:** Jako twórca treści, chcę widzieć liczbowy wskaźnik procentowej zmiany obok sparkline, abym mógł od razu odczytać dokładną wartość trendu bez najeżdżania kursorem na wykres.

#### Acceptance Criteria

1. WHEN View_History dla danego filmu zawiera 2 lub więcej Data_Points, THE Percent_Change_Badge SHALL wyświetlić się po prawej stronie Sparkline_Chart w tym samym wierszu co wykres
2. THE Percent_Change_Badge SHALL wyświetlać wartość procentowej zmiany sformatowaną jako: znak "+" dla wartości dodatnich, znak "-" dla wartości ujemnych, wartość zaokrąglona do jednego miejsca po przecinku (z przecinkiem jako separatorem dziesiętnym) oraz symbol "%", np. "+12,3%" lub "-3,1%"
3. WHEN procentowa zmiana wynosi dokładnie 0 lub jest w zakresie od -1% do +1% (wyłącznie), THE Percent_Change_Badge SHALL wyświetlić "0%" bez znaku plus ani minus
4. WHEN procentowa zmiana jest dodatnia (>= 1%), THE Percent_Change_Badge SHALL stosować kolor tekstu zielony (CSS variable --color-trend-up)
5. WHEN procentowa zmiana jest ujemna (<= -1%), THE Percent_Change_Badge SHALL stosować kolor tekstu czerwony (CSS variable --color-trend-down)
6. WHEN procentowa zmiana jest neutralna (między -1% a +1%), THE Percent_Change_Badge SHALL stosować kolor tekstu szary (CSS variable --color-trend-neutral)
7. WHEN View_History dla danego filmu zawiera mniej niż 2 Data_Points, THE VideoCard SHALL nie wyświetlać Percent_Change_Badge
8. THE Percent_Change_Badge SHALL stosować rozmiar czcionki 11px i wagę font-semibold

### Requirement 2: Statystyki kanału w nagłówku ChannelCard

**User Story:** Jako twórca treści, chcę widzieć liczbę subskrybentów i łączne wyświetlenia kanału w nagłówku karty, abym miał szybki podgląd kondycji kanału bez wchodzenia na platformę.

#### Acceptance Criteria

1. WHEN dane kanału YouTube zostają pobrane, THE Channel_Stats_Section SHALL wyświetlić Subscriber_Count i Total_View_Count pod nazwą kanału w nagłówku ChannelCard
2. WHEN dane kanału TikTok zostają pobrane, THE Channel_Stats_Section SHALL wyświetlić Follower_Count i Total_View_Count (heart_count) pod nazwą kanału w nagłówku ChannelCard
3. THE Channel_Stats_Section SHALL formatować wartości liczbowe przy użyciu istniejącej funkcji formatViewCount (np. 1500 → "1,5K", 2300000 → "2,3M")
4. THE Channel_Stats_Section SHALL wyświetlać Subscriber_Count/Follower_Count z ikoną Users z biblioteki Lucide React oraz etykietą "subskrybentów" (YouTube) lub "obserwujących" (TikTok)
5. THE Channel_Stats_Section SHALL wyświetlać Total_View_Count z ikoną Eye z biblioteki Lucide React oraz etykietą "wyświetleń" (YouTube) lub "polubień" (TikTok)
6. WHILE dane kanału są ładowane po raz pierwszy (brak cache), THE Channel_Stats_Section SHALL nie wyświetlać się do momentu zakończenia pierwszego fetcha
7. IF API zwróci błąd lub brak danych statystyk kanału, THEN THE Channel_Stats_Section SHALL nie wyświetlać się (brak sekcji zamiast pustych wartości)
8. THE Channel_Stats_Section SHALL stosować rozmiar czcionki 12px, kolor tekstu text-muted dla etykiet i text-secondary z wagą font-semibold dla wartości liczbowych

### Requirement 3: Pobieranie statystyk kanału z YouTube API

**User Story:** Jako twórca treści korzystający z YouTube, chcę aby dashboard pobierał statystyki mojego kanału, abym widział aktualne dane o subskrybentach i wyświetleniach.

#### Acceptance Criteria

1. WHEN dane kanału YouTube są odświeżane, THE System SHALL wykonać zapytanie do YouTube Data API v3 endpoint `channels` z parametrem `part=statistics` aby pobrać subscriberCount i viewCount kanału
2. THE System SHALL łączyć zapytanie o statystyki kanału z istniejącym zapytaniem o rozwiązanie channelId (dodanie `statistics` do parametru `part`), aby zminimalizować liczbę wywołań API
3. THE System SHALL przechowywać pobrane statystyki kanału w cache localStorage razem z danymi filmów pod kluczem `creator-dashboard-data-{channelId}`
4. IF kanał YouTube ma ukrytą liczbę subskrybentów (hiddenSubscriberCount === true), THEN THE System SHALL nie wyświetlać Subscriber_Count w Channel_Stats_Section

### Requirement 4: Pobieranie statystyk kanału z TikTok API

**User Story:** Jako twórca treści korzystający z TikToka, chcę aby dashboard pobierał statystyki mojego profilu, abym widział aktualne dane o obserwujących i polubieniach.

#### Acceptance Criteria

1. WHEN dane kanału TikTok są odświeżane w trybie automatycznym, THE System SHALL pobrać follower_count i heart_count z odpowiedzi API endpoint `/user/posts` (dane autora dostępne w polu `author` każdego filmu)
2. THE System SHALL przechowywać pobrane statystyki kanału TikTok w cache localStorage razem z danymi filmów pod kluczem `creator-dashboard-data-{channelId}`
3. WHEN kanał TikTok jest w trybie ręcznym (wklejone URL-e), THE Channel_Stats_Section SHALL nie wyświetlać statystyk kanału (brak dostępu do danych profilu przez endpoint pojedynczego filmu)

### Requirement 5: Polubienia i komentarze na kartach filmów

**User Story:** Jako twórca treści, chcę widzieć liczbę polubień i komentarzy na kartach filmów, abym mógł ocenić zaangażowanie widzów bez opuszczania dashboardu.

#### Acceptance Criteria

1. THE VideoCard SHALL wyświetlać Like_Count z ikoną ThumbsUp z biblioteki Lucide React w sekcji statystyk, obok istniejących wyświetleń i daty
2. THE VideoCard SHALL wyświetlać Comment_Count z ikoną MessageCircle z biblioteki Lucide React w sekcji statystyk, obok Like_Count
3. THE VideoCard SHALL formatować Like_Count i Comment_Count przy użyciu istniejącej funkcji formatViewCount
4. WHEN Like_Count lub Comment_Count wynosi 0 lub jest niedostępny (null/undefined), THE VideoCard SHALL wyświetlić "0" dla danej metryki
5. THE VideoCard SHALL wyświetlać ikony i wartości polubień oraz komentarzy w tym samym stylu co istniejące wyświetlenia (ikona 12px, tekst 12px font-semibold, kolor text-secondary dla wartości, text-muted dla ikony)

### Requirement 6: Pobieranie polubień i komentarzy z YouTube API

**User Story:** Jako twórca treści korzystający z YouTube, chcę aby dashboard pobierał dane o polubieniach i komentarzach moich filmów.

#### Acceptance Criteria

1. THE System SHALL pobierać likeCount i commentCount z istniejącego zapytania do YouTube Data API v3 endpoint `videos` z parametrem `part=statistics` (dane już dostępne w odpowiedzi, wymagane jedynie mapowanie)
2. THE System SHALL mapować likeCount i commentCount do ujednoliconego formatu obiektu filmu jako pola `likeCount` (number) i `commentCount` (number)
3. IF YouTube API zwróci likeCount jako ukryty (brak pola w odpowiedzi), THEN THE System SHALL ustawić likeCount na null w obiekcie filmu

### Requirement 7: Pobieranie polubień i komentarzy z TikTok API

**User Story:** Jako twórca treści korzystający z TikToka, chcę aby dashboard pobierał dane o polubieniach i komentarzach moich filmów.

#### Acceptance Criteria

1. THE System SHALL mapować pole `digg_count` z odpowiedzi TikTok API na `likeCount` w ujednoliconym formacie obiektu filmu
2. THE System SHALL mapować pole `comment_count` z odpowiedzi TikTok API na `commentCount` w ujednoliconym formacie obiektu filmu
3. THE System SHALL pobierać digg_count i comment_count zarówno z endpointu `/user/posts` (tryb automatyczny) jak i z endpointu `/` (tryb ręczny — pojedynczy film)

### Requirement 8: Formatowanie procentowej zmiany

**User Story:** Jako twórca treści, chcę aby wartość procentowa była czytelna i spójna z polskim formatem liczbowym.

#### Acceptance Criteria

1. THE System SHALL obliczać procentową zmianę przy użyciu istniejącej funkcji calculatePercentChange z modułu trendCalculator.js
2. THE System SHALL formatować wynik jako string z jednym miejscem po przecinku, używając przecinka jako separatora dziesiętnego (format polski), np. 12.34 → "12,3"
3. WHEN wartość bezwzględna procentowej zmiany po zaokrągleniu do jednego miejsca po przecinku wynosi 0,0, THE System SHALL wyświetlić "0%" bez znaku
4. FOR ALL wartości procentowych, formatowanie a następnie parsowanie SHALL zachować dokładność do jednego miejsca po przecinku (round-trip w zakresie tolerancji zaokrąglenia)
