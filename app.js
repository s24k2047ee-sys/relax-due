// State Management
let tasks = [];
let totalRelaxHours = 0;
// Added in v4: Cumulative Achievements State
let totalCompletedTasks = 0;
let cumulativeRelaxHours = 0;

// Supabase Config & State
const SUPABASE_URL = 'https://hbmantmeqtmrhggyabbp.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_p4okasZ0tp7Ljh6zJlwqxQ_DgEVnIk4';
let supabase = null;
let currentUser = null;
let isSyncing = false;

// DOM Elements for Auth
let authModal, btnCloudSync, btnAuthClose, authForm, authEmailInput, authPasswordInput, authErrorMsg;
let btnLoginSubmit, btnSignupSubmit, btnLogout, authProfileSection, authUserEmail, syncStatusText;

// Added in v2: Timer State
let timerInterval = null;
let timerActive = false;
let timerEndTime = 0;
let timerTotalSeconds = 0;
let selectedTimerMinutes = 0;

// DOM Elements (Assigned on DOMContentLoaded)
let taskForm, taskTitleInput, taskSubjectInput, taskDeadlineInput, taskRelaxHoursInput;
let taskListContainer, emptyState, activeTaskCountElement, totalRelaxTimeElement;
let timerCountdown, timerPresetButtons, timerToggleBtn, taskAiSplitInput;
// Added in v4: Achievement DOM Elements
let totalCompletedTasksElement, cumulativeRelaxTimeElement;

// Default estimated hours multiplier / task helper
const DEFAULT_ESTIMATED_RELAX_HOURS = 4;

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements Assignment
  taskForm = document.getElementById('add-task-form');
  taskTitleInput = document.getElementById('task-title');
  taskSubjectInput = document.getElementById('task-subject');
  taskDeadlineInput = document.getElementById('task-deadline');
  taskRelaxHoursInput = document.getElementById('task-relax-hours');
  taskListContainer = document.getElementById('task-list-container');
  emptyState = document.getElementById('empty-state');
  activeTaskCountElement = document.getElementById('active-task-count');
  totalRelaxTimeElement = document.getElementById('total-relax-time');
  timerCountdown = document.getElementById('timer-countdown');
  timerPresetButtons = document.querySelectorAll('.btn-preset');
  timerToggleBtn = document.getElementById('btn-timer-toggle');
  taskAiSplitInput = document.getElementById('task-ai-split');
  // Added in v4: Achievement DOM
  totalCompletedTasksElement = document.getElementById('total-completed-tasks');
  cumulativeRelaxTimeElement = document.getElementById('cumulative-relax-time');

  // Initialize Supabase Client
  try {
    if (typeof window.supabase !== 'undefined') {
      supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    } else {
      console.warn('Supabase SDK not loaded.');
    }
  } catch (err) {
    console.error('Supabase client initialization failed:', err);
    alert('Supabase初期化エラー: ' + err.message);
  }

  // Get Auth DOM elements
  authModal = document.getElementById('auth-modal');
  btnCloudSync = document.getElementById('btn-cloud-sync');
  btnAuthClose = document.getElementById('btn-auth-close');
  authForm = document.getElementById('auth-form');
  authEmailInput = document.getElementById('auth-email');
  authPasswordInput = document.getElementById('auth-password');
  authErrorMsg = document.getElementById('auth-error-msg');
  btnLoginSubmit = document.getElementById('btn-login-submit');
  btnSignupSubmit = document.getElementById('btn-signup-submit');
  btnLogout = document.getElementById('btn-logout');
  authProfileSection = document.getElementById('auth-profile-section');
  authUserEmail = document.getElementById('auth-user-email');
  syncStatusText = document.getElementById('sync-status-text');

  // Setup Auth Listeners
  if (btnCloudSync) btnCloudSync.addEventListener('click', openAuthModal);
  if (btnAuthClose) btnAuthClose.addEventListener('click', closeAuthModal);
  if (authForm) authForm.addEventListener('submit', handleLogin);
  if (btnSignupSubmit) btnSignupSubmit.addEventListener('click', handleSignup);
  if (btnLogout) btnLogout.addEventListener('click', handleLogout);

  // Monitor Supabase Auth state
  try {
    if (supabase) {
      supabase.auth.onAuthStateChange((event, session) => {
        if (session) {
          currentUser = session.user;
          updateAuthUI(true);
          syncDataFromCloud();
        } else {
          currentUser = null;
          updateAuthUI(false);
        }
      });
    }
  } catch (err) {
    console.error('Supabase auth state monitoring failed:', err);
    alert('Supabase認証監視エラー: ' + err.message);
  }

  // Load data from LocalStorage
  const storedTasks = localStorage.getItem('relaxdue_tasks');
  const storedRelaxHours = localStorage.getItem('relaxdue_total_relax');
  // Added in v4: Load Cumulative Achievements
  const storedCompletedCount = localStorage.getItem('relaxdue_completed_count');
  const storedCumulativeRelax = localStorage.getItem('relaxdue_cumulative_relax');

  if (storedTasks) {
    tasks = JSON.parse(storedTasks);
  }
  if (storedRelaxHours) {
    totalRelaxHours = parseFloat(storedRelaxHours);
  }
  if (storedCompletedCount) {
    totalCompletedTasks = parseInt(storedCompletedCount, 10);
  }
  if (storedCumulativeRelax) {
    cumulativeRelaxHours = parseFloat(storedCumulativeRelax);
  }

  // Set default deadline to tomorrow same time
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setMinutes(tomorrow.getMinutes() - tomorrow.getTimezoneOffset());
  if (taskDeadlineInput) {
    taskDeadlineInput.value = tomorrow.toISOString().slice(0, 16);
  }

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
      if (timerToggleBtn) {
        timerToggleBtn.textContent = 'くつろぎをやめる';
        timerToggleBtn.className = 'btn-timer btn-timer-stop';
        timerToggleBtn.disabled = false;
      }
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

  // Setup Form Submit Listener
  if (taskForm) {
    taskForm.addEventListener('submit', handleFormSubmit);
  }

  // Start real-time countdown timer (every 1 second)
  setInterval(updateAllCountdowns, 1000);

  // Setup Mobile Tab Navigation
  initMobileTabNavigation();
});

// Setup Mobile Tab Navigation Event Listeners
function initMobileTabNavigation() {
  const navItems = document.querySelectorAll('.nav-item');
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const tabName = item.dataset.tab;
      switchTab(tabName);
    });
  });
}

// Global Tab Switching Logic
window.switchTab = function(tabName) {
  // 1. Update active states on tab buttons
  const navItems = document.querySelectorAll('.nav-item');
  navItems.forEach(item => {
    if (item.dataset.tab === tabName) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });

  // 2. Update active states on tab contents
  const tabContents = document.querySelectorAll('.tab-content');
  tabContents.forEach(content => {
    if (content.id === `tab-content-${tabName}`) {
      content.classList.add('active');
    } else {
      content.classList.remove('active');
    }
  });
};

// Event Listeners - Form Submit Handler
async function handleFormSubmit(e) {
  e.preventDefault();

  const title = taskTitleInput.value.trim();
  const subject = taskSubjectInput.value.trim();
  const deadlineStr = taskDeadlineInput.value;
  const relaxHours = parseFloat(taskRelaxHoursInput.value) || DEFAULT_ESTIMATED_RELAX_HOURS;
  const useAiSplit = taskAiSplitInput ? taskAiSplitInput.checked : false;

  if (!title || !subject || !deadlineStr) return;

  // Disable submit button during processing
  const submitBtn = taskForm.querySelector('button[type="submit"]');
  if (submitBtn) submitBtn.disabled = true;

  let subtasks = [];

  if (useAiSplit) {
    // Show AI Thinking loader in the task list
    showAiThinkingLoader(title);
    
    // Simulate AI thinking delay (1.8 seconds)
    await new Promise(resolve => setTimeout(resolve, 1800));
    
    // Generate subtasks using the rule-based AI engine
    subtasks = generateAiSubtasks(title, subject, relaxHours);
  }

  const newTask = {
    id: Date.now().toString(),
    title,
    subject,
    deadline: new Date(deadlineStr).toISOString(),
    estimatedHours: relaxHours,
    createdAt: Date.now(),
    subtasks: subtasks,
    isAiSplit: useAiSplit,
    expanded: false
  };

  tasks.push(newTask);
  saveTasks();
  renderTasks();

  // Reset form except defaults
  taskTitleInput.value = '';
  taskSubjectInput.value = '';
  if (taskAiSplitInput) taskAiSplitInput.checked = true;
  if (submitBtn) submitBtn.disabled = false;
  
  // Set next default time
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setMinutes(tomorrow.getMinutes() - tomorrow.getTimezoneOffset());
  if (taskDeadlineInput) {
    taskDeadlineInput.value = tomorrow.toISOString().slice(0, 16);
  }
  if (taskRelaxHoursInput) {
    taskRelaxHoursInput.value = DEFAULT_ESTIMATED_RELAX_HOURS;
  }
  
  // Animate focus out
  document.activeElement.blur();

  // If on mobile view, switch back to task list tab after adding a task
  if (window.innerWidth <= 768) {
    switchTab('tasks');
  }
}

// Save to LocalStorage & Cloud (if logged in)
function saveTasks() {
  localStorage.setItem('relaxdue_tasks', JSON.stringify(tasks));
  triggerCloudUpload();
}

function saveRelaxHours() {
  localStorage.setItem('relaxdue_total_relax', totalRelaxHours.toString());
  triggerCloudUpload();
}

// Added in v4: Save Cumulative Achievements
function saveCompletedCount() {
  localStorage.setItem('relaxdue_completed_count', totalCompletedTasks.toString());
  triggerCloudUpload();
}

function saveCumulativeRelax() {
  localStorage.setItem('relaxdue_cumulative_relax', cumulativeRelaxHours.toString());
  triggerCloudUpload();
}

// Debounce helper to prevent multiple rapid database requests
let uploadTimeout = null;
function triggerCloudUpload() {
  if (!supabase || !currentUser) return;
  
  if (uploadTimeout) clearTimeout(uploadTimeout);
  uploadTimeout = setTimeout(() => {
    uploadDataToCloud(tasks, totalRelaxHours, totalCompletedTasks, cumulativeRelaxHours);
  }, 1000);
}

// Update Scoreboard UI
function updateScoreboard() {
  // Round to 2 decimal places to handle fractions of hours (e.g. 0.5 hours for 30 mins)
  totalRelaxTimeElement.textContent = Math.round(totalRelaxHours * 100) / 100;
  
  // Added in v4: Render cumulative achievements
  if (totalCompletedTasksElement) {
    totalCompletedTasksElement.textContent = totalCompletedTasks;
  }
  if (cumulativeRelaxTimeElement) {
    cumulativeRelaxTimeElement.textContent = Math.round(cumulativeRelaxHours * 100) / 100;
  }

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

    // Initialize subtasks array if undefined (backward compatibility)
    if (!task.subtasks) {
      task.subtasks = [];
    }

    const hasSubtasks = task.subtasks.length > 0;
    const allSubtasksCompleted = hasSubtasks && task.subtasks.every(st => st.completed);

    // Generate Subtasks HTML (Always generate container in v4 so we can add manual subtasks)
    let subtasksHTML = `<div class="subtask-list" id="subtask-list-${task.id}">`;
    task.subtasks.forEach(subtask => {
      subtasksHTML += `
        <div class="subtask-item" id="subtask-${task.id}-${subtask.id}">
          <label class="subtask-label">
            <input type="checkbox" ${subtask.completed ? 'checked' : ''} onchange="toggleSubtask('${task.id}', '${subtask.id}')">
            <span class="subtask-text">${escapeHTML(subtask.text)}</span>
          </label>
          <div style="display: flex; align-items: center;">
            <span class="subtask-reward">🎁 ＋${Math.round(subtask.rewardHours * 100) / 100}時間</span>
            <button class="btn-subtask-delete" onclick="deleteSubtask('${task.id}', '${subtask.id}')" title="サブタスクを削除">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" style="width: 12px; height: 12px;">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      `;
    });

    // Inline Add Subtask Input Form
    subtasksHTML += `
      <div class="subtask-add-container">
        <input type="text" class="subtask-add-input" id="subtask-add-input-${task.id}" placeholder="＋ サブタスクを手動で追加..." autocomplete="off">
        <button class="btn-subtask-add" onclick="addSubtask('${task.id}')">追加</button>
      </div>
    `;
    subtasksHTML += `</div>`;

    const isExpanded = task.expanded === true;
    const taskElement = document.createElement('div');
    taskElement.className = `task-item${isExpanded ? ' expanded' : ''}`;
    taskElement.id = `task-${task.id}`;
    taskElement.dataset.deadline = task.deadline;
    taskElement.dataset.created = task.createdAt;

    taskElement.innerHTML = `
      <div class="task-item-main" onclick="toggleExpandTask('${task.id}', event)" style="cursor: pointer;">
        <div class="task-item-left" style="display: flex; align-items: flex-start; gap: 1rem;">
          <label class="checkbox-container" style="margin-top: 2px;">
            <input type="checkbox" ${hasSubtasks ? 'disabled' : `onchange="completeTask('${task.id}')"`} ${allSubtasksCompleted ? 'checked' : ''}>
            <span class="checkmark"></span>
          </label>
          <div class="task-content">
            <span class="task-title">${escapeHTML(task.title)}</span>
            <div class="task-meta">
              ${task.isAiSplit ? '<span class="ai-badge">✨ AI分解</span>' : ''}
              <span class="task-tag">${escapeHTML(task.subject)}</span>
              <span class="task-estimated">🎁 ＋${task.estimatedHours}時間くつろぎ</span>
              <span>📅 締切: ${deadlineFormatted}</span>
            </div>
          </div>
        </div>
        <div class="task-item-actions" style="display: flex; align-items: center; gap: 0.25rem;">
          <button class="btn-toggle-expand" type="button" title="詳細を開閉" style="pointer-events: none;">
            <svg class="arrow-icon ${isExpanded ? 'rotated' : ''}" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" style="width: 16px; height: 16px;">
              <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
            </svg>
          </button>
          <button class="btn-delete" onclick="deleteTask('${task.id}')" title="削除">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor" style="width: 18px; height: 18px;">
              <path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
            </svg>
          </button>
        </div>
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

      <!-- Nested Subtasks Container (v4) -->
      ${subtasksHTML}
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
  const isAiSplit = completedTask.subtasks && completedTask.subtasks.length > 0;
  
  // If it has subtasks, it was already rewarded incrementally.
  const rewardHours = isAiSplit ? 0 : completedTask.estimatedHours;

  // 1. Trigger Confetti celebration
  triggerConfetti();

  // 2. Play Sound (Optional, but using elegant Web Audio API for a cool "ding" sound without external assets)
  playElegantChime();

  // 3. Show Premium Banner Pop-up
  showRelaxSuccessBanner(completedTask.title, completedTask.estimatedHours, isAiSplit);

  // 4. Animate task removal from DOM
  const taskElement = document.getElementById(`task-${taskId}`);
  if (taskElement) {
    taskElement.classList.add('fade-out');
  }

  // Wait for fade-out animation to complete
  setTimeout(() => {
    // 5. Update State
    totalRelaxHours += rewardHours;

    // Added in v4: Increment cumulative achievements
    totalCompletedTasks += 1;
    cumulativeRelaxHours += completedTask.estimatedHours;

    tasks.splice(taskIndex, 1);

    // 6. Save and re-render
    saveTasks();
    saveRelaxHours();
    saveCompletedCount();
    saveCumulativeRelax();
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
function showRelaxSuccessBanner(taskTitle, rewardHours, isAiSplit = false) {
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
      <p style="font-weight: 600; color: #06b6d4; margin-top: 0.25rem;">
        ${isAiSplit ? `🎁 全ステップ完了！合計 <strong>【${rewardHours}時間】</strong> のくつろぎ時間を獲得しました！` : `🎁 罪悪感ゼロのくつろぎ時間 <strong>【＋${rewardHours}時間】</strong> チャージ完了！`}
      </p>
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

/* ==========================================
   AI Subtask Features (Added in v3)
   ========================================== */

// Show the AI Loader Card temporarily in the task list
function showAiThinkingLoader(taskTitle) {
  // If there's an empty state, hide it
  emptyState.style.display = 'none';

  const loaderCard = document.createElement('div');
  loaderCard.className = 'task-item ai-thinking-card';
  loaderCard.id = 'ai-thinking-loader';

  loaderCard.innerHTML = `
    <div class="ai-thinking-title">
      <svg class="sparkle-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" style="width: 20px; height: 20px; color: #a855f7;">
        <path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904L9 21L8.188 15.904L3 15L8.188 14.096L9 9L9.813 14.096L15 15L9.813 15.904Z" />
        <path stroke-linecap="round" stroke-linejoin="round" d="M19.071 4.929a10 10 0 00-14.142 0M19.071 4.929a10 10 0 010 14.142" />
      </svg>
      <span>AI自動分解アシスタント起動中...</span>
    </div>
    <div class="ai-thinking-steps" id="ai-thinking-step-text">課題「${escapeHTML(taskTitle)}」を解析しています...</div>
  `;

  // Prepend to list
  taskListContainer.insertBefore(loaderCard, taskListContainer.firstChild);

  // Animate AI thinking steps
  const steps = [
    '課題の難易度とボリュームを評価しています...',
    '最適なステップへの細分化（サブタスク化）を設計しています...',
    'ご褒美くつろぎ時間の均等配分を計算しています...',
    '完了！まもなく展開します...'
  ];

  let stepIdx = 0;
  const stepInterval = setInterval(() => {
    const textEl = document.getElementById('ai-thinking-step-text');
    if (textEl && stepIdx < steps.length) {
      textEl.textContent = steps[stepIdx];
      stepIdx++;
    } else {
      clearInterval(stepInterval);
    }
  }, 450);
}

// AI Subtask Generator Agent
function generateAiSubtasks(title, subject, totalHours) {
  const titleLower = title.toLowerCase();
  
  let steps = [];

  // Match keywords to produce context-rich subtasks
  if (titleLower.includes('レポート') || titleLower.includes('作文') || titleLower.includes('論文') || titleLower.includes('文筆')) {
    steps = [
      '課題要件と指定文字数を確認し、参考文献・資料を収集する',
      'レポート全体の構成設計（章立て・目次）を作成する',
      '導入部と本論（メインとなる主張）を執筆する',
      '結論を執筆し、全体の誤字脱字チェック・推敲を完了する'
    ];
  } else if (titleLower.includes('web3') || titleLower.includes('ai') || titleLower.includes('ブロックチェーン') || titleLower.includes('コントラクト')) {
    steps = [
      'Web3・AIに関する基本概念や技術的特徴の背景情報を整理する',
      '解決したい具体的問題の設定とシステム構成案を設計する',
      'プロトタイプの作成（モックアップUIまたは基本コードの記述）',
      '課題のまとめレポート執筆と提出物のパッケージング'
    ];
  } else if (titleLower.includes('プログラミング') || titleLower.includes('実装') || titleLower.includes('開発') || titleLower.includes('コード') || titleLower.includes('アプリ')) {
    steps = [
      'アプリケーションの機能要件定義と画面設計図の作成',
      '基本フォルダ構造・設定ファイルの準備と画面UIフレームの構築',
      'メインロジックおよびコアロジックのコーディング実装',
      '動作テスト・デバッグによるバグ修正と検証完了'
    ];
  } else if (titleLower.includes('数学') || titleLower.includes('計算') || titleLower.includes('解析') || titleLower.includes('物理') || titleLower.includes('演習') || titleLower.includes('課題')) {
    steps = [
      '公式や授業ノートから該当分野の基本定理を再学習する',
      '大問（課題）の前半部分の解答・計算式作成',
      '大問（課題）の後半部分의解答・計算式作成',
      '解答全体の検算・最終書き起こしと見直しの完了'
    ];
  } else if (titleLower.includes('英語') || titleLower.includes('読書') || titleLower.includes('翻訳') || titleLower.includes('語学') || titleLower.includes('精読')) {
    steps = [
      '指定範囲のテキストを辞書を使いながら精読する',
      '重要イディオムや専門用語の整理・単語リスト作成',
      '要約文または翻訳ノートのドラフト作成',
      '全体の日本語表現の推敲および振り返り'
    ];
  } else {
    // Default fallback steps
    steps = [
      '課題の達成目標を明確にし、本日の作業計画を立てる',
      '課題に必要な情報収集・下調べ・資料の整理を行う',
      '課題のメインとなる作業（執筆や解答作成など）を実行する',
      '完成したものの最終推敲と、ポータルへの提出準備の完了'
    ];
  }

  // Calculate split hours reward (evenly divided)
  const count = steps.length;
  const rewardPerSubtask = totalHours / count;

  return steps.map((stepText, idx) => ({
    id: `st-${Date.now()}-${idx}`,
    text: stepText,
    completed: false,
    rewardHours: rewardPerSubtask
  }));
}

// Toggle nested subtask check state
window.toggleSubtask = function(taskId, subtaskId) {
  const taskIndex = tasks.findIndex(t => t.id === taskId);
  if (taskIndex === -1) return;

  const task = tasks[taskIndex];
  const subtaskIndex = task.subtasks.findIndex(st => st.id === subtaskId);
  if (subtaskIndex === -1) return;

  const subtask = task.subtasks[subtaskIndex];
  const originalState = subtask.completed;
  subtask.completed = !originalState;

  if (subtask.completed) {
    // 1. Reward user with fractional hours immediately
    totalRelaxHours += subtask.rewardHours;
    saveRelaxHours();
    updateScoreboard();

    // 2. Play mini celebration sound (Web Audio API single high chime)
    playMiniChime();

    // 3. Mini confetti spark
    triggerMiniConfetti();
  } else {
    // Deduct reward if unchecked (undo action)
    totalRelaxHours = Math.max(0, totalRelaxHours - subtask.rewardHours);
    saveRelaxHours();
    updateScoreboard();
  }

  // Save changes
  saveTasks();

  // Check if all subtasks are now completed
  const allCompleted = task.subtasks.every(st => st.completed);
  if (allCompleted) {
    // Wait a brief moment to complete task for smooth animation
    setTimeout(() => {
      completeTask(taskId);
    }, 500);
  } else {
    // Re-render to reflect checked visual state
    renderTasks();
  }
};

// Simple retro high chime for small subtask completes
function playMiniChime() {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const now = audioCtx.currentTime;
    
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(880, now); // A5 (high note)
    
    gainNode.gain.setValueAtTime(0.1, now);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    osc.start(now);
    osc.stop(now + 0.3);
  } catch(e) {
    console.log(e);
  }
}

// Sparkly mini confetti for subtasks
function triggerMiniConfetti() {
  if (typeof confetti === 'function') {
    confetti({
      particleCount: 20,
      angle: 90,
      spread: 30,
      origin: { y: 0.8 },
      colors: ['#a855f7', '#6366f1', '#06b6d4']
    });
  }
}

// Added in v4: Manually add a subtask to a task
window.addSubtask = function(taskId) {
  const taskIndex = tasks.findIndex(t => t.id === taskId);
  if (taskIndex === -1) return;

  const task = tasks[taskIndex];
  const inputEl = document.getElementById(`subtask-add-input-${taskId}`);
  if (!inputEl) return;

  const subtaskText = inputEl.value.trim();
  if (!subtaskText) return;

  // Initialize subtasks array if undefined
  if (!task.subtasks) {
    task.subtasks = [];
  }

  // Create new subtask (default reward: 0.5 hours)
  const defaultSubtaskReward = 0.5;
  const newSubtask = {
    id: `st-${Date.now()}-${task.subtasks.length}`,
    text: subtaskText,
    completed: false,
    rewardHours: defaultSubtaskReward
  };

  task.subtasks.push(newSubtask);
  
  // Update parent task's total reward estimation
  task.estimatedHours = (parseFloat(task.estimatedHours) || 0) + defaultSubtaskReward;

  // Save changes & render
  saveTasks();
  renderTasks();
};

// Added in v4: Manually delete a subtask from a task
window.deleteSubtask = function(taskId, subtaskId) {
  const taskIndex = tasks.findIndex(t => t.id === taskId);
  if (taskIndex === -1) return;

  const task = tasks[taskIndex];
  if (!task.subtasks) return;

  const subtaskIndex = task.subtasks.findIndex(st => st.id === subtaskId);
  if (subtaskIndex === -1) return;

  const subtask = task.subtasks[subtaskIndex];

  // If the subtask was already completed, deduct the reward from totalRelaxHours
  if (subtask.completed) {
    totalRelaxHours = Math.max(0, totalRelaxHours - (parseFloat(subtask.rewardHours) || 0));
    saveRelaxHours();
    updateScoreboard();
  }

  // Deduct the reward from the parent task's total estimated hours
  task.estimatedHours = Math.max(0, (parseFloat(task.estimatedHours) || 0) - (parseFloat(subtask.rewardHours) || 0));

  // Remove the subtask
  task.subtasks.splice(subtaskIndex, 1);

  // Save changes & render
  saveTasks();
  renderTasks();
};

// Toggle task item expanded state (mobile responsive)
window.toggleExpandTask = function(taskId, event) {
  // Prevent expanding when clicking interactive elements
  if (event) {
    const target = event.target;
    if (target.tagName.toLowerCase() === 'input' || 
        target.closest('input') ||
        target.closest('.checkmark') || 
        target.closest('.checkbox-container') ||
        target.closest('.btn-delete') || 
        target.closest('.btn-subtask-delete') || 
        target.closest('.subtask-add-container')) {
      return;
    }
  }

  const taskIndex = tasks.findIndex(t => t.id === taskId);
  if (taskIndex === -1) return;

  const task = tasks[taskIndex];
  task.expanded = !task.expanded;
  saveTasks();

  const taskElement = document.getElementById(`task-${taskId}`);
  if (taskElement) {
    const arrowIcon = taskElement.querySelector('.arrow-icon');
    if (task.expanded) {
      taskElement.classList.add('expanded');
      if (arrowIcon) arrowIcon.classList.add('rotated');
    } else {
      taskElement.classList.remove('expanded');
      if (arrowIcon) arrowIcon.classList.remove('rotated');
    }
  }
};

/* ==========================================
   Supabase Authentication & Cloud Sync
   ========================================== */

function openAuthModal() {
  if (authModal) {
    authModal.style.display = 'flex';
    if (authErrorMsg) authErrorMsg.style.display = 'none';
  }
}

function closeAuthModal() {
  if (authModal) {
    authModal.style.display = 'none';
  }
}

function updateAuthUI(loggedIn) {
  if (loggedIn && currentUser) {
    if (syncStatusText) {
      syncStatusText.textContent = '同期中';
      syncStatusText.style.color = '#a855f7';
    }
    if (authProfileSection) authProfileSection.style.display = 'block';
    if (authForm) authForm.style.display = 'none';
    if (authUserEmail) authUserEmail.textContent = currentUser.email;
    const syncIcon = document.querySelector('.sync-icon');
    if (syncIcon) {
      syncIcon.textContent = '👤';
      syncIcon.classList.add('syncing');
    }
  } else {
    if (syncStatusText) {
      syncStatusText.textContent = 'ログインして同期';
      syncStatusText.style.color = 'var(--color-text-secondary)';
    }
    if (authProfileSection) authProfileSection.style.display = 'none';
    if (authForm) authForm.style.display = 'block';
    const syncIcon = document.querySelector('.sync-icon');
    if (syncIcon) {
      syncIcon.textContent = '☁️';
      syncIcon.classList.remove('syncing');
    }
  }
}

async function handleLogin(e) {
  e.preventDefault();
  const email = authEmailInput.value.trim();
  const password = authPasswordInput.value;

  if (!supabase) return;

  if (authErrorMsg) authErrorMsg.style.display = 'none';
  setAuthLoading(true);

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  setAuthLoading(false);

  if (error) {
    showAuthError(error.message);
  } else {
    closeAuthModal();
  }
}

async function handleSignup() {
  const email = authEmailInput.value.trim();
  const password = authPasswordInput.value;

  if (!email || password.length < 6) {
    showAuthError('メールアドレスと6文字以上のパスワードを入力してください。');
    return;
  }

  if (!supabase) return;

  if (authErrorMsg) authErrorMsg.style.display = 'none';
  setAuthLoading(true);

  const { data, error } = await supabase.auth.signUp({
    email,
    password
  });

  setAuthLoading(false);

  if (error) {
    showAuthError(error.message);
  } else {
    alert('アカウントが作成されました！自動でログインされない場合は、再度ログインフォームからログインしてください。');
    if (data.session) {
      closeAuthModal();
    }
  }
}

async function handleLogout() {
  if (!supabase) return;
  
  if (confirm('ログアウトしますか？ローカルのデータはそのまま残ります。')) {
    await supabase.auth.signOut();
    closeAuthModal();
  }
}

function setAuthLoading(loading) {
  if (btnLoginSubmit) btnLoginSubmit.disabled = loading;
  if (btnSignupSubmit) btnSignupSubmit.disabled = loading;
  if (btnLoginSubmit) btnLoginSubmit.textContent = loading ? '処理中...' : 'ログイン';
}

function showAuthError(msg) {
  if (authErrorMsg) {
    authErrorMsg.textContent = `エラー: ${msg}`;
    authErrorMsg.style.display = 'block';
  }
}

// Sync data from Supabase Cloud
async function syncDataFromCloud() {
  if (!supabase || !currentUser || isSyncing) return;

  isSyncing = true;
  const syncIcon = document.querySelector('.sync-icon');
  if (syncIcon) syncIcon.classList.add('syncing');

  try {
    const { data, error } = await supabase
      .from('relaxdue_sync')
      .select('*')
      .eq('user_id', currentUser.id)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    const localTasks = tasks;
    const localRelaxHours = totalRelaxHours;
    const localCompletedCount = totalCompletedTasks;
    const localCumulativeRelax = cumulativeRelaxHours;

    if (!data) {
      // First sync for this user: Upload local data to cloud
      await uploadDataToCloud(localTasks, localRelaxHours, localCompletedCount, localCumulativeRelax);
    } else {
      // Merge Cloud & Local data
      const cloudTasks = data.tasks || [];
      const cloudRelaxHours = parseFloat(data.total_relax_hours) || 0;
      const cloudCompletedCount = parseInt(data.total_completed_tasks, 10) || 0;
      const cloudCumulativeRelax = parseFloat(data.cumulative_relax_hours) || 0;

      // Merge Tasks by Unique ID
      const mergedTasks = [...cloudTasks];
      localTasks.forEach(lt => {
        if (!mergedTasks.some(ct => ct.id === lt.id)) {
          mergedTasks.push(lt);
        }
      });

      // Keep maximum values for progress states
      const finalRelaxHours = Math.max(localRelaxHours, cloudRelaxHours);
      const finalCompletedCount = Math.max(localCompletedCount, cloudCompletedCount);
      const finalCumulativeRelax = Math.max(localCumulativeRelax, cloudCumulativeRelax);

      // Save to local state
      tasks = mergedTasks;
      totalRelaxHours = finalRelaxHours;
      totalCompletedTasks = finalCompletedCount;
      cumulativeRelaxHours = finalCumulativeRelax;

      saveTasks();
      saveRelaxHours();
      saveCompletedCount();
      saveCumulativeRelax();

      // Refresh UI
      updateScoreboard();
      renderTasks();

      // Update cloud to reflect merged state
      await uploadDataToCloud(tasks, totalRelaxHours, totalCompletedTasks, cumulativeRelaxHours);
    }
  } catch (err) {
    console.error('クラウド同期中にエラーが発生しました:', err);
  } finally {
    isSyncing = false;
    if (syncIcon) syncIcon.classList.remove('syncing');
  }
}

// Upload current state to Supabase Cloud
async function uploadDataToCloud(tasksData, relaxHoursData, completedCountData, cumulativeRelaxData) {
  if (!supabase || !currentUser) return;

  const payload = {
    user_id: currentUser.id,
    tasks: tasksData,
    total_relax_hours: relaxHoursData,
    total_completed_tasks: completedCountData,
    cumulative_relax_hours: cumulativeRelaxData,
    updated_at: new Date().toISOString()
  };

  const { error } = await supabase
    .from('relaxdue_sync')
    .upsert(payload, { onConflict: 'user_id' });

  if (error) {
    console.error('クラウドへのアップロードに失敗しました:', error);
  }
}

