# Full-Fledged Software Development Plan & Technical Specification

**Project:** Multi-User Gamified Multiplication Learning PWA

**Target Hardware:** Synology DS223j NAS (Docker / Node.js / SQLite)

**Target Clients:** Mobile Phones & iPads (Touch-optimized Web App)

---

## 1. Project Overview & Objectives

A self-hosted, multi-user Progressive Web App (PWA) designed to help children master multiplication tables. It combines **gamification** (earning playtime through math accuracy), **pedagogical tracking** (rolling 7-day heatmaps), **dynamic difficulty adjustment (DDA)**, and **admin controls** to customize ranges, variant counts, and time economics.

---

## 2. Technical Stack & Architecture

To run seamlessly on the low-memory (1GB RAM) Realtek ARM processor of the Synology DS223j, the application uses a lightweight, single-container architecture:

* **Runtime & Backend:** Node.js (v20+ LTS) using **Express.js**.
* **Database:** **SQLite3** (file-based, zero configuration, embedded in the container volume).
* **Frontend:** Responsive single-page application (SPA) built with Vanilla JavaScript (or lightweight Vue 3 Composition API), styled with **Tailwind CSS** (loaded via CDN for zero-build overhead).
* **State Management & PWA:** LocalStorage for UI caching, Service Worker for offline caching and smooth tablet/phone experience.
* **Deployment:** Docker container managed via Synology Container Manager.

---

## 3. Database Schema Design (SQLite)

### `users`

* `id` (INTEGER, PRIMARY KEY, AUTOINCREMENT)
* `username` (TEXT, UNIQUE)
* `pin` (TEXT) - Simple PIN for quick user switching.
* `role` (TEXT) - `'admin'` or `'user'`.
* `daily_time_bank_seconds` (INTEGER) - Current accumulated screen time.

### `games` (Game Configurations)

* `id` (INTEGER, PRIMARY KEY, AUTOINCREMENT)
* `name` (TEXT) - e.g., "Easy Twos", "Hard Sevens".
* `range_a_min` (INTEGER), `range_a_max` (INTEGER)
* `range_b_min` (INTEGER), `range_b_max` (INTEGER)
* `allowed_combinations_json` (TEXT) - JSON array of specific allowed tuples, e.g., `[[2,5],[2,6]...]`.
* `variant_count` (INTEGER) - Number of multiple-choice buttons shown (e.g., $N=3$).
* `base_time_reward` (INTEGER) - Seconds added for correct answer.
* `time_penalty` (INTEGER) - Seconds deducted for wrong/timeout.
* `max_daily_time` (INTEGER) - Cap for time bank (default 3600 seconds / 1 hour).

### `user_game_assignments`

* `user_id` (INTEGER)
* `game_id` (INTEGER)

### `daily_stats`

* `id` (INTEGER, PRIMARY KEY, AUTOINCREMENT)
* `user_id` (INTEGER)
* `date` (TEXT) - Format `YYYY-MM-DD`
* `total_tries` (INTEGER)
* `correct_tries` (INTEGER)
* `time_earned_seconds` (INTEGER)

### `matrix_stats` (Rolling 7-Day Tracking)

* `id` (INTEGER, PRIMARY KEY, AUTOINCREMENT)
* `user_id` (INTEGER)
* `factor_a` (INTEGER)
* `factor_b` (INTEGER)
* `correct` (BOOLEAN)
* `timestamp` (DATETIME) - Indexed for rolling window calculations.

---

## 4. Frontend Screen Wireframes & UI Flow

### A. User Authentication / Profile Switcher

* Clean grid of user avatars/names. Tapping a user and entering their short PIN logs them in instantly.

### B. Game Selection Screen

* Lists all games assigned to the logged-in user.
* Displays **Game Name** and **Time Rewards per combination** (e.g., `+10s correct / -5s wrong`).
* A prominent **"Start Playing"** button launches the game loop.

### C. Dashboard / Home Screen

* **Header Bar:** User Name, Current Time Bank status (e.g., `45:00 available`), and Logout button.
* **Rolling Heatmap (7 Days):**
* Grid representation of the multiplication table based on the game's range.
* **Green:** High accuracy / non-wrong.
* **Red:** Frequent errors.
* **Mixed:** Intermediate ratios.



* **Daily Stats Card:** Tries vs. Correct answers for today.
* **Action Area:** Big, touch-friendly **"Let's Play!"** button.

### D. Game Play Screen (The Core Loop)

1. **Top HUD:** Shrinking countdown progress bar + live time bank ticker.
2. **Center Equation Area:**
* **First Number Box:** Rolls *very fast* like a slot machine, instantly locking into place.
* **Second Number Box:** Rolls *slower*, decelerating gradually. Gives the user a visual cue to start calculating *before* the timer starts.
* Display: `[ Num 1 ] × [ Num 2 ] = ?`


3. **Multiple-Choice Variants (Bottom):**
* $N$ buttons appear in randomized positions (configured by admin, e.g., 3 buttons: 1 correct answer + $N-1$ distractors).


4. **Immediate Feedback & Magic Rules:**
* Tapping an answer triggers an immediate green (correct) or red (incorrect) flash.
* If incorrect, the correct answer is explicitly highlighted.
* If a specific factor has a "Magic Rule" (e.g., multiplying by 10 $\rightarrow$ *“Just add a 0 at the end!”*), a friendly hint bubble pops up.


5. **Session Control:**
* A clear **"Stop / Finish"** button is accessible between questions to exit to the session summary.



### E. Session Summary Screen

* Summarizes the completed session: Total questions answered, accuracy percentage, and time successfully added to the time bank.

### F. Admin Panel Screens

1. **Dashboard & Leaderboard:** Top players ranked by total gained time and overall accuracy.
2. **User Management:** Create/edit users, assign PINs, and link game configurations.
3. **User Statistics & Reset:** View detailed daily logs per user with a dedicated **"Reset Progress / Heatmap"** button.
4. **Game Configuration Studio:**
* Set Factor A & B ranges, filter exact matrix combinations, define variant count ($N$), and tune time reward/penalty economics.



---

## 5. Development Milestones & Execution Plan

* **Phase 1: Backend & Database Setup**
* Initialize Node.js Express project with SQLite database bindings.
* Write database migration scripts to create tables (`users`, `games`, `matrix_stats`, `daily_stats`).
* Implement REST API endpoints for user auth, game fetching, stats logging, and rolling 7-day heatmap queries.


* **Phase 2: Game Engine & Frontend UI (User Side)**
* Build responsive mobile/tablet layout using Tailwind CSS.
* Implement the slot-machine roll animation (fast roll for Num 1, slow deceleration for Num 2).
* Build the dynamic $N$-variant button generator and answer verification logic.
* Implement the rolling 7-day heatmap rendering logic.


* **Phase 3: Admin Panel**
* Build user management and game configuration screens.
* Implement rule builders for factor ranges and custom magic hints.


* **Phase 4: Synology Deployment**
* Write a lightweight `Dockerfile` and `docker-compose.yml`.
* Test persistent SQLite volume mounting inside Synology Container Manager.
