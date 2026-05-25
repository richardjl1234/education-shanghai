/**
 * 嘟嘟对话UI管理
 */
class DialogueUI {
  constructor() {
    this.container = document.getElementById('dialogue-container');
    this.textEl = document.getElementById('dialogue-text');
    this.bubble = document.getElementById('dialogue-bubble');
    this.sprite = document.getElementById('dudu-sprite');
    this.moodEl = document.getElementById('dudu-mood');
    this.hint = document.getElementById('dialogue-hint');
    this.isTyping = false;
    this.typeTimer = null;
    this.onComplete = null;

    // TTS 音频队列 — 确保所有声音按顺序播放，不重叠
    this._audioQueue = [];
    this._audioPlaying = false;
    this._currentAudioEl = null;   // 当前 Audio 元素
    this._currentResolve = null;   // 当前队列项的 resolve
  }

  show(text, mood, animation, onComplete) {
    this.container.classList.remove('hidden');
    this._setMood(mood);
    this._playAnimation(animation);
    this._typeText(text);
    this._playTTS(text);          // 通过队列播放，不打断已在队列中的内容
    this.onComplete = onComplete || null;
    this.hint.classList.remove('hidden');
  }

  /**
   * 停止当前 TTS 并清空队列（用于被打断的情况，如答题反馈需要优先）
   */
  stopAllTTS() {
    // 清空队列
    this._audioQueue = [];
    // 停止当前播放
    if (this._currentAudioEl) {
      this._currentAudioEl.pause();
      this._currentAudioEl = null;
    }
    this._audioPlaying = false;
    if (this._currentResolve) {
      this._currentResolve(false);  // false = 被打断
      this._currentResolve = null;
    }
  }

  /**
   * 通过队列播放 TTS（顺序播放，不打断已在队列的内容）
   */
  _playTTS(text) {
    if (!text || text.length < 4) return;
    this._audioQueue.push({ text });
    this._processQueue();
  }

  /**
   * 播放 TTS 并等待播放完毕（返回 Promise）
   * 用于答题反馈等需要等上一个声音播完再继续的场景
   */
  playTTSAndWait(text) {
    return new Promise(resolve => {
      if (!text || text.length < 4) { resolve(true); return; }
      this._audioQueue.push({ text, resolve });
      this._processQueue();
    });
  }

  _processQueue() {
    if (this._audioPlaying || this._audioQueue.length === 0) return;
    const item = this._audioQueue.shift();
    this._playNow(item);
  }

  _playNow(item) {
    this._audioPlaying = true;
    const audio = new Audio('/api/tts?text=' + encodeURIComponent(item.text));
    audio.volume = 0.8;

    audio.addEventListener('ended', () => {
      this._currentAudioEl = null;
      this._audioPlaying = false;
      const resolve = this._currentResolve;
      this._currentResolve = null;
      if (resolve) resolve(true);       // 完成
      this._processQueue();             // 播下一个
    });
    audio.addEventListener('error', () => {
      this._currentAudioEl = null;
      this._audioPlaying = false;
      const resolve = this._currentResolve;
      this._currentResolve = null;
      if (resolve) resolve(false);      // 失败
      this._processQueue();
    });

    this._currentAudioEl = audio;
    if (item.resolve) this._currentResolve = item.resolve;
    audio.play().catch(() => {
      // 浏览器阻止播放，静默忽略
      this._currentAudioEl = null;
      this._audioPlaying = false;
      if (this._currentResolve) { this._currentResolve(false); this._currentResolve = null; }
      this._processQueue();
    });
  }

  hide() {
    this.stopAllTTS();
    this.container.classList.add('hidden');
    this.hint.classList.add('hidden');
  }

  _setMood(mood) {
    const moodEmojis = {
      happy: '😊', excited: '🤩', curious: '🤔',
      surprised: '😲', concerned: '😟', worried: '😢',
      determined: '💪', brave: '🦸', encouraging: '📣',
      proud: '😎', touched: '🥹', warm: '💕',
      cheerful: '🎉', ecstatic: '🤗', comforting: '🫂',
    };
    this.moodEl.textContent = moodEmojis[mood] || '😊';
  }

  _playAnimation(animation) {
    this.sprite.className = '';
    void this.sprite.offsetWidth;
    if (animation && animation !== 'idle') {
      this.sprite.classList.add(animation);
    }
  }

  _typeText(text, speed = 50) {
    if (this.typeTimer) clearTimeout(this.typeTimer);
    this.isTyping = true;
    this.textEl.textContent = '';
    let i = 0;
    const type = () => {
      if (i < text.length) {
        this.textEl.textContent += text[i];
        i++;
        this.typeTimer = setTimeout(type, speed);
      } else {
        this.isTyping = false;
        this.typeTimer = null;
      }
    };
    type();
  }

  skipTyping(text) {
    this.stopAllTTS();
    if (this.isTyping) {
      clearTimeout(this.typeTimer);
      this.textEl.textContent = text;
      this.isTyping = false;
    }
  }

  complete() {
    this.stopAllTTS();
    if (this.onComplete) {
      const cb = this.onComplete;
      this.onComplete = null;
      cb();
    }
  }

  // ===== TTS 语音播放 =====

  /**
   * 在用户手势同步阶段预热音频系统，确保浏览器允许后续 audio.play()
   */
  wakeAudio() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      if (ctx.state === 'suspended') ctx.resume();
      this._audioCtx = ctx;
    } catch (e) {
      // AudioContext 不可用 — 静默忽略
    }
  }

  /**
   * 播放短音效（立即打断当前音频，用于答对奖励/答错安慰等场景）
   * 不排队，不等待，用于触发短提示音
   */
  playEffect(text) {
    if (!text || text.length < 2) return;
    // 停止当前所有音频
    this.stopAllTTS();
    // 立即播放音效
    const audio = new Audio('/api/tts?text=' + encodeURIComponent(text));
    audio.volume = 0.9;
    audio.addEventListener('ended', () => { this._currentAudioEl = null; });
    audio.addEventListener('error', () => { this._currentAudioEl = null; });
    this._currentAudioEl = audio;
    audio.play().catch(() => { this._currentAudioEl = null; });
  }

  updateCrystal(count) {
    document.getElementById('crystal-count').textContent = `💎 ${count}`;
  }

  /**
   * 显示水晶奖励动画（答对时飘出）+ 播放欢呼音效
   */
  showAward() {
    // 播放"叮～"奖励音效
    this.playEffect('✨太棒了！💎');

    const el = document.getElementById('crystal-award');
    if (!el) return;
    el.classList.remove('hidden');
    const particle = document.getElementById('crystal-particle');
    const text = document.getElementById('crystal-text');
    particle.style.animation = 'none';
    text.style.animation = 'none';
    void particle.offsetWidth;
    particle.style.animation = '';
    text.style.animation = '';
    clearTimeout(this._awardTimer);
    this._awardTimer = setTimeout(() => el.classList.add('hidden'), 1300);
  }

  updateStreak(days) {
    document.getElementById('streak-days').textContent = `🔥 ${days}天`;
  }

  updateZone(name) {
    document.getElementById('zone-name').textContent = `🏠 ${name}`;
  }
}