import { Flap } from './Flap';

export class Clock {
  readonly el: HTMLDivElement;
  private digits: Flap[] = [];
  private ampmEl: HTMLDivElement;
  private timer: number | null = null;

  constructor(host: HTMLElement) {
    this.el = host as HTMLDivElement;
    this.el.innerHTML = '';

    // HH MM SS = 6 digits, with colons after positions 1 and 3.
    for (let i = 0; i < 6; i++) {
      const f = new Flap('0');
      this.digits.push(f);
      this.el.appendChild(f.el);
      if (i === 1 || i === 3) this.el.appendChild(makeColon());
    }
    this.ampmEl = document.createElement('div');
    this.ampmEl.className = 'ampm';
    this.ampmEl.textContent = 'AM';
    this.el.appendChild(this.ampmEl);
  }

  start(): void {
    this.tick();
    this.scheduleNext();
  }

  stop(): void {
    if (this.timer != null) clearTimeout(this.timer);
    this.timer = null;
  }

  private scheduleNext(): void {
    const now = Date.now();
    const ms = 1000 - (now % 1000);
    this.timer = window.setTimeout(() => {
      this.tick();
      this.scheduleNext();
    }, ms);
  }

  private tick(): void {
    const now = new Date();
    let h = now.getHours();
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12;
    if (h === 0) h = 12;
    const m = now.getMinutes();
    const s = now.getSeconds();
    const str =
      h.toString().padStart(2, '0') +
      m.toString().padStart(2, '0') +
      s.toString().padStart(2, '0');
    for (let i = 0; i < 6; i++) this.digits[i].set(str[i]);
    if (this.ampmEl.textContent !== ampm) this.ampmEl.textContent = ampm;
  }
}

function makeColon(): HTMLDivElement {
  const c = document.createElement('div');
  c.className = 'colon';
  c.innerHTML = '<span></span><span></span>';
  return c;
}
