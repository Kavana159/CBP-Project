// --- Firebase Configuration ---
// Make sure this is your actual config
const firebaseConfig = {
    apiKey: "AIzaSyDn1zyYJdbxIOdpE59i3SW4X8rr72r65Qs",
    authDomain: "study-planner-ac2ce.firebaseapp.com",
    projectId: "study-planner-ac2ce",
    storageBucket: "study-planner-ac2ce.firebasestorage.app",
    messagingSenderId: "400966071861",
    appId: "1:400966071861:web:bf019b73b50c08d16f237c"
};

if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
let currentUser = null;

// --- DOM Elements ---
const dateDisplay = document.getElementById('date-display');
const greetingText = document.getElementById('greeting-text');

// State
let tasks = [];
let notes = [];
let totalFocusSeconds = 0;
let currentFilter = 'all';
let isSigningUp = false;

// --- Auth Logic ---
const authOverlay = document.getElementById('auth-overlay');
const loginForm = document.getElementById('login-form');
const signupForm = document.getElementById('signup-form');
const forgotForm = document.getElementById('forgot-form');

document.getElementById('show-signup').onclick = (e) => { e.preventDefault(); loginForm.classList.remove('active'); signupForm.classList.add('active'); };
document.getElementById('show-login').onclick = (e) => { e.preventDefault(); signupForm.classList.remove('active'); loginForm.classList.add('active'); };
document.getElementById('show-forgot').onclick = (e) => { e.preventDefault(); loginForm.classList.remove('active'); forgotForm.classList.add('active'); };
document.getElementById('show-login-from-forgot').onclick = (e) => { e.preventDefault(); forgotForm.classList.remove('active'); loginForm.classList.add('active'); };

auth.onAuthStateChanged(user => {
    if (user) {
        if (isSigningUp) return; // Prevent auto-login on signup
        currentUser = user;
        authOverlay.classList.remove('active');
        loadUserData();
        showToast('Successfully logged in!');
    } else {
        currentUser = null;
        authOverlay.classList.add('active');
        tasks = []; notes = []; totalFocusSeconds = 0;
        renderAll();
    }
});

// Helper to convert Name to fake email for Firebase
function formatNameToEmail(name) {
    return name.trim().toLowerCase().replace(/[^a-z0-9]/g, '') + "@focusflow.app";
}

signupForm.onsubmit = (e) => {
    e.preventDefault();
    isSigningUp = true;
    const name = document.getElementById('signup-name').value.trim();
    if (!name) return alert("Please enter your name.");
    const email = formatNameToEmail(name);

    auth.createUserWithEmailAndPassword(email, document.getElementById('signup-password').value)
        .then((userCred) => {
            return userCred.user.updateProfile({ displayName: name });
        })
        .then(() => {
            auth.signOut().then(() => {
                isSigningUp = false;
                alert("Account created successfully! Please log in.");
                signupForm.classList.remove('active');
                loginForm.classList.add('active');
                signupForm.reset();
            });
        })
        .catch(err => {
            isSigningUp = false;
            alert(err.message);
        });
};

loginForm.onsubmit = (e) => {
    e.preventDefault();
    const name = document.getElementById('login-name').value.trim();
    if (!name) return alert("Please enter your name.");
    const email = formatNameToEmail(name);

    auth.signInWithEmailAndPassword(email, document.getElementById('login-password').value)
        .catch(err => {
            if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-email') {
                alert("Account not found or invalid password. If you haven't created an account yet, please Sign Up first.");
            } else {
                alert(err.message);
            }
        });
};

forgotForm.onsubmit = (e) => {
    e.preventDefault();
    auth.sendPasswordResetEmail(document.getElementById('forgot-email').value)
        .then(() => { alert('Reset email sent!'); forgotForm.classList.remove('active'); loginForm.classList.add('active'); })
        .catch(err => alert(err.message));
};

document.getElementById('nav-logout').onclick = (e) => { e.preventDefault(); auth.signOut(); };

// --- Tab Navigation ---
document.querySelectorAll('.nav-links li[data-tab]').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.nav-links li').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

        tab.classList.add('active');
        const tabId = tab.getAttribute('data-tab');
        document.getElementById('tab-' + tabId).classList.add('active');

        if (tabId === 'calendar') renderCalendar();
        if (tabId === 'analytics') renderAnalytics();
    });
});

// --- Settings & Theme ---
const themeToggleBtn = document.getElementById('theme-toggle');
const themeSwitch = document.getElementById('setting-theme');
const soundSwitch = document.getElementById('setting-sound');
const alarmToneSelect = document.getElementById('setting-alarm-tone');

const ALARM_TONES = {
    chime: 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3',
    digital: 'https://assets.mixkit.co/active_storage/sfx/995/995-preview.mp3',
    bell: 'https://assets.mixkit.co/active_storage/sfx/2870/2870-preview.mp3',
    synth: 'https://assets.mixkit.co/active_storage/sfx/2868/2868-preview.mp3',
    retro: 'https://assets.mixkit.co/active_storage/sfx/2871/2871-preview.mp3',
    marimba: 'https://assets.mixkit.co/active_storage/sfx/2861/2861-preview.mp3',
    harp: 'https://assets.mixkit.co/active_storage/sfx/2866/2866-preview.mp3',
    gong: 'https://assets.mixkit.co/active_storage/sfx/2872/2872-preview.mp3'
};

if (alarmToneSelect) {
    const savedTone = localStorage.getItem('alarmTone') || 'chime';
    alarmToneSelect.value = savedTone;
    alarmToneSelect.addEventListener('change', (e) => {
        localStorage.setItem('alarmTone', e.target.value);
        if (soundSwitch.checked) {
            new Audio(ALARM_TONES[e.target.value]).play().catch(() => { });
        }
    });
}

function toggleTheme() {
    document.body.classList.toggle('light-mode');
    const isLight = document.body.classList.contains('light-mode');
    localStorage.setItem('lightMode', isLight);
    themeSwitch.checked = !isLight;
    themeToggleBtn.innerHTML = isLight ? '<i class="fa-solid fa-sun"></i>' : '<i class="fa-solid fa-moon"></i>';
}

if (localStorage.getItem('lightMode') === 'true') {
    toggleTheme();
}
themeToggleBtn.addEventListener('click', toggleTheme);
themeSwitch.addEventListener('change', toggleTheme);

// --- Core Functions ---
function loadUserData() {
    if (!currentUser) return;
    tasks = JSON.parse(localStorage.getItem(`tasks_${currentUser.uid}`)) || [];
    notes = JSON.parse(localStorage.getItem(`notes_${currentUser.uid}`)) || [];
    totalFocusSeconds = parseInt(localStorage.getItem(`focus_${currentUser.uid}`)) || 0;

    updateHeader();
    renderAll();

    // Setup Sortable Drag and Drop
    new Sortable(document.getElementById('task-list'), {
        animation: 150,
        onEnd: function (evt) {
            // Reorder array based on DOM change (simplified approach)
            const newOrderIds = Array.from(document.getElementById('task-list').children).map(el => el.getAttribute('data-id'));
            const newTasks = [];
            newOrderIds.forEach(id => {
                const t = tasks.find(t => t.id === id);
                if (t) newTasks.push(t);
            });
            // Append any filtered out tasks back
            tasks.forEach(t => { if (!newTasks.includes(t)) newTasks.push(t); });
            tasks = newTasks;
            saveData();
        }
    });
}

function saveData() {
    if (!currentUser) return;
    localStorage.setItem(`tasks_${currentUser.uid}`, JSON.stringify(tasks));
    localStorage.setItem(`notes_${currentUser.uid}`, JSON.stringify(notes));
    localStorage.setItem(`focus_${currentUser.uid}`, totalFocusSeconds);
    updateStats();
    generateAIRecommendations();
}

function renderAll() {
    renderTasks();
    renderNotes();
    updateStats();
    generateAIRecommendations();
}

function updateHeader() {
    const now = new Date();
    dateDisplay.textContent = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
    const h = now.getHours();

    let userName = 'Student';
    if (currentUser) {
        if (currentUser.displayName) {
            userName = currentUser.displayName;
        } else if (currentUser.email) {
            userName = currentUser.email.split('@')[0]; // Fallback for accounts without a name
        }
    }

    greetingText.textContent = `${h < 12 ? 'Good Morning' : h < 18 ? 'Good Afternoon' : 'Good Evening'}, ${userName}`;

    // Update Profile Displays
    if (currentUser) {
        const initial = userName.charAt(0).toUpperCase();

        const sideName = document.getElementById('sidebar-user-name');
        if (sideName) sideName.textContent = userName;
        const sideIcon = document.getElementById('sidebar-user-icon');
        if (sideIcon) sideIcon.textContent = initial;

        const headerName = document.getElementById('header-user-name');
        if (headerName) headerName.textContent = userName;
        const headerIcon = document.getElementById('header-user-icon');
        if (headerIcon) headerIcon.textContent = initial;
    }
}

function showToast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 3000);
}

// --- Tasks ---
const taskModal = document.getElementById('task-modal');
const taskForm = document.getElementById('task-form');

document.getElementById('add-task-btn').onclick = () => {
    taskForm.reset();
    document.getElementById('task-id').value = '';
    document.getElementById('task-date').valueAsDate = new Date();
    taskModal.classList.add('active');
};

document.querySelectorAll('.close-modal').forEach(btn => {
    btn.onclick = (e) => e.target.closest('.modal-overlay').classList.remove('active');
});

taskForm.onsubmit = (e) => {
    e.preventDefault();
    const id = document.getElementById('task-id').value;
    const task = {
        id: id || Date.now().toString(),
        title: document.getElementById('task-title').value,
        subject: document.getElementById('task-subject').value,
        priority: document.getElementById('task-priority').value,
        date: document.getElementById('task-date').value,
        completed: id ? tasks.find(t => t.id === id).completed : false
    };

    if (id) tasks = tasks.map(t => t.id === id ? task : t);
    else tasks.push(task);

    saveData(); renderTasks();
    taskModal.classList.remove('active');
    showToast('Task saved!');
};

function toggleTask(id) {
    const t = tasks.find(t => t.id === id);
    if (t) { t.completed = !t.completed; saveData(); renderTasks(); }
}

function deleteTask(id) {
    tasks = tasks.filter(t => t.id !== id);
    saveData(); renderTasks(); showToast('Task deleted');
}

document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.onclick = (e) => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        currentFilter = e.target.dataset.filter;
        renderTasks();
    };
});

function renderTasks() {
    updateSubjectDatalist();

    const list = document.getElementById('task-list');
    list.innerHTML = '';
    let filtered = tasks;
    if (currentFilter === 'pending') filtered = tasks.filter(t => !t.completed);
    if (currentFilter === 'completed') filtered = tasks.filter(t => t.completed);

    if (!filtered.length) {
        list.innerHTML = `<div class="empty-state"><i class="fa-solid fa-check-double"></i><p>No tasks here.</p></div>`;
        return;
    }

    filtered.forEach(t => {
        const el = document.createElement('div');
        el.className = `task-item ${t.completed ? 'completed' : ''}`;
        el.setAttribute('data-subject', t.subject);
        el.setAttribute('data-id', t.id);
        el.innerHTML = `
            <input type="checkbox" class="task-checkbox" ${t.completed ? 'checked' : ''} onchange="toggleTask('${t.id}')">
            <div class="task-content">
                <div class="task-title">${t.title}</div>
                <div class="task-meta">
                    <span class="badge priority-${t.priority}">${t.priority}</span>
                    <span><i class="fa-regular fa-calendar"></i> ${new Date(t.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                </div>
            </div>
            <div class="task-actions">
                <button onclick="deleteTask('${t.id}')"><i class="fa-solid fa-trash"></i></button>
            </div>
        `;
        list.appendChild(el);
    });

    // Populate dashboard recent tasks
    const dashList = document.getElementById('dashboard-task-list');
    if (dashList) {
        dashList.innerHTML = '';
        const pendingTasks = tasks.filter(t => !t.completed).slice(0, 4); // Show top 4
        if (!pendingTasks.length) {
            dashList.innerHTML = `<div class="empty-state" style="padding: 1.5rem;"><p>No pending tasks! You're all caught up.</p></div>`;
        } else {
            pendingTasks.forEach(t => {
                const el = document.createElement('div');
                el.className = `task-item`;
                el.setAttribute('data-subject', t.subject);
                el.innerHTML = `
                    <input type="checkbox" class="task-checkbox" onchange="toggleTask('${t.id}')">
                    <div class="task-content">
                        <div class="task-title" style="font-size: 0.95rem;">${t.title}</div>
                        <div class="task-meta">
                            <span class="badge priority-${t.priority}" style="font-size: 0.65rem;">${t.priority}</span>
                        </div>
                    </div>
                `;
                dashList.appendChild(el);
            });
        }
    }
}

function updateStats() {
    document.getElementById('stat-total').textContent = tasks.length;
    const comp = tasks.filter(t => t.completed).length;
    document.getElementById('stat-completed').textContent = comp;
    document.getElementById('stat-score').textContent = tasks.length ? Math.round((comp / tasks.length) * 100) + '%' : '0%';
    document.getElementById('stat-focus').textContent = `${Math.floor(totalFocusSeconds / 3600)}h ${Math.floor((totalFocusSeconds % 3600) / 60)}m`;
}

function updateSubjectDatalist() {
    const defaultSubjects = ['Mathematics', 'Science', 'History', 'Literature', 'Other'];
    const allSubjects = tasks.map(t => t.subject);
    const customSubjects = [...new Set(allSubjects)].filter(s => !defaultSubjects.includes(s) && s.trim() !== '');

    const datalist = document.getElementById('subject-options');
    if (!datalist) return;
    datalist.innerHTML = '';

    defaultSubjects.concat(customSubjects).forEach(sub => {
        const option = document.createElement('option');
        option.value = sub;
        datalist.appendChild(option);
    });
}

// --- Pomodoro ---
const TIMER_MAP = { pomodoro: 50 * 60, shortBreak: 10 * 60, longBreak: 15 * 60 };
let currentMode = 'pomodoro', timeRemaining = TIMER_MAP.pomodoro, timerInt = null, isRunning = false;
let completedSessions = 0;
const circle = document.querySelector('.active-ring');
const circLength = circle.r.baseVal.value * 2 * Math.PI;
circle.style.strokeDasharray = `${circLength} ${circLength}`;

function updateTimerDisplay() {
    const m = Math.floor(timeRemaining / 60).toString().padStart(2, '0');
    const s = (timeRemaining % 60).toString().padStart(2, '0');
    document.getElementById('time-left').textContent = `${m}:${s}`;
    document.getElementById('mini-timer-display').textContent = `${m}:${s}`;
    circle.style.strokeDashoffset = circLength - (timeRemaining / TIMER_MAP[currentMode]) * circLength;
}

function toggleTimer() {
    const btn = document.getElementById('start-timer');
    if (isRunning) {
        clearInterval(timerInt); isRunning = false;
        btn.textContent = 'Start'; btn.className = 'btn primary-btn timer-btn';
    } else {
        isRunning = true;
        btn.textContent = 'Pause'; btn.className = 'btn secondary-btn timer-btn';
        timerInt = setInterval(() => {
            timeRemaining--;
            if (currentMode === 'pomodoro') {
                totalFocusSeconds++;
                if (totalFocusSeconds % 60 === 0) saveData();
            }
            updateTimerDisplay();

            if (timeRemaining <= 0) {
                clearInterval(timerInt); isRunning = false;
                if (soundSwitch.checked) {
                    const tone = localStorage.getItem('alarmTone') || 'chime';
                    const alarmAudio = new Audio(ALARM_TONES[tone]);
                    alarmAudio.loop = true;
                    alarmAudio.play().catch(e => { });

                    // Stop the alarm after exactly 10 seconds
                    setTimeout(() => {
                        alarmAudio.pause();
                        alarmAudio.currentTime = 0;
                    }, 10000);
                }

                let nextMode = 'pomodoro';
                if (currentMode === 'pomodoro') {
                    completedSessions++;
                    if (completedSessions % 4 === 0) {
                        nextMode = 'longBreak';
                        showToast('4 Sessions Complete! Time for a Long Break.');
                    } else {
                        nextMode = 'shortBreak';
                        showToast('Session Complete! Take a Short Break.');
                    }
                } else {
                    showToast('Break Complete! Time to Focus.');
                }

                switchMode(nextMode);
            }
        }, 1000);
    }
}

function switchMode(mode) {
    currentMode = mode;
    timeRemaining = TIMER_MAP[mode];
    document.querySelectorAll('.mode-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === mode));

    let color = 'var(--primary)';
    if (mode === 'shortBreak') color = 'var(--success)';
    if (mode === 'longBreak') color = 'var(--secondary)';
    circle.style.stroke = color;

    if (isRunning) toggleTimer(); // stop if running
    updateTimerDisplay();
}

document.getElementById('start-timer').onclick = toggleTimer;
document.getElementById('reset-timer').onclick = () => switchMode(currentMode);
document.querySelectorAll('.mode-btn').forEach(b => b.onclick = (e) => switchMode(e.target.dataset.mode));
updateTimerDisplay();

// --- Notes ---
const noteModal = document.getElementById('note-modal');
const noteForm = document.getElementById('note-form');

document.getElementById('add-note-btn').onclick = () => {
    noteForm.reset(); document.getElementById('note-id').value = '';
    noteModal.classList.add('active');
}

noteForm.onsubmit = (e) => {
    e.preventDefault();
    const id = document.getElementById('note-id').value;
    const note = {
        id: id || Date.now().toString(),
        title: document.getElementById('note-title').value,
        content: document.getElementById('note-content').value,
        date: new Date().toISOString()
    };
    if (id) notes = notes.map(n => n.id === id ? note : n);
    else notes.push(note);
    saveData(); renderNotes();
    noteModal.classList.remove('active');
    showToast('Note saved!');
}

function deleteNote(id) {
    notes = notes.filter(n => n.id !== id);
    saveData(); renderNotes();
}

function renderNotes() {
    const grid = document.getElementById('notes-grid');
    grid.innerHTML = '';
    notes.forEach(n => {
        const div = document.createElement('div');
        div.className = 'note-card';
        div.innerHTML = `
            <div class="note-header">
                <h4>${n.title}</h4>
                <div class="note-actions">
                    <button onclick="deleteNote('${n.id}')"><i class="fa-solid fa-trash"></i></button>
                </div>
            </div>
            <div class="note-content">${n.content}</div>
            <div class="note-date">${new Date(n.date).toLocaleDateString()}</div>
        `;
        grid.appendChild(div);
    });
}

// --- Calendar ---
let currMonth = new Date().getMonth();
let currYear = new Date().getFullYear();

function renderCalendar() {
    const grid = document.getElementById('calendar-grid');
    grid.innerHTML = '';
    document.getElementById('month-year-display').textContent = new Date(currYear, currMonth).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    days.forEach(d => grid.innerHTML += `<div class="cal-day-header">${d}</div>`);

    const firstDay = new Date(currYear, currMonth, 1).getDay();
    const daysInMonth = new Date(currYear, currMonth + 1, 0).getDate();

    for (let i = 0; i < firstDay; i++) grid.innerHTML += `<div class="cal-day empty"></div>`;

    for (let i = 1; i <= daysInMonth; i++) {
        const dateStr = `${currYear}-${String(currMonth + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
        const dayTasks = tasks.filter(t => t.date === dateStr);

        let html = `<div class="cal-day ${new Date().toDateString() === new Date(currYear, currMonth, i).toDateString() ? 'today' : ''}">
            <div class="date-num">${i}</div>`;
        dayTasks.slice(0, 3).forEach(t => html += `<div class="cal-task">${t.title}</div>`);
        if (dayTasks.length > 3) html += `<div class="cal-task">+${dayTasks.length - 3} more</div>`;
        html += `</div>`;
        grid.innerHTML += html;
    }
}
document.getElementById('prev-month').onclick = () => { currMonth--; if (currMonth < 0) { currMonth = 11; currYear--; } renderCalendar(); };
document.getElementById('next-month').onclick = () => { currMonth++; if (currMonth > 11) { currMonth = 0; currYear++; } renderCalendar(); };

// --- Analytics (Chart.js) ---
let focusChart, subChart;
function renderAnalytics() {
    const fCtx = document.getElementById('focusChart').getContext('2d');
    const sCtx = document.getElementById('subjectChart').getContext('2d');

    if (focusChart) focusChart.destroy();
    if (subChart) subChart.destroy();

    // Mock Data for focus
    focusChart = new Chart(fCtx, {
        type: 'bar',
        data: {
            labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
            datasets: [{
                label: 'Focus Hours',
                data: [2, 3.5, 1, 4, 2.5, 5, 0],
                backgroundColor: '#8b5cf6',
                borderRadius: 4
            }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });

    const subs = {};
    tasks.forEach(t => subs[t.subject] = (subs[t.subject] || 0) + 1);

    subChart = new Chart(sCtx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(subs).length ? Object.keys(subs) : ['No Tasks'],
            datasets: [{
                data: Object.keys(subs).length ? Object.values(subs) : [1],
                backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6']
            }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });
}

// --- AI Recommendations ---
function generateAIRecommendations() {
    const list = document.getElementById('ai-recs');
    list.innerHTML = '';
    const pending = tasks.filter(t => !t.completed);
    const high = pending.filter(t => t.priority === 'high');

    let recs = [];
    if (high.length > 0) {
        recs.push(`You have ${high.length} high priority tasks. Consider using a 50/10 Pomodoro session to tackle them!`);
        recs.push(`Start with "${high[0].title}" as it requires the most focus.`);
    } else if (pending.length > 0) {
        recs.push("Your task load is balanced. A standard 25/5 Pomodoro session is perfect for today.");
    } else {
        recs.push("You're all caught up! Great time to review some old notes or take a well-deserved break.");
    }

    if (totalFocusSeconds > 14400) { // > 4 hours
        recs.push("You've studied for over 4 hours. Ensure you're taking long breaks to prevent burnout.");
    }

    recs.forEach(r => {
        list.innerHTML += `<li>${r}</li>`;
    });
}
