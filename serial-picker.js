/*
 * Portauswahl-Dialog fuer den Electron-Build.
 * Im normalen Browser existiert window.electronSerial nicht -> das Skript
 * macht dann gar nichts und Chrome zeigt weiterhin seinen eigenen Dialog.
 * Einbinden mit:  <script src="serial-picker.js"></script>
 */
(() => {
  if (!window.electronSerial) return;

  const CSS = `
    .esp-backdrop {
      position: fixed; inset: 0; z-index: 2147483647;
      background: rgba(0, 0, 0, .55);
      display: flex; align-items: center; justify-content: center;
      font: 14px/1.45 system-ui, sans-serif;
    }
    .esp-box {
      background: #fff; color: #111; border-radius: 10px;
      min-width: 340px; max-width: 520px; padding: 20px 22px;
      box-shadow: 0 12px 40px rgba(0,0,0,.35);
    }
    .esp-box h2 { margin: 0 0 4px; font-size: 16px; }
    .esp-hint { margin: 0 0 14px; color: #666; font-size: 12px; }
    .esp-list { list-style: none; margin: 0 0 16px; padding: 0;
                max-height: 260px; overflow-y: auto; }
    .esp-list li { margin-bottom: 6px; }
    .esp-port {
      width: 100%; text-align: left; cursor: pointer;
      border: 1px solid #d5d5d5; border-radius: 6px;
      background: #fafafa; padding: 9px 11px; font: inherit;
    }
    .esp-port:hover { background: #eef4ff; border-color: #8ab0ff; }
    .esp-port strong { display: block; font-size: 14px; }
    .esp-port span { color: #777; font-size: 11px; font-family: ui-monospace, monospace; }
    .esp-actions { text-align: right; }
    .esp-cancel {
      cursor: pointer; border: 0; background: transparent;
      color: #555; font: inherit; padding: 6px 4px;
    }
    @media (prefers-color-scheme: dark) {
      .esp-box { background: #23262b; color: #eee; }
      .esp-hint, .esp-port span { color: #999; }
      .esp-port { background: #2c3037; border-color: #3d434c; color: #eee; }
      .esp-port:hover { background: #363c46; border-color: #5b7fd0; }
      .esp-cancel { color: #aaa; }
    }
  `;

  let backdrop = null;

  function close() {
    backdrop?.remove();
    backdrop = null;
    document.removeEventListener('keydown', onKey);
  }

  function onKey(e) {
    if (e.key === 'Escape') {
      window.electronSerial.cancel();
      close();
    }
  }

  function label(p) {
    return p.portName || p.displayName || p.portId;
  }

  function detail(p) {
    const bits = [];
    if (p.displayName && p.portName) bits.push(p.displayName);
    if (p.vendorId || p.productId) {
      bits.push(`VID:PID ${p.vendorId || '?'}:${p.productId || '?'}`);
    }
    if (p.serialNumber) bits.push(`SN ${p.serialNumber}`);
    return bits.join('  \u2022  ');
  }

  function show(ports) {
    close();

    backdrop = document.createElement('div');
    backdrop.className = 'esp-backdrop';

    const style = document.createElement('style');
    style.textContent = CSS;

    const box = document.createElement('div');
    box.className = 'esp-box';

    const title = document.createElement('h2');
    title.textContent = 'Seriellen Port waehlen';

    const hint = document.createElement('p');
    hint.className = 'esp-hint';
    hint.textContent = 'HP 33120A per RS-232 bzw. USB-Seriell-Adapter';

    const list = document.createElement('ul');
    list.className = 'esp-list';

    ports.forEach((p) => {
      const li = document.createElement('li');
      const btn = document.createElement('button');
      btn.className = 'esp-port';
      btn.type = 'button';

      const name = document.createElement('strong');
      name.textContent = label(p);
      btn.appendChild(name);

      const info = detail(p);
      if (info) {
        const sub = document.createElement('span');
        sub.textContent = info;
        btn.appendChild(sub);
      }

      btn.addEventListener('click', () => {
        window.electronSerial.select(p.portId);
        close();
      });

      li.appendChild(btn);
      list.appendChild(li);
    });

    const actions = document.createElement('div');
    actions.className = 'esp-actions';
    const cancel = document.createElement('button');
    cancel.className = 'esp-cancel';
    cancel.type = 'button';
    cancel.textContent = 'Abbrechen (Esc)';
    cancel.addEventListener('click', () => {
      window.electronSerial.cancel();
      close();
    });
    actions.appendChild(cancel);

    box.append(style, title, hint, list, actions);
    backdrop.appendChild(box);
    document.body.appendChild(backdrop);

    document.addEventListener('keydown', onKey);
    list.querySelector('.esp-port')?.focus();
  }

  window.electronSerial.onPorts(show);
})();
