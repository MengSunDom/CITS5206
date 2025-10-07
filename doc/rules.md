### One-deal session (Red = current user, Blue = partner)

* **Setup.** There is only **1 deal**. **Red (you)** has already answered **0N → 1E → 2S** in order.
  For **Blue**, the unfinished nodes along that path (**0N, 1E, 2S**) are **light-blue** (only Blue still needs to answer).

* **Blue starts.**

  * Blue has **no last answer yet**, so **+4 does not apply**.
  * Apply Rule 2: **choose a deal at random** (only one deal exists), then assign the **smallest-depth** eligible node in that deal → **0N**.
  * The play UI shows the **public history string** only (no attribution of who made which call).

* **After Blue answers 0N.**

  * Now **+4 target = 4N**.
  * If **4N** already exists and is eligible, assign **4N** next.
  * If **4N** is **not** yet available, apply Rule 2 again (still this single deal) and pick the **smallest-depth** remaining node → **1E** (not 2S).
  * After 1E, if 4N is still unavailable, the next smallest-depth node is **2S**.
  * As soon as **4N** becomes available, the scheduler may **jump to 4N** via the **+4 rule**.

* **Coloring as both proceed.**

  * Any node where **both** have answered turns **grey**.
  * Nodes awaiting **only Red (you)** are **pink**; nodes awaiting **only Blue** are **light-blue**; nodes awaiting **both** are **yellow**.
  * During play, the UI shows **public history only**; **who chose what is revealed later** in review (Tree View), not during play.

* **Later divergence at 6S (example).**

  * Suppose at **6S** Blue makes a **different call** from Red. Then **6S** becomes a **divergence** node.
  * The **next seat after 6S is 7W**. A child position at **7W** is created on each branch; it starts **yellow** (both must answer).
  * If **Blue** answers 7W first, 7W becomes **pink** (only **Red** left there); if **Red** answers first, it becomes **light-blue**.
  * **Same-seat no-follow** applies **only** to the **split seat (S)** on the **other branch**: once a **future S** node appears there, the player who already committed at S on this branch is **not required** to answer those S nodes. Other seats (W/N/E) still require answers from both players.

* **Concurrency note (per client).**
  It’s acceptable for **both players to answer the same node**; the backend serializes updates. No UI “claim” or lock is needed.

---

**Key alignment points**

* Scheduler = **+4 first**; otherwise **random deal → smallest depth** within that deal (with one deal, this reduces to “smallest depth”).
* After Blue does **0N**, if **4N** isn’t available yet, the next pick is **1E** (smallest depth), **not** 2S.
* After a split at **6S**, the next seat is **7W** (not 11W).
