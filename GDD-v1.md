# SKETCH TOWERS (Splash Dash TD) — Game Design Document

## 🎯 1. Concept General
Un joc de tip Tower Defense minimalist dezvoltat în HTML5 Canvas 2D pur, fără motoare externe, optimizat pentru performanță brută (60 FPS) și monetizare pe CrazyGames. 

**Vibe & Estetică:** Lumea este o hârtie de schițe întunecată. Elementele de decor și inamicii sunt desenați în linii de creion, în timp ce turnurile și proiectilele explodează în culori neon fluide (paleta CMYK: Cyan, Magenta, Yellow, Roz) cu efect de glow.

---

## 🕹️ 2. Mecanici Core de Gameplay

### 🗺️ Harta și Grid-ul (Optimizare Algoritm)
*   **Grid Fix:** Ecran de 800×600px împărțit într-un grid de **20×12 celule** (fiecare celulă are exact 40×40px).
*   **Sistemul de Waypoints (Fără AI complex):** Path-ul inamicilor este predefinit printr-un array fix de coordonate (Ex: `[{x:0, y:2}, {x:5, y:2}, {x:5, y:8}]`). Inamicii se deplasează strict în linie dreaptă de la un punct la altul.
*   **Restricții:** Celulele care fac parte din path sunt marcate grafic în creion; plasarea turnurilor este blocată pe aceste celule.

### 💰 Economie și Resurse (In-Game)
*   **Coins:** Se câștigă instant la distrugerea inamicilor. Se folosesc exclusiv *în timpul meciului* pentru a cumpăra și upgrada turnuri.
*   **Energy:** Resursă care se generează pasiv în timp, folosită pentru abilități speciale de urgență.
*   **Wave Bonus:** Fiecare val finalizat cu succes oferă un bonus fix de monede.

---

## 🗼 3. Sistemul de Turnuri & Upgrade-uri

### Tipuri de Turnuri (5 Clase)

| Turn | Cost | Damage | Range (Rază) | Cooldown | Efect Special (Neon Juice) |
|------|------|--------|--------------|----------|----------------------------|
| **Arrow** | 50 | 10 | 3 celule | 0.5s | Atac de bază, viteză mare (Cyan) |
| **Cannon** | 100 | 40 | 2 celule | 1.5s | Daune în zonă / AoE de 1 celulă (Magenta) |
| **Ice** | 75 | 5 | 3 celule | 1.0s | Încetinește inamicul cu 50% timp de 2s (Blue) |
| **Lightning**| 120 | 25 | 4 celule | 0.8s | Atac în lanț (Chain) pe 2 inamici apropiați |
| **Sniper** | 150 | 80 | 6 celule | 2.5s | Țintă unică, daune masive (Yellow) |

### Logica de Upgrade (In-Game)
Dând click pe un turn plasat, se deschide un meniu radial mic:
*   **Nivelul 2:** +50% Damage, +1 Range. Cost = 75% din prețul inițial.
*   **Nivelul 3:** +100% Damage, +2 Range + Abilitate specială îmbunătățită. Cost = 100% din prețul inițial.

---

## 👾 4. Inamicii & Structura Valurilor

### Tipuri de Inamici (Monocromi / Stil Creion)

| Inamic | HP de Bază | Viteză | Coins Drop | Abilitate Specială |
|--------|------------|--------|------------|--------------------|
| **Scout** | 30 | 2.0 | 5 | Dimensiune mică, viteză crescută |
| **Grunt** | 80 | 1.2 | 10 | Atribute echilibrate (Standard) |
| **Tank** | 200 | 0.7 | 25 | Rezistență mare, imun la încetinire totală |
| **Healer**| 60 | 1.0 | 15 | Regenerează HP-ul inamicilor din raza sa |
| **Boss** | 500+ | 0.5 | 100 | Apare la valul 20. Imun la CC, HP scalabil |

### Structura unui Nivel (World Loop)
*   **20 de valuri** per hartă. Fiecare val adaugă progresiv mai mulți inamici și le crește viața cu un multiplicator global.
*   **Valuri Speciale:** La fiecare 5 valuri apare un val compus doar din Tanks sau Healers. Valul 20 este exclusiv un Boss Fight.
*   **HP-ul Bazei (Inimile):** Jucătorul începe cu 20 HP. Orice inamic scurs de pe hartă scade 1 HP. Boss-ul scade 5 HP. La 0 HP => Defeat.

---

## 💾 5. Progresie, Meta-Game și Raspberry Pi 3

Jocul nu își pierde progresul. Folosește un loop de retenție pe termen lung:

### Monede Permanente (Meta-Currency)
Toate monedele adunate în timpul curselor (chiar și în caz de înfrângere) se convertesc în puncte de progres permanente în Meniul Principal. Jucătorul poate cumpăra upgrade-uri globale:
1.  **Start Bonus:** Începe orice meci cu +50 / +100 / +150 monede.
2.  **Extra Shields:** Baza primește permanent +5 / +10 / +15 HP în plus.
3.  **Architect Discount:** Toate turnurile costă cu 5% / 10% / 15% mai puțin la plasare.

### Arhitectura Serverului (Asincronă)
*   **Faza 1 (Local):** `SaveManager` stochează progresul în `localStorage` folosind funcții `async/await`.
*   **Faza 2 (Cloud Local):** `SaveManager` va trimite pachete JSON prin `fetch()` asincron către backend-ul tău Node.js/Express de pe **Raspberry Pi 3**. RPi3 stochează datele în SQLite și trimite înapoi clasamentul global pentru ecranul de Leaderboard.

---

## 💵 6. Strategia de Monetizare (CrazyGames SDK)

1.  **Ad Break Points (Interstițiale):** Rulate exclusiv pe ecranele de tranziție (între nivele sau după ecranul de Defeat), niciodată în timpul acțiunii.
2.  **Rewarded Videos (Motorul de încasări):**
    *   *Revive:* La pierderea celor 20 HP, jucătorul poate privi o reclamă de 15 secunde pentru a restabili 5 HP și a continua valul curent.
    *   *Pigment Multiplier:* La finalul unui nivel, poate dubla numărul de Monede Permanente primite vizionând un video documentat.
3.  **Daily Reward:** Ofertă zilnică de monede permanente accesibilă prin vizionarea unei reclame din meniu.

---

## 🛠️ 7. Structura Fișierelor în Folder

Fișierele reutilizate din proiectul tău anterior oferă motorul de bază, iar logica TD va fi izolată în clase noi:

```text
📁 sketch-towers/
├── 📄 index.html              <- Interfața HUD (Sidebar, Meniuri DOM) + Canvas
├── 📄 GDD.md                  <- Acest document de design
└── 📁 js/
    ├── 📄 TDGameEngine.js     <- Bucla principală (60 FPS: update, render, state machine)
    ├── 📄 Grid.js             <- Managerul de celule 20x12 și array-ul de Waypoints
    ├── 📄 Tower.js            <- Clasa de bază pentru cele 5 turnuri și razele lor
    ├── 📄 Enemy.js            <- Logica de mișcare din punct în punct (Waypoints) și HP
    ├── 📄 Wave.js             <- Configurația celor 20 de valuri procedural-scalabile
    ├── 📄 Projectile.js       <- Mișcarea vectorilor de atac și detecția coliziunilor fizice
    │
    └── 📁 modules/            <- Fișiere REUTILIZATE direct din jocul anterior
        ├── 📄 ParticleSystem.js <- Explozii și trail-uri de particule neon lichefiate
        ├── 📄 AudioManager.js   <- Sunete procedurale de atac și plasare (Oscillators)
        ├── 📄 SaveManager.js    <- Logica asincronă de salvare (LocalStorage -> RPi3)
        └── 📄 Leaderboard.js    <- Afișarea topului de scoruri

```

## 🛑 8. Ajustări Tehnice și Specificații CrazyGames (Addendum)

### 1. Optimizare Structură Fișiere
Toate fișierele JavaScript reutilizate (`ParticleSystem.js`, `SaveManager.js`, etc.) vor fi plasate direct în folderul `js/`, nu în subfoldere, pentru a păstra căile (paths) simple și compatibile cu Service Worker-ul (PWA).

### 2. Mobile UX & Rezoluție Adaptivă
*   **Grid scalabil:** Pe ecrane mobile, în loc de zoom/scroll complex, Canvas-ul va folosi un sistem de scaling automat (`CSS object-fit: contain`) pentru a menține aspectul 20x12, dar cu o detecție precisă a atingerilor (touch-to-grid collision offsets).
*   **Selecție în Doi Pași:** Pentru a evita plasarea greșită pe ecrane mici, primul *tap* pe grid selectează celula și deschide un preview al turnului + un buton verde de confirmare ("Build"). Al doilea *tap* plasează efectiv turnul.

### 3. Logica de Atac a Turnurilor (Targeting)
În mod implicit, toate turnurile vor folosi algoritmul **"First" (Cel mai avansat inamic pe path)**. Pentru turnul de tip Sniper, se va adăuga ulterior opțiunea de a schimba ținta pe **"Strongest" (Inamicul cu cel mai mare HP curent)** prin meniul de upgrade.

### 4. Sistemul de Vânzare (Tower Selling)
*   Orice turn plasat poate fi vândut din meniul radial/click.
*   **Rambursare:** Jucătorul primește înapoi 75% din costul total investit în acel turn (preț de bază + upgrade-uri). Celula redevine liberă instant.

### 5. Plasare în timpul Valului
Jucătorul **poate plasa și upgrada turnuri în timp real**, chiar în timp ce inamicii se mișcă pe ecran. Acest lucru adaugă dinamică și urgență jocului, forțând jucătorul să reacționeze dacă un inamic scapă de sub control.

### 6. Evenimentul Focus Loss (Regulă CrazyGames)
Jocul va asculta evenimentele de sistem ale browserului și ale SDK-ului CrazyGames. Când utilizatorul schimbă tab-ul sau se activează o reclamă, motorul de joc va apela automat o metodă `GameEngine.pause()`, înghețând bucla `requestAnimationFrame`.

### 7. Integrare SDK CrazyGames vs. Raspberry Pi 3
*   **Versiunea CrazyGames:** Clasamentul global va fi conectat direct la sistemul lor prin SDK (`crazygames.leaderboard.submitScore`). Salvarea progresului se va face via LocalStorage (care pe CrazyGames este persistentă per utilizator).
*   **Versiunea Self-Hosted (Raspberry Pi 3):** Rămâne ca o opțiune secundară în `SaveManager`, activată doar dacă jocul este rulat pe domeniul tău privat, transformând RPi3 într-un server dedicat de analytics și backup.


---