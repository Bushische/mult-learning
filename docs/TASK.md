Here is the complete, high-level statement of purpose and core objectives for the project—focusing strictly on *what we want to achieve* from both a pedagogical and a technical perspective.

---

# Project Charter: Multiplication Learning PWA

## 1. Core Vision & Purpose

To build a lightweight, self-hosted, multi-user web application optimized for tablets and mobile devices that transforms learning multiplication tables into an engaging, gamified experience. Instead of abstract rewards, children earn **screen-time privileges** for gaming or media by demonstrating speed and accuracy in math, while parents/admins retain full control over difficulty parameters, time economics, and performance tracking.

---

## 2. Key Objectives & What We Want to Achieve

### A. Pedagogical Effectiveness & Smart Analytics

* **Rolling Progress Tracking (7-Day Heatmap):** Avoid the discouragement of permanent historical errors. By calculating performance over a sliding 7-day window, the heatmap dynamically reflects recent mastery, turning red zones green as the child learns.
* **Targeted Practice:** Allow admins to restrict matrix ranges (e.g., focusing only on tricky ranges like $2\text{--}4 \times 5\text{--}8$) so practice sessions are focused rather than overwhelming.
* **Cognitive Scaffolding (Number Roll & Magic Rules):**
* Use a two-stage slot-machine roll (fast first number, decelerating second number) to give the brain a crucial head start to recall combinations before the countdown timer begins.
* Provide "Magic Rules" hints (e.g., multiplying by 10) to teach mathematical shortcuts natively within the app.



### B. Gamification & Time Economy

* **Self-Regulating Screen Time:** Correct answers build up a daily time bank (capped at 1 hour so practice remains balanced), while mistakes or timeouts deduct time.
* **Dynamic Feedback Loop:** Immediate visual feedback (correct/incorrect flashes, showing the right answer on a miss) ensures instant learning reinforcement.
* **Open-Ended Control:** No rigid daily lockouts; children can stop or continue playing at their own pace, but surplus time stops accumulating once the daily cap is reached.

### C. Multi-User & Self-Hosted Administration

* **Multi-User Profiles:** Support multiple children with individual PIN logins, separate time banks, and independent statistics.
* **Admin Control Center:** Give administrators a clean interface to manage users, assign specific game configurations, view leaderboards, review daily statistics, and reset progress when a fresh start is needed.
* **Low-Resource Self-Hosting:** Engineered specifically to run efficiently inside a lightweight Docker container on a low-power home NAS (Synology DS223j) without heavy database or memory overhead.
