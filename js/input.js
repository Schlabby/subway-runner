// Tastatur + Touch-Swipe. Ruft Callbacks auf Game auf.
class Input {
  constructor(game) {
    this.game = game;
    this.touchStartX = 0;
    this.touchStartY = 0;
    this.bindKeyboard();
    this.bindTouch();
    this.bindButtons();
  }

  bindKeyboard() {
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      const k = e.key;
      if (k === 'ArrowLeft' || k === 'a' || k === 'A') this.game.moveLane(-1);
      else if (k === 'ArrowRight' || k === 'd' || k === 'D') this.game.moveLane(1);
      else if (k === 'ArrowUp' || k === 'w' || k === 'W' || k === ' ') { e.preventDefault(); this.game.jump(); }
      else if (k === 'ArrowDown' || k === 's' || k === 'S') this.game.roll();
      else if (k === 'p' || k === 'P' || k === 'Escape') this.game.togglePause();
      else if (k === 'Enter') this.game.handleEnter();
    });
  }

  bindTouch() {
    const canvas = document.getElementById('game');
    canvas.addEventListener('touchstart', (e) => {
      const t = e.changedTouches[0];
      this.touchStartX = t.clientX;
      this.touchStartY = t.clientY;
    }, { passive: true });

    canvas.addEventListener('touchend', (e) => {
      const t = e.changedTouches[0];
      const dx = t.clientX - this.touchStartX;
      const dy = t.clientY - this.touchStartY;
      const adx = Math.abs(dx), ady = Math.abs(dy);
      if (Math.max(adx, ady) < 24) { this.game.jump(); return; } // Tap = Sprung
      if (adx > ady) this.game.moveLane(dx > 0 ? 1 : -1);
      else this.game.rollOrJump(dy);
    }, { passive: true });

    // Maus-Swipe für Desktop-Test
    let mDown = false, mx = 0, my = 0;
    canvas.addEventListener('mousedown', (e) => { mDown = true; mx = e.clientX; my = e.clientY; });
    canvas.addEventListener('mouseup', (e) => {
      if (!mDown) return;
      mDown = false;
      const dx = e.clientX - mx, dy = e.clientY - my;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 10) return;
      if (Math.abs(dx) > Math.abs(dy)) this.game.moveLane(dx > 0 ? 1 : -1);
      else this.game.rollOrJump(dy);
    });
  }

  bindButtons() {
    document.getElementById('btn-start').addEventListener('click', () => this.game.start());
    document.getElementById('btn-restart').addEventListener('click', () => this.game.start());
    document.getElementById('btn-resume').addEventListener('click', () => this.game.togglePause());
  }
}
