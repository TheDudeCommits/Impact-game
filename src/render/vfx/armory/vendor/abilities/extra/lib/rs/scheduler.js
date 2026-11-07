// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
/*!
 * rollshade-gl / scheduler.js
 *
 * Ported from rollshade (https://github.com/tsuyatt/rollshade) `src/runtime/scheduler.ts`:
 * TypeScript types stripped, imports rewired to the GLSL runtime in this folder.
 * The move logic itself is unchanged.
 *
 * MIT License — Copyright (c) 2026 tsuyatt. Port for the VFX Armory "extra" pack.
 */
export class Scheduler {
  time = 0;
  part = "main";
  tasks = [];
  due = [];
  lives = [];
  stepping = false;
  after(delay, fn, owner = null) {
    this.tasks.push({ at: this.time + Math.max(delay, 0), fn, owner, part: this.part });
  }
  add(live, owner = null) {
    this.lives.push({ live, owner, part: this.part, dead: false });
    return live;
  }
  during(delay, dur, fn, end, owner = null) {
    this.after(delay, () => {
      let age = 0;
      fn(0, 0, 0);
      this.add({
        update: (dt) => {
          age += dt;
          const k = Math.min(age / dur, 1);
          fn(k, dt, age);
          if (k >= 1) {
            end?.();
            return false;
          }
          return true;
        }
      }, owner);
    }, owner);
  }
  step(dt) {
    if (this.stepping)
      return;
    this.time += dt;
    this.stepping = true;
    let next = 0;
    try {
      for (let guard = 0;guard < 8; guard++) {
        const due = this.tasks.filter((t) => t.at <= this.time);
        if (due.length === 0)
          break;
        this.tasks = this.tasks.filter((t) => t.at > this.time);
        due.sort((a, b) => a.at - b.at);
        this.due = due;
        for (next = 0;next < due.length; ) {
          const t = due[next++];
          if (t.dead)
            continue;
          this.part = t.part;
          t.fn();
        }
        this.due = [];
      }
      const lives = this.lives;
      for (let i = lives.length - 1;i >= 0; i--) {
        const entry = lives[i];
        if (entry.dead)
          continue;
        this.part = entry.part;
        let keep = false;
        try {
          keep = entry.live.update(dt);
        } finally {
          if (!keep && !entry.dead) {
            entry.dead = true;
            entry.live.dispose?.();
          }
        }
      }
    } finally {
      for (let i = next;i < this.due.length; i++)
        if (!this.due[i].dead)
          this.tasks.push(this.due[i]);
      this.due = [];
      this.stepping = false;
      this.part = "main";
      this.sweep();
    }
  }
  sweep() {
    const lives = this.lives;
    let n = 0;
    for (let i = 0;i < lives.length; i++)
      if (!lives[i].dead)
        lives[n++] = lives[i];
    lives.length = n;
  }
  busy(owner) {
    return this.tasks.some((t) => t.owner === owner) || this.lives.some((l) => !l.dead && l.owner === owner);
  }
  cancel(owner = null) {
    this.tasks = owner ? this.tasks.filter((t) => t.owner !== owner) : [];
    for (const t of this.due)
      if (!owner || t.owner === owner)
        t.dead = true;
    const lives = this.lives;
    for (let i = lives.length - 1;i >= 0; i--) {
      const entry = lives[i];
      if (entry.dead || owner && entry.owner !== owner)
        continue;
      entry.dead = true;
      entry.live.dispose?.();
    }
    if (!this.stepping)
      this.sweep();
  }
}
