// ============ STATE MANAGEMENT ============
const state = {
    tasks: JSON.parse(localStorage.getItem('tasks') || '[]'),
    screenTime: JSON.parse(localStorage.getItem('screenTime') || '{}'),
    appUsage: JSON.parse(localStorage.getItem('appUsage') || '{}'),
    focusSessions: JSON.parse(localStorage.getItem('focusSessions') || '[]'),
    achievements: JSON.parse(localStorage.getItem('achievements') || '[]'),
    settings: JSON.parse(localStorage.getItem('settings') || '{"enableNotifs": true, "reminderTime": 5, "maxScreenTime": 8, "dailyTaskGoal": 5, "theme": "light", "enableAnimations": true, "enableSounds": true, "enableSmartInsights": true, "enableMotivationalQuotes": true, "enableBreakReminders": true, "breakInterval": 25}'),
    currentFilter: 'all',
    editingTask: null,
    activeSession: null,
    focusTimer: null,
    focusTimeRemaining: 1500,
    focusTimerRunning: false,
    currentChartType: 'time'
};

let timerInterval, sessionInterval, focusInterval, breakReminderInterval;
let currentSeconds = 0;

// ============ MOTIVATIONAL QUOTES ============
const quotes = [
    "The secret of getting ahead is getting started.",
    "Focus on being productive instead of busy.",
    "Your limitation—it's only your imagination.",
    "Great things never come from comfort zones.",
    "Success doesn't just find you. You have to go out and get it.",
    "The harder you work for something, the greater you'll feel when you achieve it.",
    "Dream it. Wish it. Do it.",
    "Don't stop when you're tired. Stop when you're done.",
    "Wake up with determination. Go to bed with satisfaction.",
    "Do something today that your future self will thank you for."
];

function showRandomQuote() {
    if (!state.settings.enableMotivationalQuotes) return;
    const quote = quotes[Math.floor(Math.random() * quotes.length)];
    document.getElementById('quoteText').textContent = quote;
}

// ============ TOAST NOTIFICATIONS ============
function showToast(message, icon = '✓') {
    const toast = document.getElementById('toast');
    document.getElementById('toastIcon').textContent = icon;
    document.getElementById('toastMessage').textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
}

// ============ THEME MANAGEMENT ============
function applyTheme(theme) {
    if (theme === 'dark' || (theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        document.body.classList.add('dark-theme');
        document.getElementById('themeIcon').textContent = '☀️';
    } else {
        document.body.classList.remove('dark-theme');
        document.getElementById('themeIcon').textContent = '🌙';
    }
}

document.getElementById('themeToggle').addEventListener('click', () => {
    const currentTheme = state.settings.theme;
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    state.settings.theme = newTheme;
    localStorage.setItem('settings', JSON.stringify(state.settings));
    applyTheme(newTheme);
    showToast('Theme changed', '🎨');
});

document.getElementById('themeSelect')?.addEventListener('change', (e) => {
    state.settings.theme = e.target.value;
    localStorage.setItem('settings', JSON.stringify(state.settings));
    applyTheme(e.target.value);
});

// ============ KEYBOARD SHORTCUTS ============
document.addEventListener('keydown', (e) => {
    // Ctrl+K for search
    if (e.ctrlKey && e.key === 'k') {
        e.preventDefault();
        document.getElementById('globalSearch').focus();
    }
    
    // Esc to close modals
    if (e.key === 'Escape') {
        closeTaskModal();
        closeAppModal();
    }
    
    // Number keys for navigation (1-7)
    if (e.key >= '1' && e.key <= '7' && !e.ctrlKey && !e.altKey) {
        const pages = ['dashboard', 'focus', 'tasks', 'apps', 'analytics', 'goals', 'settings'];
        const index = parseInt(e.key) - 1;
        if (pages[index]) {
            document.querySelector(`[data-page="${pages[index]}"]`).click();
        }
    }
    
    // T for quick task
    if (e.key === 't' && !e.ctrlKey && !e.altKey && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
        openTaskModal();
    }
    
    // F for focus mode
    if (e.key === 'f' && !e.ctrlKey && !e.altKey && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
        document.querySelector('[data-page="focus"]').click();
    }
    
    // D for dark mode
    if (e.key === 'd' && !e.ctrlKey && !e.altKey && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
        document.getElementById('themeToggle').click();
    }
});

// ============ GLOBAL SEARCH ============
document.getElementById('globalSearch').addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase();
    if (!query) return;
    
    const results = state.tasks.filter(t => 
        t.name.toLowerCase().includes(query) || 
        (t.description && t.description.toLowerCase().includes(query))
    );
    
    // Auto-switch to tasks page and filter
    if (results.length > 0) {
        document.querySelector('[data-page="tasks"]').click();
    }
});

// ============ NAVIGATION ============
document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
        const page = item.dataset.page;
        document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        item.classList.add('active');
        document.getElementById(page).classList.add('active');
        
        if (page === 'dashboard') updateDashboard();
        if (page === 'tasks') renderTasks();
        if (page === 'apps') updateAppTracker();
        if (page === 'analytics') updateAnalytics();
        if (page === 'goals') updateGoals();
        if (page === 'focus') updateFocusPage();
    });
});

document.getElementById('quickFocusBtn').addEventListener('click', () => {
    document.querySelector('[data-page="focus"]').click();
});

document.getElementById('quickTaskBtn').addEventListener('click', () => {
    openTaskModal();
});


// ============ SCREEN TIME TRACKING ============
function startScreenTimeTracking() {
    const today = new Date().toDateString();
    if (!state.screenTime[today]) {
        state.screenTime[today] = 0;
    }
    
    currentSeconds = state.screenTime[today];
    
    timerInterval = setInterval(() => {
        currentSeconds++;
        state.screenTime[today] = currentSeconds;
        localStorage.setItem('screenTime', JSON.stringify(state.screenTime));
        updateScreenTimeDisplay();
        checkScreenTimeGoal();
    }, 1000);
}

function updateScreenTimeDisplay() {
    const hours = Math.floor(currentSeconds / 3600);
    const minutes = Math.floor((currentSeconds % 3600) / 60);
    const el = document.getElementById('todayTime');
    if (el) el.textContent = `${hours}h ${minutes}m`;
}

function checkScreenTimeGoal() {
    const hours = currentSeconds / 3600;
    if (hours >= state.settings.maxScreenTime && !state.screenTimeWarningShown) {
        state.screenTimeWarningShown = true;
        showToast(`You've reached your ${state.settings.maxScreenTime}h screen time goal!`, '⚠️');
        if (state.settings.enableNotifs && Notification.permission === 'granted') {
            new Notification('Screen Time Goal Reached', {
                body: `You've been on screen for ${state.settings.maxScreenTime} hours today. Time for a break?`
            });
        }
    }
}

function getYesterdayTime() {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return state.screenTime[yesterday.toDateString()] || 0;
}

function calculateTimeChange() {
    const today = currentSeconds;
    const yesterday = getYesterdayTime();
    if (yesterday === 0) return '+0%';
    const change = ((today - yesterday) / yesterday * 100).toFixed(0);
    return change > 0 ? `+${change}%` : `${change}%`;
}

// ============ FOCUS MODE / POMODORO TIMER ============
function updateFocusPage() {
    updateFocusStats();
    renderFocusHistory();
}

function updateFocusStats() {
    const today = new Date().toDateString();
    const todaySessions = state.focusSessions.filter(s => new Date(s.date).toDateString() === today);
    
    document.getElementById('todayFocusSessions').textContent = todaySessions.length;
    
    const totalMinutes = state.focusSessions.reduce((sum, s) => sum + s.duration, 0);
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    document.getElementById('totalFocusTime').textContent = `${hours}h ${mins}m`;
    
    // Calculate streak
    let streak = 0;
    const dates = [...new Set(state.focusSessions.map(s => new Date(s.date).toDateString()))].sort().reverse();
    const today = new Date();
    
    for (let i = 0; i < dates.length; i++) {
        const checkDate = new Date(today);
        checkDate.setDate(checkDate.getDate() - i);
        if (dates[i] === checkDate.toDateString()) {
            streak++;
        } else {
            break;
        }
    }
    
    document.getElementById('focusStreak').textContent = streak;
}

function renderFocusHistory() {
    const container = document.getElementById('focusHistory');
    const recent = state.focusSessions.slice(-10).reverse();
    
    if (recent.length === 0) {
        container.innerHTML = '<div class="empty-state">No focus sessions yet</div>';
        return;
    }
    
    container.innerHTML = recent.map(session => {
        const date = new Date(session.date);
        return `
            <div style="padding: 12px; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between;">
                <span>${date.toLocaleString()}</span>
                <span style="color: var(--primary); font-weight: 600;">${session.duration} min</span>
            </div>
        `;
    }).join('');
}

document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const minutes = parseInt(btn.dataset.minutes);
        state.focusTimeRemaining = minutes * 60;
        updateTimerDisplay();
    });
});

function updateTimerDisplay() {
    const minutes = Math.floor(state.focusTimeRemaining / 60);
    const seconds = state.focusTimeRemaining % 60;
    document.getElementById('timerDisplay').textContent = 
        `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    
    // Update progress circle
    const totalSeconds = parseInt(document.querySelector('.preset-btn.active').dataset.minutes) * 60;
    const progress = 1 - (state.focusTimeRemaining / totalSeconds);
    const circumference = 2 * Math.PI * 140;
    const offset = circumference * (1 - progress);
    document.getElementById('progressCircle').style.strokeDasharray = `${circumference} ${circumference}`;
    document.getElementById('progressCircle').style.strokeDashoffset = offset;
}

document.getElementById('startTimer').addEventListener('click', () => {
    if (!state.focusTimerRunning) {
        state.focusTimerRunning = true;
        document.getElementById('startTimer').style.display = 'none';
        document.getElementById('pauseTimer').style.display = 'inline-block';
        document.getElementById('timerLabel').textContent = 'Focus Time - Stay Focused!';
        
        focusInterval = setInterval(() => {
            state.focusTimeRemaining--;
            updateTimerDisplay();
            
            if (state.focusTimeRemaining <= 0) {
                completeFocusSession();
            }
        }, 1000);
        
        if (state.settings.enableSounds) {
            playSound('start');
        }
        showToast('Focus session started!', '🎯');
    }
});

document.getElementById('pauseTimer').addEventListener('click', () => {
    state.focusTimerRunning = false;
    clearInterval(focusInterval);
    document.getElementById('startTimer').style.display = 'inline-block';
    document.getElementById('pauseTimer').style.display = 'none';
    document.getElementById('timerLabel').textContent = 'Paused';
    showToast('Timer paused', '⏸️');
});

document.getElementById('resetTimer').addEventListener('click', () => {
    state.focusTimerRunning = false;
    clearInterval(focusInterval);
    const minutes = parseInt(document.querySelector('.preset-btn.active').dataset.minutes);
    state.focusTimeRemaining = minutes * 60;
    updateTimerDisplay();
    document.getElementById('startTimer').style.display = 'inline-block';
    document.getElementById('pauseTimer').style.display = 'none';
    document.getElementById('timerLabel').textContent = 'Focus Time';
    showToast('Timer reset', '🔄');
});

function completeFocusSession() {
    clearInterval(focusInterval);
    state.focusTimerRunning = false;
    
    const duration = parseInt(document.querySelector('.preset-btn.active').dataset.minutes);
    state.focusSessions.push({
        date: new Date().toISOString(),
        duration: duration
    });
    localStorage.setItem('focusSessions', JSON.stringify(state.focusSessions));
    
    document.getElementById('startTimer').style.display = 'inline-block';
    document.getElementById('pauseTimer').style.display = 'none';
    document.getElementById('timerLabel').textContent = 'Session Complete!';
    
    if (state.settings.enableSounds) {
        playSound('complete');
    }
    
    showToast(`Focus session complete! ${duration} minutes`, '🎉');
    
    if (state.settings.enableNotifs && Notification.permission === 'granted') {
        new Notification('Focus Session Complete!', {
            body: `Great job! You focused for ${duration} minutes. Time for a break?`
        });
    }
    
    checkAchievements();
    updateFocusStats();
    renderFocusHistory();
    
    // Reset timer
    setTimeout(() => {
        state.focusTimeRemaining = duration * 60;
        updateTimerDisplay();
        document.getElementById('timerLabel').textContent = 'Focus Time';
    }, 3000);
}

function playSound(type) {
    // Simple beep using Web Audio API
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.value = type === 'complete' ? 800 : 600;
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.5);
}

// ============ BREAK REMINDERS ============
function startBreakReminders() {
    if (!state.settings.enableBreakReminders) return;
    
    const intervalMs = state.settings.breakInterval * 60 * 1000;
    
    breakReminderInterval = setInterval(() => {
        if (state.settings.enableNotifs && Notification.permission === 'granted') {
            new Notification('Time for a Break!', {
                body: 'You\'ve been working for a while. Take a 5-minute break to rest your eyes and stretch.'
            });
        }
        showToast('Time for a break! 🧘', '⏰');
    }, intervalMs);
}

document.getElementById('enableBreakReminders')?.addEventListener('change', (e) => {
    state.settings.enableBreakReminders = e.target.checked;
    localStorage.setItem('settings', JSON.stringify(state.settings));
    
    if (e.target.checked) {
        startBreakReminders();
    } else {
        clearInterval(breakReminderInterval);
    }
});

document.getElementById('breakInterval')?.addEventListener('change', (e) => {
    state.settings.breakInterval = parseInt(e.target.value);
    localStorage.setItem('settings', JSON.stringify(state.settings));
    
    if (state.settings.enableBreakReminders) {
        clearInterval(breakReminderInterval);
        startBreakReminders();
    }
});


// ============ APP TRACKING ============
function saveAppUsage() {
    localStorage.setItem('appUsage', JSON.stringify(state.appUsage));
}

function openAppModal() {
    document.getElementById('appModal').classList.add('active');
    document.getElementById('appName').value = '';
    document.getElementById('appCategory').value = 'productive';
}

function closeAppModal() {
    document.getElementById('appModal').classList.remove('active');
}

document.getElementById('startAppSession').addEventListener('click', openAppModal);
document.getElementById('addAppTime').addEventListener('click', openAppModal);
document.getElementById('closeAppModal').addEventListener('click', closeAppModal);
document.getElementById('cancelApp').addEventListener('click', closeAppModal);

document.getElementById('startTracking').addEventListener('click', () => {
    const appName = document.getElementById('appName').value.trim();
    const category = document.getElementById('appCategory').value;
    
    if (!appName) {
        showToast('Please enter an app name', '⚠️');
        return;
    }
    
    startAppSession(appName, category);
    closeAppModal();
});

function startAppSession(appName, category) {
    if (state.activeSession) {
        stopAppSession();
    }
    
    state.activeSession = {
        appName,
        category,
        startTime: Date.now(),
        seconds: 0
    };
    
    document.getElementById('activeSession').style.display = 'block';
    document.getElementById('sessionAppName').textContent = appName;
    
    sessionInterval = setInterval(() => {
        state.activeSession.seconds++;
        updateSessionDisplay();
    }, 1000);
    
    showToast(`Tracking ${appName}`, '▶️');
}

function updateSessionDisplay() {
    if (!state.activeSession) return;
    
    const hours = Math.floor(state.activeSession.seconds / 3600);
    const minutes = Math.floor((state.activeSession.seconds % 3600) / 60);
    const seconds = state.activeSession.seconds % 60;
    
    document.getElementById('sessionTime').textContent = 
        `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function stopAppSession() {
    if (!state.activeSession) return;
    
    clearInterval(sessionInterval);
    
    const today = new Date().toDateString();
    if (!state.appUsage[today]) {
        state.appUsage[today] = {};
    }
    
    const appKey = state.activeSession.appName;
    if (!state.appUsage[today][appKey]) {
        state.appUsage[today][appKey] = {
            category: state.activeSession.category,
            seconds: 0
        };
    }
    
    state.appUsage[today][appKey].seconds += state.activeSession.seconds;
    saveAppUsage();
    
    const minutes = Math.floor(state.activeSession.seconds / 60);
    showToast(`Session saved: ${minutes} minutes`, '✓');
    
    document.getElementById('activeSession').style.display = 'none';
    state.activeSession = null;
    
    updateDashboard();
    updateAppTracker();
}

document.getElementById('stopSession').addEventListener('click', stopAppSession);

window.quickLogTime = function(minutes) {
    const appName = document.getElementById('appName').value.trim();
    const category = document.getElementById('appCategory').value;
    
    if (!appName) {
        showToast('Please enter an app name', '⚠️');
        return;
    }
    
    const today = new Date().toDateString();
    if (!state.appUsage[today]) {
        state.appUsage[today] = {};
    }
    
    if (!state.appUsage[today][appName]) {
        state.appUsage[today][appName] = {
            category,
            seconds: 0
        };
    }
    
    state.appUsage[today][appName].seconds += minutes * 60;
    saveAppUsage();
    
    closeAppModal();
    showToast(`Logged ${minutes} minutes for ${appName}`, '✓');
    updateDashboard();
    updateAppTracker();
};

function getTodayAppUsage() {
    const today = new Date().toDateString();
    return state.appUsage[today] || {};
}

function updateAppTracker() {
    const todayApps = getTodayAppUsage();
    const appCount = Object.keys(todayApps).length;
    
    document.getElementById('totalApps').textContent = appCount;
    
    let mostUsed = '-';
    let maxSeconds = 0;
    Object.entries(todayApps).forEach(([app, data]) => {
        if (data.seconds > maxSeconds) {
            maxSeconds = data.seconds;
            mostUsed = app;
        }
    });
    document.getElementById('mostUsedApp').textContent = mostUsed;
    
    const categoryTotals = {};
    Object.values(todayApps).forEach(data => {
        categoryTotals[data.category] = (categoryTotals[data.category] || 0) + data.seconds;
    });
    
    let topCat = '-';
    let maxCatSeconds = 0;
    Object.entries(categoryTotals).forEach(([cat, seconds]) => {
        if (seconds > maxCatSeconds) {
            maxCatSeconds = seconds;
            topCat = cat;
        }
    });
    
    const categoryNames = {
        productive: 'Productive',
        development: 'Development',
        social: 'Social Media',
        entertainment: 'Entertainment',
        communication: 'Communication',
        other: 'Other'
    };
    document.getElementById('topCategory').textContent = categoryNames[topCat] || '-';
    
    renderAppBreakdown();
    renderAppTimelineChart();
}

function renderAppBreakdown() {
    const todayApps = getTodayAppUsage();
    const filter = document.getElementById('appFilter').value;
    
    const filtered = Object.entries(todayApps)
        .filter(([app, data]) => filter === 'all' || data.category === filter)
        .sort((a, b) => b[1].seconds - a[1].seconds);
    
    const container = document.getElementById('appBreakdown');
    
    if (filtered.length === 0) {
        container.innerHTML = '<div class="empty-state">No app usage recorded yet</div>';
        return;
    }
    
    const categoryIcons = {
        productive: '💼',
        development: '💻',
        social: '📱',
        entertainment: '🎮',
        communication: '💬',
        other: '📌'
    };
    
    const categoryColors = {
        productive: '#10b981',
        development: '#6366f1',
        social: '#f59e0b',
        entertainment: '#ef4444',
        communication: '#8b5cf6',
        other: '#64748b'
    };
    
    const total = filtered.reduce((sum, [_, data]) => sum + data.seconds, 0);
    
    container.innerHTML = filtered.map(([app, data]) => {
        const hours = Math.floor(data.seconds / 3600);
        const minutes = Math.floor((data.seconds % 3600) / 60);
        const percentage = ((data.seconds / total) * 100).toFixed(1);
        
        return `
            <div class="app-usage-item">
                <div class="app-usage-info">
                    <span class="app-icon">${categoryIcons[data.category]}</span>
                    <div class="app-details">
                        <div class="app-name">${app}</div>
                        <div class="app-time">${hours}h ${minutes}m</div>
                    </div>
                </div>
                <div class="app-usage-bar">
                    <div class="app-usage-fill" style="width: ${percentage}%; background: ${categoryColors[data.category]}"></div>
                    <span class="app-percentage">${percentage}%</span>
                </div>
            </div>
        `;
    }).join('');
}

document.getElementById('appFilter').addEventListener('change', renderAppBreakdown);

function renderAppTimelineChart() {
    const canvas = document.getElementById('appTimelineChart');
    const ctx = canvas.getContext('2d');
    canvas.width = canvas.offsetWidth;
    canvas.height = 300;
    
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toDateString();
        const apps = state.appUsage[dateStr] || {};
        const totalSeconds = Object.values(apps).reduce((sum, data) => sum + data.seconds, 0);
        last7Days.push({
            date: date.toLocaleDateString('en-US', { weekday: 'short' }),
            hours: totalSeconds / 3600
        });
    }
    
    const max = Math.max(...last7Days.map(d => d.hours), 1);
    const barWidth = (canvas.width - 100) / 7;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    last7Days.forEach((day, i) => {
        const height = (day.hours / max) * 220;
        const x = 50 + i * barWidth + barWidth * 0.1;
        const y = 250 - height;
        
        const gradient = ctx.createLinearGradient(0, y, 0, 250);
        gradient.addColorStop(0, '#8b5cf6');
        gradient.addColorStop(1, '#6366f1');
        
        ctx.fillStyle = gradient;
        ctx.fillRect(x, y, barWidth * 0.8, height);
        
        ctx.fillStyle = '#64748b';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(day.date, x + barWidth * 0.4, 270);
        ctx.fillText(day.hours.toFixed(1) + 'h', x + barWidth * 0.4, y - 5);
    });
}


// ============ CHARTS ============
function renderCharts() {
    renderAppChart();
    renderWeeklyChart();
}

function renderAppChart() {
    const canvas = document.getElementById('appChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = canvas.offsetWidth;
    canvas.height = 250;
    
    const todayApps = getTodayAppUsage();
    const apps = Object.entries(todayApps)
        .sort((a, b) => b[1].seconds - a[1].seconds)
        .slice(0, 5);
    
    if (apps.length === 0) {
        ctx.fillStyle = '#64748b';
        ctx.font = '14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('No app usage data yet', canvas.width / 2, canvas.height / 2);
        return;
    }
    
    const categoryColors = {
        productive: '#10b981',
        development: '#6366f1',
        social: '#f59e0b',
        entertainment: '#ef4444',
        communication: '#8b5cf6',
        other: '#64748b'
    };
    
    const total = apps.reduce((sum, [_, data]) => sum + data.seconds, 0);
    let currentAngle = -Math.PI / 2;
    
    const centerX = canvas.width / 2;
    const centerY = 125;
    const radius = 80;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    apps.forEach(([app, data]) => {
        const sliceAngle = (data.seconds / total) * 2 * Math.PI;
        
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + sliceAngle);
        ctx.closePath();
        ctx.fillStyle = categoryColors[data.category] || '#64748b';
        ctx.fill();
        
        currentAngle += sliceAngle;
    });
    
    let legendY = 20;
    apps.forEach(([app, data]) => {
        const minutes = Math.floor(data.seconds / 60);
        ctx.fillStyle = categoryColors[data.category] || '#64748b';
        ctx.fillRect(canvas.width - 150, legendY, 12, 12);
        ctx.fillStyle = '#1e293b';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(`${app} (${minutes}m)`, canvas.width - 135, legendY + 10);
        legendY += 20;
    });
}

function renderAppUsageList() {
    const todayApps = getTodayAppUsage();
    const apps = Object.entries(todayApps)
        .sort((a, b) => b[1].seconds - a[1].seconds)
        .slice(0, 3);
    
    const container = document.getElementById('appUsageList');
    if (!container) return;
    
    if (apps.length === 0) {
        container.innerHTML = '<div class="empty-state" style="padding: 20px;">No apps tracked yet</div>';
        return;
    }
    
    const categoryIcons = {
        productive: '💼',
        development: '💻',
        social: '📱',
        entertainment: '🎮',
        communication: '💬',
        other: '📌'
    };
    
    container.innerHTML = apps.map(([app, data]) => {
        const hours = Math.floor(data.seconds / 3600);
        const minutes = Math.floor((data.seconds % 3600) / 60);
        
        return `
            <div style="display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid var(--border);">
                <span>${categoryIcons[data.category]} ${app}</span>
                <span style="color: var(--gray);">${hours}h ${minutes}m</span>
            </div>
        `;
    }).join('');
}

function renderWeeklyChart() {
    const canvas = document.getElementById('weeklyChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = canvas.offsetWidth;
    canvas.height = 250;
    
    const chartType = state.currentChartType;
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const data = [];
    
    for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toDateString();
        
        let value = 0;
        if (chartType === 'time') {
            value = (state.screenTime[dateStr] || 0) / 3600;
        } else if (chartType === 'tasks') {
            value = state.tasks.filter(t => 
                t.completed && new Date(t.completedAt).toDateString() === dateStr
            ).length;
        } else if (chartType === 'productivity') {
            // Simplified productivity score for the day
            value = Math.random() * 100; // Placeholder
        }
        
        data.push(value);
    }
    
    const max = Math.max(...data, 1);
    const barWidth = (canvas.width - 100) / 7;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    data.forEach((value, i) => {
        const height = (value / max) * 180;
        const x = 50 + i * barWidth + barWidth * 0.1;
        const y = 200 - height;
        
        const gradient = ctx.createLinearGradient(0, y, 0, 200);
        gradient.addColorStop(0, '#6366f1');
        gradient.addColorStop(1, '#8b5cf6');
        
        ctx.fillStyle = gradient;
        ctx.fillRect(x, y, barWidth * 0.8, height);
        
        ctx.fillStyle = '#64748b';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(days[(new Date().getDay() - 6 + i + 7) % 7], x + barWidth * 0.4, 220);
        
        const label = chartType === 'time' ? value.toFixed(1) + 'h' : 
                     chartType === 'tasks' ? Math.round(value) : 
                     Math.round(value);
        ctx.fillText(label, x + barWidth * 0.4, y - 5);
    });
}

document.querySelectorAll('.chart-btn')?.forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.chart-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.currentChartType = btn.dataset.chart;
        renderWeeklyChart();
    });
});

// ============ ANALYTICS ============
function updateAnalytics() {
    const dates = Object.keys(state.screenTime);
    const totalHours = Object.values(state.screenTime).reduce((a, b) => a + b, 0) / 3600;
    const avgHours = dates.length > 0 ? totalHours / dates.length : 0;
    
    const el = document.getElementById('avgScreenTime');
    if (el) el.textContent = `${Math.floor(avgHours)}h ${Math.floor((avgHours % 1) * 60)}m`;
    
    const completed = state.tasks.filter(t => t.completed).length;
    const total = state.tasks.length;
    const rate = total > 0 ? Math.round(completed / total * 100) : 0;
    const rateEl = document.getElementById('completionRate');
    if (rateEl) rateEl.textContent = rate + '%';
    
    renderAnalyticsCharts();
    renderHeatmap();
    updateInsights();
}

function renderAnalyticsCharts() {
    renderDailyAvgChart();
    renderCompletionChart();
}

function renderDailyAvgChart() {
    const canvas = document.getElementById('dailyAvgChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = canvas.offsetWidth;
    canvas.height = 200;
    
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const seconds = state.screenTime[date.toDateString()] || 0;
        last7Days.push(seconds / 3600);
    }
    
    const max = Math.max(...last7Days, 1);
    const step = canvas.width / 7;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#6366f1';
    ctx.lineWidth = 3;
    ctx.beginPath();
    
    last7Days.forEach((hours, i) => {
        const x = i * step + step / 2;
        const y = 180 - (hours / max) * 160;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    });
    
    ctx.stroke();
}

function renderCompletionChart() {
    const canvas = document.getElementById('completionChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = canvas.offsetWidth;
    canvas.height = 200;
    
    const completed = state.tasks.filter(t => t.completed).length;
    const total = state.tasks.length;
    const percentage = total > 0 ? completed / total : 0;
    
    const centerX = canvas.width / 2;
    const centerY = 100;
    const radius = 70;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
    ctx.strokeStyle = '#f1f5f9';
    ctx.lineWidth = 15;
    ctx.stroke();
    
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, -Math.PI / 2, -Math.PI / 2 + 2 * Math.PI * percentage);
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 15;
    ctx.stroke();
    
    ctx.fillStyle = '#1e293b';
    ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(Math.round(percentage * 100) + '%', centerX, centerY + 8);
}

function renderHeatmap() {
    const container = document.getElementById('heatmap');
    if (!container) return;
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const seconds = state.screenTime[date.toDateString()] || 0;
        last7Days.push({ day: days[date.getDay()], hours: seconds / 3600 });
    }
    
    const max = Math.max(...last7Days.map(d => d.hours), 1);
    
    container.innerHTML = last7Days.map(d => {
        const intensity = d.hours / max;
        const color = `rgba(99, 102, 241, ${intensity})`;
        return `
            <div class="heatmap-day" style="background: ${color}; color: ${intensity > 0.5 ? 'white' : '#1e293b'}">
                <div>${d.day}</div>
                <div>${d.hours.toFixed(1)}h</div>
            </div>
        `;
    }).join('');
}

function updateInsights() {
    const dates = Object.keys(state.screenTime);
    if (dates.length === 0) {
        const els = ['peakTime', 'bestDay', 'avgSession'];
        els.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.textContent = 'No data yet';
        });
        return;
    }
    
    const avgSession = currentSeconds / Math.max(state.focusSessions.length, 1) / 60;
    const el = document.getElementById('avgSession');
    if (el) el.textContent = `${Math.round(avgSession)} minutes`;
    
    const peakEl = document.getElementById('peakTime');
    const bestEl = document.getElementById('bestDay');
    if (peakEl) peakEl.textContent = 'Afternoon (2-5 PM)';
    if (bestEl) bestEl.textContent = 'Wednesday';
}


// ============ ACHIEVEMENTS ============
const achievementDefinitions = [
    { id: 'first_task', name: 'Getting Started', description: 'Complete your first task', icon: '🎯', check: () => state.tasks.some(t => t.completed) },
    { id: 'task_master', name: 'Task Master', description: 'Complete 10 tasks', icon: '🏆', check: () => state.tasks.filter(t => t.completed).length >= 10 },
    { id: 'focus_beginner', name: 'Focus Beginner', description: 'Complete your first focus session', icon: '🎓', check: () => state.focusSessions.length >= 1 },
    { id: 'focus_pro', name: 'Focus Pro', description: 'Complete 10 focus sessions', icon: '💎', check: () => state.focusSessions.length >= 10 },
    { id: 'week_streak', name: 'Week Warrior', description: 'Maintain a 7-day streak', icon: '🔥', check: () => {
        const dates = Object.keys(state.screenTime).sort().reverse();
        let streak = 0;
        const today = new Date();
        for (let i = 0; i < dates.length; i++) {
            const checkDate = new Date(today);
            checkDate.setDate(checkDate.getDate() - i);
            if (dates[i] === checkDate.toDateString()) streak++;
            else break;
        }
        return streak >= 7;
    }},
    { id: 'productive_day', name: 'Productive Day', description: 'Score 90+ productivity', icon: '⭐', check: () => calculateProductivityScore() >= 90 },
    { id: 'early_bird', name: 'Early Bird', description: 'Complete a task before 9 AM', icon: '🌅', check: () => state.tasks.some(t => t.completed && new Date(t.completedAt).getHours() < 9) },
    { id: 'night_owl', name: 'Night Owl', description: 'Complete a task after 10 PM', icon: '🦉', check: () => state.tasks.some(t => t.completed && new Date(t.completedAt).getHours() >= 22) }
];

function checkAchievements() {
    let newAchievements = [];
    
    achievementDefinitions.forEach(def => {
        if (!state.achievements.includes(def.id) && def.check()) {
            state.achievements.push(def.id);
            newAchievements.push(def);
        }
    });
    
    if (newAchievements.length > 0) {
        localStorage.setItem('achievements', JSON.stringify(state.achievements));
        newAchievements.forEach(ach => {
            showToast(`Achievement unlocked: ${ach.name}!`, ach.icon);
            if (state.settings.enableSounds) {
                playSound('complete');
            }
        });
        updateAchievementCount();
    }
}

function updateAchievementCount() {
    const el = document.getElementById('achievementCount');
    if (el) el.textContent = state.achievements.length;
}

function renderAchievements() {
    const container = document.getElementById('achievementsGrid');
    if (!container) return;
    
    container.innerHTML = achievementDefinitions.map(def => {
        const unlocked = state.achievements.includes(def.id);
        return `
            <div class="achievement-card ${unlocked ? 'unlocked' : 'locked'}">
                <div class="achievement-icon">${unlocked ? def.icon : '🔒'}</div>
                <div class="achievement-name">${def.name}</div>
                <div class="achievement-desc">${def.description}</div>
            </div>
        `;
    }).join('');
}

// ============ GOALS ============
function updateGoals() {
    renderAchievements();
    updateGoalProgress();
}

function updateGoalProgress() {
    // Task goal
    const completed = state.tasks.filter(t => {
        if (!t.completed) return false;
        return new Date(t.completedAt).toDateString() === new Date().toDateString();
    }).length;
    const taskGoal = state.settings.dailyTaskGoal;
    
    const taskProgressEl = document.getElementById('taskGoalProgress');
    const taskStatusEl = document.getElementById('taskGoalStatus');
    if (taskProgressEl) taskProgressEl.style.width = `${Math.min(completed / taskGoal * 100, 100)}%`;
    if (taskStatusEl) taskStatusEl.textContent = `${completed}/${taskGoal}`;
    
    // Focus goal
    const focusSessions = state.focusSessions.filter(s => 
        new Date(s.date).toDateString() === new Date().toDateString()
    ).length;
    const focusGoal = 3;
    
    const focusProgressEl = document.getElementById('focusGoalProgress');
    const focusStatusEl = document.getElementById('focusGoalStatus');
    if (focusProgressEl) focusProgressEl.style.width = `${Math.min(focusSessions / focusGoal * 100, 100)}%`;
    if (focusStatusEl) focusStatusEl.textContent = `${focusSessions}/${focusGoal}`;
    
    // Screen time goal
    const hours = currentSeconds / 3600;
    const maxHours = state.settings.maxScreenTime;
    
    const screenProgressEl = document.getElementById('screenTimeGoalProgress');
    const screenStatusEl = document.getElementById('screenTimeGoalStatus');
    if (screenProgressEl) {
        const percentage = Math.min(hours / maxHours * 100, 100);
        screenProgressEl.style.width = `${percentage}%`;
        screenProgressEl.style.background = percentage > 90 ? '#ef4444' : '#6366f1';
    }
    if (screenStatusEl) screenStatusEl.textContent = `${Math.floor(hours)}h/${maxHours}h`;
    
    // Update display values
    const dailyTaskGoalEl = document.getElementById('dailyTaskGoalDisplay');
    const maxScreenTimeEl = document.getElementById('maxScreenTimeDisplay');
    if (dailyTaskGoalEl) dailyTaskGoalEl.textContent = taskGoal;
    if (maxScreenTimeEl) maxScreenTimeEl.textContent = maxHours;
}

// ============ WEEKLY REPORT ============
document.getElementById('generateReport')?.addEventListener('click', () => {
    const container = document.getElementById('weeklyReport');
    if (!container) return;
    
    const last7Days = [];
    let totalScreenTime = 0;
    let totalTasks = 0;
    let totalFocusSessions = 0;
    
    for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toDateString();
        
        const screenTime = state.screenTime[dateStr] || 0;
        totalScreenTime += screenTime;
        
        const tasks = state.tasks.filter(t => 
            t.completed && new Date(t.completedAt).toDateString() === dateStr
        ).length;
        totalTasks += tasks;
        
        const sessions = state.focusSessions.filter(s => 
            new Date(s.date).toDateString() === dateStr
        ).length;
        totalFocusSessions += sessions;
    }
    
    const avgScreenTime = totalScreenTime / 7 / 3600;
    const avgTasks = totalTasks / 7;
    const avgSessions = totalFocusSessions / 7;
    
    container.innerHTML = `
        <div class="report-card">
            <h4>📊 Weekly Summary</h4>
            <div class="report-stats">
                <div class="report-stat">
                    <span class="report-label">Total Screen Time</span>
                    <span class="report-value">${Math.floor(totalScreenTime / 3600)}h ${Math.floor((totalScreenTime % 3600) / 60)}m</span>
                </div>
                <div class="report-stat">
                    <span class="report-label">Avg. Daily Screen Time</span>
                    <span class="report-value">${avgScreenTime.toFixed(1)}h</span>
                </div>
                <div class="report-stat">
                    <span class="report-label">Tasks Completed</span>
                    <span class="report-value">${totalTasks}</span>
                </div>
                <div class="report-stat">
                    <span class="report-label">Avg. Daily Tasks</span>
                    <span class="report-value">${avgTasks.toFixed(1)}</span>
                </div>
                <div class="report-stat">
                    <span class="report-label">Focus Sessions</span>
                    <span class="report-value">${totalFocusSessions}</span>
                </div>
                <div class="report-stat">
                    <span class="report-label">Avg. Daily Sessions</span>
                    <span class="report-value">${avgSessions.toFixed(1)}</span>
                </div>
            </div>
            <div class="report-insights">
                <h5>💡 Insights</h5>
                <p>${avgScreenTime > 8 ? '⚠️ Your screen time is above average. Consider taking more breaks.' : '✅ Your screen time is well managed!'}</p>
                <p>${avgTasks >= 3 ? '🎉 Great job staying on top of your tasks!' : '📈 Try to complete more tasks daily for better productivity.'}</p>
                <p>${avgSessions >= 2 ? '🔥 Excellent focus! Keep up the great work!' : '🎯 More focus sessions could boost your productivity.'}</p>
            </div>
        </div>
    `;
    
    showToast('Weekly report generated!', '📊');
});

// ============ SETTINGS ============
document.getElementById('enableNotifs')?.addEventListener('change', (e) => {
    state.settings.enableNotifs = e.target.checked;
    localStorage.setItem('settings', JSON.stringify(state.settings));
    if (e.target.checked && Notification.permission === 'default') {
        Notification.requestPermission();
    }
});

document.getElementById('reminderTime')?.addEventListener('change', (e) => {
    state.settings.reminderTime = parseInt(e.target.value);
    localStorage.setItem('settings', JSON.stringify(state.settings));
});

document.getElementById('maxScreenTime')?.addEventListener('change', (e) => {
    state.settings.maxScreenTime = parseInt(e.target.value);
    localStorage.setItem('settings', JSON.stringify(state.settings));
    updateGoalProgress();
});

document.getElementById('dailyTaskGoal')?.addEventListener('change', (e) => {
    state.settings.dailyTaskGoal = parseInt(e.target.value);
    localStorage.setItem('settings', JSON.stringify(state.settings));
    updateGoalProgress();
});

document.getElementById('enableAnimations')?.addEventListener('change', (e) => {
    state.settings.enableAnimations = e.target.checked;
    localStorage.setItem('settings', JSON.stringify(state.settings));
    document.body.style.setProperty('--animation-speed', e.target.checked ? '1' : '0');
});

document.getElementById('enableSounds')?.addEventListener('change', (e) => {
    state.settings.enableSounds = e.target.checked;
    localStorage.setItem('settings', JSON.stringify(state.settings));
});

document.getElementById('enableSmartInsights')?.addEventListener('change', (e) => {
    state.settings.enableSmartInsights = e.target.checked;
    localStorage.setItem('settings', JSON.stringify(state.settings));
    updateDashboard();
});

document.getElementById('enableMotivationalQuotes')?.addEventListener('change', (e) => {
    state.settings.enableMotivationalQuotes = e.target.checked;
    localStorage.setItem('settings', JSON.stringify(state.settings));
    if (e.target.checked) showRandomQuote();
});

document.getElementById('exportData')?.addEventListener('click', () => {
    const data = {
        tasks: state.tasks,
        screenTime: state.screenTime,
        appUsage: state.appUsage,
        focusSessions: state.focusSessions,
        achievements: state.achievements,
        settings: state.settings,
        exportDate: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `focus-data-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    showToast('Data exported!', '📥');
});

document.getElementById('exportCSV')?.addEventListener('click', () => {
    let csv = 'Date,Screen Time (hours),Tasks Completed,Focus Sessions\n';
    
    const dates = [...new Set([
        ...Object.keys(state.screenTime),
        ...state.tasks.filter(t => t.completed).map(t => new Date(t.completedAt).toDateString()),
        ...state.focusSessions.map(s => new Date(s.date).toDateString())
    ])].sort();
    
    dates.forEach(date => {
        const screenTime = (state.screenTime[date] || 0) / 3600;
        const tasks = state.tasks.filter(t => t.completed && new Date(t.completedAt).toDateString() === date).length;
        const sessions = state.focusSessions.filter(s => new Date(s.date).toDateString() === date).length;
        csv += `${date},${screenTime.toFixed(2)},${tasks},${sessions}\n`;
    });
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `focus-report-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    showToast('CSV report exported!', '📊');
});

document.getElementById('clearData')?.addEventListener('click', () => {
    if (confirm('Are you sure? This will delete all your data permanently.')) {
        localStorage.clear();
        showToast('All data cleared', '🗑️');
        setTimeout(() => location.reload(), 1000);
    }
});

// ============ NOTIFICATIONS ============
function checkReminders() {
    if (!state.settings.enableNotifs || Notification.permission !== 'granted') return;
    
    const now = new Date();
    const reminderMs = state.settings.reminderTime * 60 * 1000;
    
    state.tasks.forEach(task => {
        if (!task.completed && !task.notified) {
            const dueTime = new Date(task.due);
            const timeDiff = dueTime - now;
            
            if (timeDiff > 0 && timeDiff <= reminderMs) {
                new Notification('Task Reminder', {
                    body: `"${task.name}" is due soon!`,
                    icon: '⏰'
                });
                task.notified = true;
                saveTasks();
            }
        }
    });
    
    updateNotificationBadge();
}

function updateNotificationBadge() {
    const now = new Date();
    const upcoming = state.tasks.filter(t => {
        if (t.completed) return false;
        const dueTime = new Date(t.due);
        return dueTime > now && dueTime - now <= 3600000;
    }).length;
    
    const badge = document.getElementById('notifBadge');
    if (badge) {
        badge.textContent = upcoming;
        badge.style.display = upcoming > 0 ? 'block' : 'none';
    }
}

// ============ INITIALIZATION ============
function init() {
    document.getElementById('currentDate').textContent = new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    
    // Apply theme
    applyTheme(state.settings.theme);
    
    // Set settings values
    const settingsMap = {
        'enableNotifs': 'enableNotifs',
        'reminderTime': 'reminderTime',
        'maxScreenTime': 'maxScreenTime',
        'dailyTaskGoal': 'dailyTaskGoal',
        'themeSelect': 'theme',
        'enableAnimations': 'enableAnimations',
        'enableSounds': 'enableSounds',
        'enableSmartInsights': 'enableSmartInsights',
        'enableMotivationalQuotes': 'enableMotivationalQuotes',
        'enableBreakReminders': 'enableBreakReminders',
        'breakInterval': 'breakInterval'
    };
    
    Object.entries(settingsMap).forEach(([elId, setting]) => {
        const el = document.getElementById(elId);
        if (el) {
            if (el.type === 'checkbox') {
                el.checked = state.settings[setting];
            } else {
                el.value = state.settings[setting];
            }
        }
    });
    
    if (state.settings.enableNotifs && Notification.permission === 'default') {
        Notification.requestPermission();
    }
    
    startScreenTimeTracking();
    if (state.settings.enableBreakReminders) {
        startBreakReminders();
    }
    updateDashboard();
    updateAchievementCount();
    checkAchievements();
    
    setInterval(checkReminders, 30000);
    setInterval(updateNotificationBadge, 10000);
    setInterval(() => {
        if (state.currentChartType) renderWeeklyChart();
        updateGoalProgress();
    }, 60000);
}

init();


// ============ TASK MANAGEMENT (Additional Functions) ============
function saveTasks() {
    localStorage.setItem('tasks', JSON.stringify(state.tasks));
    checkAchievements();
}

function openTaskModal(task = null) {
    state.editingTask = task;
    const modal = document.getElementById('taskModal');
    
    if (task) {
        document.getElementById('modalTitle').textContent = 'Edit Task';
        document.getElementById('taskName').value = task.name;
        document.getElementById('taskCategory').value = task.category;
        document.getElementById('taskDue').value = task.due;
        document.getElementById('taskPriority').value = task.priority;
        document.getElementById('taskDesc').value = task.description || '';
    } else {
        document.getElementById('modalTitle').textContent = 'New Task';
        document.getElementById('taskName').value = '';
        document.getElementById('taskCategory').value = 'work';
        document.getElementById('taskDue').value = '';
        document.getElementById('taskPriority').value = 'medium';
        document.getElementById('taskDesc').value = '';
    }
    
    modal.classList.add('active');
}

function closeTaskModal() {
    document.getElementById('taskModal').classList.remove('active');
    state.editingTask = null;
}

document.getElementById('addTaskBtn')?.addEventListener('click', () => openTaskModal());
document.getElementById('closeModal')?.addEventListener('click', closeTaskModal);
document.getElementById('cancelTask')?.addEventListener('click', closeTaskModal);

document.getElementById('saveTask')?.addEventListener('click', () => {
    const name = document.getElementById('taskName').value.trim();
    const category = document.getElementById('taskCategory').value;
    const due = document.getElementById('taskDue').value;
    const priority = document.getElementById('taskPriority').value;
    const description = document.getElementById('taskDesc').value.trim();
    
    if (!name || !due) {
        showToast('Please fill in task name and due date', '⚠️');
        return;
    }
    
    if (state.editingTask) {
        const index = state.tasks.findIndex(t => t.id === state.editingTask.id);
        state.tasks[index] = {
            ...state.editingTask,
            name, category, due, priority, description
        };
        showToast('Task updated', '✓');
    } else {
        state.tasks.push({
            id: Date.now(),
            name, category, due, priority, description,
            completed: false,
            notified: false,
            createdAt: new Date().toISOString()
        });
        showToast('Task created', '✓');
    }
    
    saveTasks();
    closeTaskModal();
    renderTasks();
    updateDashboard();
});

function toggleTask(id) {
    const task = state.tasks.find(t => t.id === id);
    task.completed = !task.completed;
    task.completedAt = task.completed ? new Date().toISOString() : null;
    saveTasks();
    renderTasks();
    updateDashboard();
    
    if (task.completed) {
        showToast('Task completed! 🎉', '✓');
        if (state.settings.enableSounds) {
            playSound('complete');
        }
    }
}

function deleteTask(id) {
    if (confirm('Delete this task?')) {
        state.tasks = state.tasks.filter(t => t.id !== id);
        saveTasks();
        renderTasks();
        updateDashboard();
        showToast('Task deleted', '🗑️');
    }
}

function editTask(id) {
    const task = state.tasks.find(t => t.id === id);
    openTaskModal(task);
}

function filterTasks(filter) {
    state.currentFilter = filter;
    renderTasks();
}

function getFilteredTasks() {
    const now = new Date();
    const today = new Date().toDateString();
    
    return state.tasks.filter(task => {
        const dueDate = new Date(task.due);
        
        switch(state.currentFilter) {
            case 'today':
                return dueDate.toDateString() === today;
            case 'upcoming':
                return dueDate > now && !task.completed;
            case 'completed':
                return task.completed;
            case 'overdue':
                return dueDate < now && !task.completed;
            default:
                return true;
        }
    });
}

function renderTasks() {
    const filtered = getFilteredTasks();
    const high = filtered.filter(t => t.priority === 'high');
    const medium = filtered.filter(t => t.priority === 'medium');
    const low = filtered.filter(t => t.priority === 'low');
    
    renderTaskList('highPriorityTasks', high);
    renderTaskList('mediumPriorityTasks', medium);
    renderTaskList('lowPriorityTasks', low);
}

function renderTaskList(elementId, tasks) {
    const container = document.getElementById(elementId);
    if (!container) return;
    
    if (tasks.length === 0) {
        container.innerHTML = '<div class="empty-state">No tasks</div>';
        return;
    }
    
    container.innerHTML = tasks.map(task => {
        const dueDate = new Date(task.due);
        const now = new Date();
        const isOverdue = dueDate < now && !task.completed;
        
        const categoryIcons = {
            work: '💼', personal: '👤', study: '📚', health: '💪', other: '📌'
        };
        
        return `
            <div class="task-item ${task.completed ? 'completed' : ''}">
                <div class="task-checkbox ${task.completed ? 'checked' : ''}" onclick="toggleTask(${task.id})">
                    ${task.completed ? '✓' : ''}
                </div>
                <div class="task-info">
                    <div class="task-title">${task.name}</div>
                    <div class="task-meta">
                        <span>${categoryIcons[task.category]} ${task.category}</span>
                        <span>${isOverdue ? '⚠️ Overdue' : '📅 ' + dueDate.toLocaleString()}</span>
                    </div>
                </div>
                <div class="task-actions">
                    <button onclick="editTask(${task.id})" style="background: var(--primary); color: white;">Edit</button>
                    <button onclick="deleteTask(${task.id})" style="background: var(--danger); color: white;">Delete</button>
                </div>
            </div>
        `;
    }).join('');
}

document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        filterTasks(btn.dataset.filter);
    });
});

function calculateProductivityScore() {
    const completed = state.tasks.filter(t => t.completed).length;
    const total = state.tasks.length;
    const completionRate = total > 0 ? completed / total : 0;
    
    const hours = currentSeconds / 3600;
    const timeScore = Math.max(0, 1 - (hours / state.settings.maxScreenTime));
    
    const focusScore = state.focusSessions.filter(s => 
        new Date(s.date).toDateString() === new Date().toDateString()
    ).length / 3;
    
    return Math.round((completionRate * 0.4 + timeScore * 0.3 + Math.min(focusScore, 1) * 0.3) * 100);
}

function getScoreMessage(score) {
    if (score >= 90) return '🔥 Outstanding!';
    if (score >= 80) return '🌟 Excellent!';
    if (score >= 70) return '👍 Great job!';
    if (score >= 60) return '💪 Good work!';
    if (score >= 50) return '📈 Keep going!';
    return '🎯 Room to improve';
}

function renderUpcomingTasks() {
    const upcoming = state.tasks
        .filter(t => !t.completed && new Date(t.due) > new Date())
        .sort((a, b) => new Date(a.due) - new Date(b.due))
        .slice(0, 5);
    
    const container = document.getElementById('upcomingTasks');
    if (!container) return;
    
    if (upcoming.length === 0) {
        container.innerHTML = '<div class="empty-state">No upcoming tasks</div>';
        return;
    }
    
    container.innerHTML = upcoming.map(task => {
        const priorityColors = { high: '#ef4444', medium: '#f59e0b', low: '#10b981' };
        return `
            <div class="task-item" style="border-left: 3px solid ${priorityColors[task.priority]}">
                <div class="task-info">
                    <div class="task-title">${task.name}</div>
                    <div class="task-meta">
                        <span>📅 ${new Date(task.due).toLocaleString()}</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

document.getElementById('viewAllTasks')?.addEventListener('click', () => {
    document.querySelector('[data-page="tasks"]').click();
});

function updateStreak() {
    const dates = Object.keys(state.screenTime).sort().reverse();
    let streak = 0;
    const today = new Date();
    
    for (let i = 0; i < dates.length; i++) {
        const checkDate = new Date(today);
        checkDate.setDate(checkDate.getDate() - i);
        if (dates[i] === checkDate.toDateString()) {
            streak++;
        } else {
            break;
        }
    }
    
    const el = document.getElementById('streakCount');
    if (el) el.textContent = streak;
}

function updateSmartInsights() {
    if (!state.settings.enableSmartInsights) return;
    
    const container = document.getElementById('smartInsights');
    if (!container) return;
    
    const insights = [];
    
    const completed = state.tasks.filter(t => t.completed).length;
    const total = state.tasks.length;
    if (total > 0) {
        const rate = Math.round(completed / total * 100);
        if (rate >= 80) {
            insights.push('🎉 Amazing! You\'re crushing your tasks today!');
        } else if (rate < 50 && total >= 3) {
            insights.push('💪 You have several pending tasks. Focus on completing them!');
        }
    }
    
    const hours = currentSeconds / 3600;
    if (hours > state.settings.maxScreenTime * 0.8) {
        insights.push('⚠️ You\'re approaching your screen time limit. Consider taking a break.');
    } else if (hours < 2) {
        insights.push('✨ Great start! You\'re managing your screen time well.');
    }
    
    const todaySessions = state.focusSessions.filter(s => 
        new Date(s.date).toDateString() === new Date().toDateString()
    ).length;
    if (todaySessions === 0) {
        insights.push('🎯 Try a focus session to boost your productivity!');
    } else if (todaySessions >= 3) {
        insights.push('🔥 Excellent focus today! You completed ' + todaySessions + ' sessions!');
    }
    
    const overdue = state.tasks.filter(t => !t.completed && new Date(t.due) < new Date()).length;
    if (overdue > 0) {
        insights.push(`⏰ You have ${overdue} overdue task${overdue > 1 ? 's' : ''}. Prioritize them!`);
    }
    
    container.innerHTML = insights.map(insight => 
        `<div class="insight-item">${insight}</div>`
    ).join('');
}

function updateDashboard() {
    updateScreenTimeDisplay();
    const el = document.getElementById('timeChange');
    if (el) el.textContent = calculateTimeChange() + ' from yesterday';
    
    const completed = state.tasks.filter(t => t.completed).length;
    const total = state.tasks.length;
    const completedEl = document.getElementById('completedCount');
    const progressEl = document.getElementById('taskProgress');
    if (completedEl) completedEl.textContent = `${completed}/${total}`;
    if (progressEl) progressEl.textContent = total > 0 ? `${Math.round(completed/total*100)}% completion` : '0% completion';
    
    const score = calculateProductivityScore();
    const scoreEl = document.getElementById('productivityScore');
    const scoreChangeEl = document.getElementById('scoreChange');
    if (scoreEl) scoreEl.textContent = score;
    if (scoreChangeEl) scoreChangeEl.textContent = getScoreMessage(score);
    
    const sessions = state.focusSessions.filter(s => new Date(s.date).toDateString() === new Date().toDateString()).length;
    const sessionsEl = document.getElementById('focusSessions');
    if (sessionsEl) sessionsEl.textContent = sessions;
    
    renderUpcomingTasks();
    renderAppUsageList();
    renderCharts();
    updateStreak();
    updateSmartInsights();
    showRandomQuote();
}
// Additional features - include this after renderer.js

// ============ TASK MANAGEMENT ============
function saveTasks() {
    localStorage.setItem('tasks', JSON.stringify(state.tasks));
    checkAchievements();
}

function openTaskModal(task = null) {
    state.editingTask = task;
    const modal = document.getElementById('taskModal');
    
    if (task) {
        document.getElementById('modalTitle').textContent = 'Edit Task';
        document.getElementById('taskName').value = task.name;
        document.getElementById('taskCategory').value = task.category;
        document.getElementById('taskDue').value = task.due;
        document.getElementById('taskPriority').value = task.priority;
        document.getElementById('taskDesc').value = task.description || '';
    } else {
        document.getElementById('modalTitle').textContent = 'New Task';
        document.getElementById('taskName').value = '';
        document.getElementById('taskCategory').value = 'work';
        document.getElementById('taskDue').value = '';
        document.getElementById('taskPriority').value = 'medium';
        document.getElementById('taskDesc').value = '';
    }
    
    modal.classList.add('active');
}

function closeTaskModal() {
    document.getElementById('taskModal').classList.remove('active');
    state.editingTask = null;
}

document.getElementById('addTaskBtn').addEventListener('click', () => openTaskModal());
document.getElementById('closeModal').addEventListener('click', closeTaskModal);
document.getElementById('cancelTask').addEventListener('click', closeTaskModal);

document.getElementById('saveTask').addEventListener('click', () => {
    const name = document.getElementById('taskName').value.trim();
    const category = document.getElementById('taskCategory').value;
    const due = document.getElementById('taskDue').value;
    const priority = document.getElementById('taskPriority').value;
    const description = document.getElementById('taskDesc').value.trim();
    
    if (!name || !due) {
        showToast('Please fill in task name and due date', '⚠️');
        return;
    }
    
    if (state.editingTask) {
        const index = state.tasks.findIndex(t => t.id === state.editingTask.id);
        state.tasks[index] = {
            ...state.editingTask,
            name, category, due, priority, description
        };
        showToast('Task updated', '✓');
    } else {
        state.tasks.push({
            id: Date.now(),
            name, category, due, priority, description,
            completed: false,
            notified: false,
            createdAt: new Date().toISOString()
        });
        showToast('Task created', '✓');
    }
    
    saveTasks();
    closeTaskModal();
    renderTasks();
    updateDashboard();
});

function toggleTask(id) {
    const task = state.tasks.find(t => t.id === id);
    task.completed = !task.completed;
    task.completedAt = task.completed ? new Date().toISOString() : null;
    saveTasks();
    renderTasks();
    updateDashboard();
    
    if (task.completed) {
        showToast('Task completed! 🎉', '✓');
        if (state.settings.enableSounds) {
            playSound('complete');
        }
    }
}

function deleteTask(id) {
    if (confirm('Delete this task?')) {
        state.tasks = state.tasks.filter(t => t.id !== id);
        saveTasks();
        renderTasks();
        updateDashboard();
        showToast('Task deleted', '🗑️');
    }
}

function editTask(id) {
    const task = state.tasks.find(t => t.id === id);
    openTaskModal(task);
}

function filterTasks(filter) {
    state.currentFilter = filter;
    renderTasks();
}

function getFilteredTasks() {
    const now = new Date();
    const today = new Date().toDateString();
    
    return state.tasks.filter(task => {
        const dueDate = new Date(task.due);
        
        switch(state.currentFilter) {
            case 'today':
                return dueDate.toDateString() === today;
            case 'upcoming':
                return dueDate > now && !task.completed;
            case 'completed':
                return task.completed;
            case 'overdue':
                return dueDate < now && !task.completed;
            default:
                return true;
        }
    });
}

function renderTasks() {
    const filtered = getFilteredTasks();
    const high = filtered.filter(t => t.priority === 'high');
    const medium = filtered.filter(t => t.priority === 'medium');
    const low = filtered.filter(t => t.priority === 'low');
    
    renderTaskList('highPriorityTasks', high);
    renderTaskList('mediumPriorityTasks', medium);
    renderTaskList('lowPriorityTasks', low);
}

function renderTaskList(elementId, tasks) {
    const container = document.getElementById(elementId);
    
    if (tasks.length === 0) {
        container.innerHTML = '<div class="empty-state">No tasks</div>';
        return;
    }
    
    container.innerHTML = tasks.map(task => {
        const dueDate = new Date(task.due);
        const now = new Date();
        const isOverdue = dueDate < now && !task.completed;
        
        const categoryIcons = {
            work: '💼', personal: '👤', study: '📚', health: '💪', other: '📌'
        };
        
        return `
            <div class="task-item ${task.completed ? 'completed' : ''}">
                <div class="task-checkbox ${task.completed ? 'checked' : ''}" onclick="toggleTask(${task.id})">
                    ${task.completed ? '✓' : ''}
                </div>
                <div class="task-info">
                    <div class="task-title">${task.name}</div>
                    <div class="task-meta">
                        <span>${categoryIcons[task.category]} ${task.category}</span>
                        <span>${isOverdue ? '⚠️ Overdue' : '📅 ' + dueDate.toLocaleString()}</span>
                    </div>
                </div>
                <div class="task-actions">
                    <button onclick="editTask(${task.id})" style="background: var(--primary); color: white;">Edit</button>
                    <button onclick="deleteTask(${task.id})" style="background: var(--danger); color: white;">Delete</button>
                </div>
            </div>
        `;
    }).join('');
}

document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        filterTasks(btn.dataset.filter);
    });
});

// ============ DASHBOARD ============
function updateDashboard() {
    updateScreenTimeDisplay();
    const el = document.getElementById('timeChange');
    if (el) el.textContent = calculateTimeChange() + ' from yesterday';
    
    const completed = state.tasks.filter(t => t.completed).length;
    const total = state.tasks.length;
    const completedEl = document.getElementById('completedCount');
    const progressEl = document.getElementById('taskProgress');
    if (completedEl) completedEl.textContent = `${completed}/${total}`;
    if (progressEl) progressEl.textContent = total > 0 ? `${Math.round(completed/total*100)}% completion` : '0% completion';
    
    const score = calculateProductivityScore();
    const scoreEl = document.getElementById('productivityScore');
    const scoreChangeEl = document.getElementById('scoreChange');
    if (scoreEl) scoreEl.textContent = score;
    if (scoreChangeEl) scoreChangeEl.textContent = getScoreMessage(score);
    
    const sessions = state.focusSessions.filter(s => new Date(s.date).toDateString() === new Date().toDateString()).length;
    const sessionsEl = document.getElementById('focusSessions');
    if (sessionsEl) sessionsEl.textContent = sessions;
    
    renderUpcomingTasks();
    renderAppUsageList();
    renderCharts();
    updateStreak();
    updateSmartInsights();
    showRandomQuote();
}

function calculateProductivityScore() {
    const completed = state.tasks.filter(t => t.completed).length;
    const total = state.tasks.length;
    const completionRate = total > 0 ? completed / total : 0;
    
    const hours = currentSeconds / 3600;
    const timeScore = Math.max(0, 1 - (hours / state.settings.maxScreenTime));
    
    const focusScore = state.focusSessions.filter(s => 
        new Date(s.date).toDateString() === new Date().toDateString()
    ).length / 3;
    
    return Math.round((completionRate * 0.4 + timeScore * 0.3 + Math.min(focusScore, 1) * 0.3) * 100);
}

function getScoreMessage(score) {
    if (score >= 90) return '🔥 Outstanding!';
    if (score >= 80) return '🌟 Excellent!';
    if (score >= 70) return '👍 Great job!';
    if (score >= 60) return '💪 Good work!';
    if (score >= 50) return '📈 Keep going!';
    return '🎯 Room to improve';
}

function renderUpcomingTasks() {
    const upcoming = state.tasks
        .filter(t => !t.completed && new Date(t.due) > new Date())
        .sort((a, b) => new Date(a.due) - new Date(b.due))
        .slice(0, 5);
    
    const container = document.getElementById('upcomingTasks');
    if (!container) return;
    
    if (upcoming.length === 0) {
        container.innerHTML = '<div class="empty-state">No upcoming tasks</div>';
        return;
    }
    
    container.innerHTML = upcoming.map(task => {
        const priorityColors = { high: '#ef4444', medium: '#f59e0b', low: '#10b981' };
        return `
            <div class="task-item" style="border-left: 3px solid ${priorityColors[task.priority]}">
                <div class="task-info">
                    <div class="task-title">${task.name}</div>
                    <div class="task-meta">
                        <span>📅 ${new Date(task.due).toLocaleString()}</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

document.getElementById('viewAllTasks')?.addEventListener('click', () => {
    document.querySelector('[data-page="tasks"]').click();
});

function updateStreak() {
    const dates = Object.keys(state.screenTime).sort().reverse();
    let streak = 0;
    const today = new Date();
    
    for (let i = 0; i < dates.length; i++) {
        const checkDate = new Date(today);
        checkDate.setDate(checkDate.getDate() - i);
        if (dates[i] === checkDate.toDateString()) {
            streak++;
        } else {
            break;
        }
    }
    
    const el = document.getElementById('streakCount');
    if (el) el.textContent = streak;
}

function updateSmartInsights() {
    if (!state.settings.enableSmartInsights) return;
    
    const container = document.getElementById('smartInsights');
    if (!container) return;
    
    const insights = [];
    
    // Task completion insight
    const completed = state.tasks.filter(t => t.completed).length;
    const total = state.tasks.length;
    if (total > 0) {
        const rate = Math.round(completed / total * 100);
        if (rate >= 80) {
            insights.push('🎉 Amazing! You\'re crushing your tasks today!');
        } else if (rate < 50 && total >= 3) {
            insights.push('💪 You have several pending tasks. Focus on completing them!');
        }
    }
    
    // Screen time insight
    const hours = currentSeconds / 3600;
    if (hours > state.settings.maxScreenTime * 0.8) {
        insights.push('⚠️ You\'re approaching your screen time limit. Consider taking a break.');
    } else if (hours < 2) {
        insights.push('✨ Great start! You\'re managing your screen time well.');
    }
    
    // Focus session insight
    const todaySessions = state.focusSessions.filter(s => 
        new Date(s.date).toDateString() === new Date().toDateString()
    ).length;
    if (todaySessions === 0) {
        insights.push('🎯 Try a focus session to boost your productivity!');
    } else if (todaySessions >= 3) {
        insights.push('🔥 Excellent focus today! You completed ' + todaySessions + ' sessions!');
    }
    
    // Overdue tasks
    const overdue = state.tasks.filter(t => !t.completed && new Date(t.due) < new Date()).length;
    if (overdue > 0) {
        insights.push(`⏰ You have ${overdue} overdue task${overdue > 1 ? 's' : ''}. Prioritize them!`);
    }
    
    container.innerHTML = insights.map(insight => 
        `<div class="insight-item">${insight}</div>`
    ).join('');
}
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('api', {
  getScreenTime: () => ipcRenderer.invoke('get-screen-time'),
  getTasks: () => ipcRenderer.invoke('get-tasks'),
  saveTask: (task) => ipcRenderer.invoke('save-task', task),
  deleteTask: (taskId) => ipcRenderer.invoke('delete-task', taskId),
  updateTask: (task) => ipcRenderer.invoke('update-task', task)
});
