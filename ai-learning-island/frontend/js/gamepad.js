/**
 * Web Gamepad API 封装
 * 支持无线2.4G手柄，按键映射为标准布局
 */
class GamepadManager {
  constructor() {
    this.gamepadIndex = null;
    this.connected = false;
    this.prevButtons = [];
    this.listeners = {};
  }

  start() {
    this._poll();
    window.addEventListener('gamepadconnected', (e) => {
      this.gamepadIndex = e.gamepad.index;
      this.connected = true;
      this._updateIndicator(true);
      console.log('手柄已连接:', e.gamepad.id);
    });
    window.addEventListener('gamepaddisconnected', () => {
      this.connected = false;
      this.gamepadIndex = null;
      this._updateIndicator(false);
      console.log('手柄已断开');
    });
  }

  _poll() {
    const gamepads = navigator.getGamepads();
    if (this.gamepadIndex !== null) {
      const gp = gamepads[this.gamepadIndex];
      if (gp) {
        this._processButtons(gp.buttons);
        this._processAxes(gp.axes);
      }
    }
    requestAnimationFrame(() => this._poll());
  }

  _processButtons(buttons) {
    for (let i = 0; i < buttons.length; i++) {
      const pressed = buttons[i].pressed;
      const wasPressed = this.prevButtons[i];
      if (pressed && !wasPressed) {
        this._fire('press', { button: i });
      }
      this.prevButtons[i] = pressed;
    }
  }

  _processAxes(axes) {
    const DEAD_ZONE = 0.3;
    for (let i = 0; i < axes.length; i += 2) {
      const x = axes[i];
      const y = axes[i + 1];
      if (Math.abs(x) > DEAD_ZONE || Math.abs(y) > DEAD_ZONE) {
        this._fire('move', { x, y, axis: i });
      }
    }
  }

  on(event, callback) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(callback);
  }

  _fire(event, data) {
    (this.listeners[event] || []).forEach(cb => cb(data));
  }

  _updateIndicator(connected) {
    const el = document.getElementById('gamepad-indicator');
    if (el) {
      el.textContent = connected ? '🎮 手柄已连接' : '🎮 等待手柄';
      el.className = connected ? 'connected' : '';
    }
  }
}

// 按键映射
const GAMEPAD_BUTTONS = {
  A: 0,        // 确认
  B: 1,        // 返回
  X: 2,        // 辅助
  Y: 3,        // 辅助
  LB: 4,       // 左肩键
  RB: 5,       // 右肩键
  DPAD_UP: 12,
  DPAD_DOWN: 13,
  DPAD_LEFT: 14,
  DPAD_RIGHT: 15,
};
