// State Management
let tasks = [];
let totalRelaxHours = 0;

// Added in v2: Timer State
let timerInterval = null;
let timerActive = false;
let timerEndTime = 0;
let timerTotalSeconds = 0;
let selectedTimerMinutes = 0;

// DOM Elements
const taskForm = document.getElementById('add-task-form');
const taskTitleInput = document.getElementById('task-title');
const taskSubjectInput = document.getElementById('task-subject');
const taskDeadlineInput = document.getElementById('task-deadline');
const taskRelaxHoursInput = document.getElementById('task-relax-hours');
const taskListContainer = document.getElementById('task-list-container');
const emptyState = document.getElementById('empty-state');
const activeTaskCountElement = document.getElementById('active-task-count');
const totalRelaxTimeElement = document.getElementById('total-relax-time');

// Added in v2: Timer DOM Elements
const timerCountdown = document.getElementById('timer-countdown');
const timerPresetButtons = document.querySelectorAll('.btn-preset');
const timerToggleBtn = document.getElementById('btn-timer-toggle');

// Default estimated hours multiplier / task helper
const DEFAULT_ESTIMATED_RELAX_HOURS = 4;

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
  // Load data from LocalStorage
  const storedTasks = localStorage.getItem('relaxdue_tasks');
  const storedRelaxHours = localStorage.getItem('relaxdue_total_relax');

  if (storedTasks) {
    tasks = JSON.parse(storedTasks);
  }
  if (storedRelaxHours) {
    totalRelaxHours = parseFloat(storedRelaxHours);
  }

  // Set default deadline to tomorrow same time
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setMinutes(tomorrow.getMinutes() - tomorrow.getTimezoneOffset());
  taskDeadlineInput.value = tomorrow.toISOString().slice(0, 16);

  // Initial UI Render
  updateScoreboard();
  renderTasks();

  // Added in v2: Restore Timer State
  const storedTimerActive = localStorage.getItem('relaxdue_timer_active');
  const storedTimerEndTime = localStorage.getItem('relaxdue_timer_end_time');
  const storedTimerTotalSeconds = localStorage.getItem('relaxdue_timer_total_seconds');

  if (storedTimerActive === 'true' && storedTimerEndTime) {
    const endTime = parseInt(storedTimerEndTime, 10);
    const now = Date.now();
    if (endTime > now) {
      timerActive = true;
      timerEndTime = endTime;
      timerTotalSeconds = parseInt(storedTimerTotalSeconds, 10) || 0;
      document.body.classList.add('relax-mode-active');
      timerToggleBtn.textContent = 'くつろぎをやめる';
      timerToggleBtn.className = 'btn-timer btn-timer-stop';
      timerToggleBtn.disabled = false;
      disablePresets(true);
      startTimerInterval();
    } else {
      clearTimerState();
    }
  } else {
    // Show total relax hours and check toggle validation
    validateTimerLaunch();
  }

  // Added in v2: Setup Timer Events
  initTimerEventListeners();

  // Start real-time countdown timer (every 1 second)
  setInterval(updateAllCountdowns, 1000);
});

// Event Listeners
taskForm.addEventListener('submit', (e) => {
  e.preventDefault();

  const title = taskTitleInput.value.trim();
  const subject = taskSubjectInput.value.trim();
  const deadlineStr = taskDeadlineInput.value;
  const relaxHours = parseInt(taskRelaxHoursInput.value, 10) || DEFAULT_ESTIMATED_RELAX_HOURS;

  if (!title || !subject || !deadlineStr) return;

  const newTask = {
    id: Date.now().toString(),
    title,
    subject,
    deadline: new Date(deadlineStr).toISOString(),
    estimatedHours: relaxHours,
    createdAt: Date.now()
  };

  tasks.push(newTask);
  saveTasks();
  renderTasks();

  // Reset form except defaults
  taskTitleInput.value = '';
  taskSubjectInput.value = '';
  
  // Set next default time
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setMinutes(tomorrow.getMinutes() - tomorrow.getTimezoneOffset());
  taskDeadlineInput.value = tomorrow.toISOString().slice(0, 16);
  taskRelaxHoursInput.value = DEFAULT_ESTIMATED_RELAX_HOURS;
  
  // Animate focus out
  document.activeElement.blur();
});

// Save to LocalStorage
function saveTasks() {
  localStorage.setItem('relaxdue_tasks', JSON.stringify(tasks));
}

function saveRelaxHours() {
  localStorage.setItem('relaxdue_total_relax', totalRelaxHours.toString());
}

// Update Scoreboard UI
function updateScoreboard() {
  // Round to 2 decimal places to handle fractions of hours (e.g. 0.5 hours for 30 mins)
  totalRelaxTimeElement.textContent = Math.round(totalRelaxHours * 100) / 100;
  // Added in v2: Update timer validation when scoreboard changes
  if (!timerActive) {
    validateTimerLaunch();
  }
}

// Format Time Remaining and calculate percentage
function calculateTimeProgress(deadlineISO, createdAtMs) {
  const now = Date.now();
  const target = new Date(deadlineISO).getTime();
  const totalDuration = target - createdAtMs;
  const timeRemaining = target - now;

  // Handle overdue
  if (timeRemaining <= 0) {
    return {
      text: '期限超過！',
      percentage: 100,
      statusClass: 'status-danger',
      bgClass: 'status-danger-bg',
      rawRemaining: timeRemaining
    };
  }

  // Calculate raw units
  const totalSeconds = Math.floor(timeRemaining / 1000);
  const days = Math.floor(totalSeconds / (3600 * 24));
  const hours = Math.floor((totalSeconds % (3600 * 24)) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  let countdownText = '';
  if (days > 0) {
    countdownText = `${days}日 ${hours}時間`;
  } else if (hours > 0) {
    countdownText = `${hours}時間 ${minutes}分`;
  } else {
    countdownText = `${minutes}分 ${seconds}秒`;
  }

  // Visual Progress Calculation (percentage of time elapsed)
  // Clamp between 0% and 100%. If totalDuration is invalid or very short, use default percentage.
  let percentage = 0;
  if (totalDuration > 0) {
    const elapsed = now - createdAtMs;
    percentage = Math.min(100, Math.max(0, (elapsed / totalDuration) * 100));
  } else {
    // Fallback based on remaining hours
    const remainingHours = timeRemaining / (3600 * 1000);
    if (remainingHours > 72) percentage = 10;
    else if (remainingHours > 24) percentage = 50;
    else percentage = 90;
  }

  // Determine severity based on remaining hours
  const remainingHours = timeRemaining / (3600 * 1000);
  let statusClass = 'status-safe';
  let bgClass = 'status-safe-bg';

  if (remainingHours <= 24) {
    statusClass = 'status-danger';
    bgClass = 'status-danger-bg';
  } else if (remainingHours <= 72) {
    statusClass = 'status-warning';
    bgClass = 'status-warning-bg';
  }

  return {
    text: `残り: ${countdownText}`,
    percentage: percentage,
    statusClass,
    bgClass,
    rawRemaining: timeRemaining
  };
}

// Render task list
function renderTasks() {
  // Sort tasks: nearest deadline first
  tasks.sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime());

  // Clear container (keep empty state if needed)
  const taskItems = taskListContainer.querySelectorAll('.task-item');
  taskItems.forEach(item => item.remove());

  activeTaskCountElement.textContent = tasks.length;

  if (tasks.length === 0) {
    emptyState.style.display = 'block';
    return;
  }

  emptyState.style.display = 'none';

  tasks.forEach(task => {
    const progress = calculateTimeProgress(task.deadline, task.createdAt);
    const deadlineFormatted = new Date(task.deadline).toLocaleString('ja-JP', {
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    const taskElement = document.createElement('div');
    taskElement.className = 'task-item';
    taskElement.id = `task-${task.id}`;
    taskElement.dataset.deadline = task.deadline;
    taskElement.dataset.created = task.createdAt;

    taskElement.innerHTML = `
      <div class="task-item-main">
        <div class="task-item-left">
          <label class="checkbox-container">
            <input type="checkbox" onchange="completeTask('${task.id}')">
            <span class="checkmark"></span>
            <div class="task-content">
              <span class="task-title">${escapeHTML(task.title)}</span>
              <div class="task-meta">
                <span class="task-tag">${escapeHTML(task.subject)}</span>
                <span class="task-estimated">🎁 ＋${task.estimatedHours}時間くつろぎ</span>
                <span>📅 締切: ${deadlineFormatted}</span>
              </div>
            </div>
          </label>
        </div>
        <button class="btn-delete" onclick="deleteTask('${task.id}')" title="削除">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor" style="width: 18px; height: 18px;">
            <path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
          </svg>
        </button>
      </div>
      
      <!-- Live Deadline Progress Gauge -->
      <div class="deadline-section">
        <div class="deadline-header">
          <span class="deadline-countdown ${progress.statusClass}">${progress.text}</span>
          <span style="color: var(--color-text-muted)">進行度: ${Math.round(progress.percentage)}%</span>
        </div>
        <div class="gauge-container">
          <div class="gauge-bar ${progress.bgClass}" style="width: ${progress.percentage}%"></div>
        </div>
      </div>
    `;

    taskListContainer.appendChild(taskElement);
  });
}

// Update all countdown elements dynamically without rebuilding the DOM
function updateAllCountdowns() {
  tasks.forEach(task => {
    const taskElement = document.getElementById(`task-${task.id}`);
    if (!taskElement) return;

    const progress = calculateTimeProgress(task.deadline, parseInt(taskElement.dataset.created, 10));

    // Update countdown text & class
    const countdownEl = taskElement.querySelector('.deadline-countdown');
    if (countdownEl) {
      countdownEl.textContent = progress.text;
      // Reset classes
      countdownEl.className = `deadline-countdown ${progress.statusClass}`;
    }

    // Update percentage text
    const percentageTextEl = taskElement.querySelector('.deadline-section .deadline-header span:last-child');
    if (percentageTextEl) {
      percentageTextEl.textContent = `進行度: ${Math.round(progress.percentage)}%`;
    }

    // Update gauge width and background gradient class
    const gaugeBar = taskElement.querySelector('.gauge-bar');
    if (gaugeBar) {
      gaugeBar.style.width = `${progress.percentage}%`;
      // Update background status gradient classes
      gaugeBar.className = `gauge-bar ${progress.bgClass}`;
    }
  });
}

// Complete task with rewards and celebration
window.completeTask = function(taskId) {
  const taskIndex = tasks.findIndex(t => t.id === taskId);
  if (taskIndex === -1) return;

  const completedTask = tasks[taskIndex];
  const rewardHours = completedTask.estimatedHours;

  // 1. Trigger Confetti celebration
  triggerConfetti();

  // 2. Play Sound (Optional, but using elegant Web Audio API for a cool "ding" sound without external assets)
  playElegantChime();

  // 3. Show Premium Banner Pop-up
  showRelaxSuccessBanner(completedTask.title, rewardHours);

  // 4. Animate task removal from DOM
  const taskElement = document.getElementById(`task-${taskId}`);
  if (taskElement) {
    taskElement.classList.add('fade-out');
  }

  // Wait for fade-out animation to complete
  setTimeout(() => {
    // 5. Update State
    totalRelaxHours += rewardHours;
    tasks.splice(taskIndex, 1);

    // 6. Save and re-render
    saveTasks();
    saveRelaxHours();
    updateScoreboard();
    renderTasks();
  }, 300);
};

// Just delete task without rewards
window.deleteTask = function(taskId) {
  const taskIndex = tasks.findIndex(t => t.id === taskId);
  if (taskIndex === -1) return;

  const taskElement = document.getElementById(`task-${taskId}`);
  if (taskElement) {
    taskElement.classList.add('fade-out');
  }

  setTimeout(() => {
    tasks.splice(taskIndex, 1);
    saveTasks();
    renderTasks();
  }, 300);
};

// Canvas Confetti Trigger
function triggerConfetti() {
  if (typeof confetti === 'function') {
    // First burst
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 }
    });

    // Side bursts after 150ms
    setTimeout(() => {
      confetti({
        particleCount: 50,
        angle: 60,
        spread: 55,
        origin: { x: 0 }
      });
      confetti({
        particleCount: 50,
        angle: 120,
        spread: 55,
        origin: { x: 1 }
      });
    }, 150);
  }
}

// Web Audio API Synthesizer Chime
function playElegantChime() {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    
    // Cool double chime (Arpeggio)
    const playNote = (frequency, startTime, duration) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      
      osc.type = 'triangle'; // Smooth retro/modern synth chime
      osc.frequency.setValueAtTime(frequency, startTime);
      
      gain.gain.setValueAtTime(0.15, startTime);
      // Linear decay
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
      
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      
      osc.start(startTime);
      osc.stop(startTime + duration);
    };

    const now = audioCtx.currentTime;
    playNote(523.25, now, 0.4); // C5
    playNote(659.25, now + 0.08, 0.5); // E5
    playNote(783.99, now + 0.16, 0.6); // G5
    playNote(1046.50, now + 0.24, 0.8); // C6
  } catch (e) {
    console.log('Audio Context not allowed or supported yet', e);
  }
}

// Show premium modal/banner when task is completed
function showRelaxSuccessBanner(taskTitle, rewardHours) {
  // Remove existing banner if any
  const existingBanner = document.querySelector('.relax-banner');
  if (existingBanner) existingBanner.remove();

  const banner = document.createElement('div');
  banner.className = 'relax-banner glass-card';
  
  banner.innerHTML = `
    <div class="relax-banner-icon">
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" style="width: 20px; height: 20px;">
        <path stroke-linecap="round" stroke-linejoin="round" d="M15.182 15.182a4.5 4.5 0 01-6.364 0M21 12a9 9 0 11-18 0 9 9 0 0118 0zM9.75 9.75c0 .414-.168.75-.375.75S9 10.164 9 9.75 9.168 9 9.375 9s.375.336.375.75zm-.375 0h.008v.015h-.008V9.75zm5.625 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75zm-.375 0h.008v.015h-.008V9.75z" />
      </svg>
    </div>
    <div class="relax-banner-content">
      <h3>🎉 お疲れ様でした！</h3>
      <p>「${escapeHTML(taskTitle)}」を無事に完了しました！</p>
      <p style="font-weight: 600; color: #06b6d4; margin-top: 0.25rem;">🎁 罪悪感ゼロのくつろぎ時間 <strong>【＋${rewardHours}時間】</strong> チャージ完了！</p>
    </div>
    <button class="btn-close-banner" onclick="this.parentElement.remove()">
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor" style="width: 16px; height: 16px;">
        <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
      </svg>
    </button>
  `;

  document.body.appendChild(banner);

  // Auto-remove banner after 6 seconds
  setTimeout(() => {
    if (banner && banner.parentElement) {
      banner.classList.add('fade-out');
      setTimeout(() => banner.remove(), 300);
    }
  }, 6000);
}

// Simple HTML escaping helper
function escapeHTML(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/* ==========================================
   Relax Timer Features (Added in v2)
   ========================================== */

function initTimerEventListeners() {
  // Preset Buttons Click Handler
  timerPresetButtons.forEach(button => {
    button.addEventListener('click', () => {
      if (timerActive) return;

      // Remove active class from all
      timerPresetButtons.forEach(btn => btn.classList.remove('active'));

      // Add active to current
      button.classList.add('active');

      // Set selected minutes
      selectedTimerMinutes = parseInt(button.dataset.minutes, 10);
      
      // Update countdown display
      const totalSeconds = selectedTimerMinutes * 60;
      timerCountdown.textContent = formatTime(totalSeconds);
      
      // Validate launch button
      validateTimerLaunch();
    });
  });

  // Start / Stop Toggle Button
  timerToggleBtn.addEventListener('click', () => {
    if (timerActive) {
      // Stop the timer manually (no alarm, no penalty return)
      stopTimer(false);
    } else {
      // Start the timer
      startTimer();
    }
  });
}

function validateTimerLaunch() {
  if (timerActive) return;

  const currentAvailableHours = totalRelaxHours;
  let hasValidPreset = false;

  timerPresetButtons.forEach(button => {
    const presetMinutes = parseInt(button.dataset.minutes, 10);
    const presetHours = presetMinutes / 60;

    if (presetHours <= currentAvailableHours) {
      button.disabled = false;
      if (button.classList.contains('active')) {
        hasValidPreset = true;
      }
    } else {
      button.disabled = true;
      button.classList.remove('active');
    }
  });

  // Check if we still have a selected valid preset
  if (hasValidPreset && selectedTimerMinutes > 0) {
    timerToggleBtn.disabled = false;
  } else {
    timerToggleBtn.disabled = true;
    // Reset timer countdown display if no active selection
    timerCountdown.textContent = '00:00:00';
    selectedTimerMinutes = 0;
  }
}

function disablePresets(disabled) {
  timerPresetButtons.forEach(button => {
    button.disabled = disabled;
  });
}

function startTimer() {
  if (selectedTimerMinutes <= 0) return;
  const costHours = selectedTimerMinutes / 60;

  if (totalRelaxHours < costHours) {
    alert('くつろぎ時間が不足しています！');
    return;
  }

  // 1. Spend hours
  totalRelaxHours -= costHours;
  saveRelaxHours();
  updateScoreboard();

  // 2. Set Timer State
  timerActive = true;
  timerTotalSeconds = selectedTimerMinutes * 60;
  timerEndTime = Date.now() + (timerTotalSeconds * 1000);

  // 3. Save Timer to LocalStorage
  localStorage.setItem('relaxdue_timer_active', 'true');
  localStorage.setItem('relaxdue_timer_end_time', timerEndTime.toString());
  localStorage.setItem('relaxdue_timer_total_seconds', timerTotalSeconds.toString());

  // 4. Update UI
  document.body.classList.add('relax-mode-active');
  timerToggleBtn.textContent = 'くつろぎをやめる';
  timerToggleBtn.className = 'btn-timer btn-timer-stop';
  disablePresets(true);

  // 5. Start Interval
  startTimerInterval();
}

function startTimerInterval() {
  if (timerInterval) clearInterval(timerInterval);

  updateTimerCountdown(); // Initial call
  timerInterval = setInterval(updateTimerCountdown, 1000);
}

function updateTimerCountdown() {
  const now = Date.now();
  const remainingMs = timerEndTime - now;

  if (remainingMs <= 0) {
    // Timer finished successfully!
    stopTimer(true);
    return;
  }

  const remainingSeconds = Math.ceil(remainingMs / 1000);
  timerCountdown.textContent = formatTime(remainingSeconds);
}

function stopTimer(completedSuccessfully = false) {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }

  // Reset UI State
  document.body.classList.remove('relax-mode-active');
  timerToggleBtn.textContent = 'タイマー開始';
  timerToggleBtn.className = 'btn-timer btn-timer-start';
  timerCountdown.textContent = '00:00:00';
  
  // Remove active styling on preset buttons
  timerPresetButtons.forEach(btn => btn.classList.remove('active'));

  timerActive = false;
  selectedTimerMinutes = 0;

  // Clear LocalStorage Timer data
  clearTimerState();

  if (completedSuccessfully) {
    // Celebrate successful relaxation
    playTimerEndChime();
    showRelaxCompletedOverlay();
  }

  // Refresh launch availability
  validateTimerLaunch();
}

function clearTimerState() {
  localStorage.removeItem('relaxdue_timer_active');
  localStorage.removeItem('relaxdue_timer_end_time');
  localStorage.removeItem('relaxdue_timer_total_seconds');
}

function formatTime(totalSeconds) {
  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;

  return [
    hrs.toString().padStart(2, '0'),
    mins.toString().padStart(2, '0'),
    secs.toString().padStart(2, '0')
  ].join(':');
}

// Synthesis of soft chime indicating time to wrap up resting
function playTimerEndChime() {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const now = audioCtx.currentTime;

    const playTone = (freq, time, duration, vol) => {
      const osc = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, time);
      
      gainNode.gain.setValueAtTime(vol, time);
      gainNode.gain.exponentialRampToValueAtTime(0.001, time + duration);

      osc.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      osc.start(time);
      osc.stop(time + duration);
    };

    // Soft alarm arpeggio (C Major Seventh)
    playTone(261.63, now, 0.6, 0.1);       // C4
    playTone(329.63, now + 0.15, 0.6, 0.1); // E4
    playTone(392.00, now + 0.3, 0.6, 0.1);  // G4
    playTone(493.88, now + 0.45, 1.0, 0.1); // B4
  } catch (e) {
    console.warn('Audio Context failed', e);
  }
}

// Overlay banner showing relaxing complete info
function showRelaxCompletedOverlay() {
  const existingOverlay = document.querySelector('.relax-overlay');
  if (existingOverlay) existingOverlay.remove();

  const overlay = document.createElement('div');
  overlay.className = 'relax-banner glass-card relax-overlay';
  overlay.style.borderColor = '#06b6d4';
  
  overlay.innerHTML = `
    <div class="relax-banner-icon" style="background: rgba(6, 182, 212, 0.2); color: #06b6d4;">
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" style="width: 20px; height: 20px;">
        <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
      </svg>
    </div>
    <div class="relax-banner-content">
      <h3>⚡ リフレッシュ完了！</h3>
      <p>罪悪感ゼロの極上くつろぎタイムが終了しました。</p>
      <p style="font-weight: 600; color: #a855f7; margin-top: 0.25rem;">さあ、次の課題もサクッと終わらせましょう！</p>
    </div>
    <button class="btn-close-banner" onclick="this.parentElement.remove()">
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor" style="width: 16px; height: 16px;">
        <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
      </svg>
    </button>
  `;

  document.body.appendChild(overlay);

  // Auto-remove overlay after 8 seconds
  setTimeout(() => {
    if (overlay && overlay.parentElement) {
      overlay.classList.add('fade-out');
      setTimeout(() => overlay.remove(), 300);
    }
  }, 8000);
}
