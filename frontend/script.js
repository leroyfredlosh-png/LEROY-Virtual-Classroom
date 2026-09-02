const toast = document.querySelector('#toast');
let toastTimer;

function getToken() {
	return localStorage.getItem('leroy-token');
}

function setAuthenticatedUser(user) {
	localStorage.setItem('leroy-user', JSON.stringify(user));
}

async function fetchWithAuth(url, options = {}) {
	const token = getToken();
	const headers = { ...(options.headers || {}) };
	if (token) headers.Authorization = `Bearer ${token}`;
	const response = await fetch(url, { ...options, headers });
	const data = await response.json().catch(() => ({}));
	if (!response.ok) throw new Error(data.error || 'Request failed');
	return data;
}

async function apiRequest(url, payload) {
	const response = await fetch(url, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(payload)
	});

	const data = await response.json().catch(() => ({}));
	if (!response.ok) throw new Error(data.error || 'Request failed');
	return data;
}

function showToast(message) {
	toast.textContent = message;
	toast.classList.add('show');
	clearTimeout(toastTimer);
	toastTimer = setTimeout(() => toast.classList.remove('show'), 2600);
}

function showDialog(title, content, actionLabel = 'Close') {
	const existing = document.querySelector('.app-dialog-backdrop');
	if (existing) existing.remove();
	const backdrop = document.createElement('div');
	backdrop.className = 'app-dialog-backdrop';
	backdrop.innerHTML = `<section class="app-dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title"><button class="dialog-close" aria-label="Close dialog">×</button><p class="eyebrow">LEROY WORKSPACE</p><h2 id="dialog-title">${title}</h2><div class="dialog-content">${content}</div><button class="dialog-action">${actionLabel}</button></section>`;
	document.body.appendChild(backdrop);
	const close = () => backdrop.remove();
	backdrop.querySelectorAll('.dialog-option').forEach((option) => option.addEventListener('click', async () => {
		if (option.textContent.includes('Copy room invite')) {
			try { await navigator.clipboard.writeText(`${window.location.origin}/call.html?room=room-01`); } catch { showToast('Invite link is ready to copy from the address bar'); }
			close();
			showToast('Room invite copied');
			return;
		}
		const label = option.textContent.replace(/→|✓|＋|Selected|On|Test|12 questions|12 items/g, '').trim();
		close();
		showToast(`${label || 'Action'} selected`);
	}));
	backdrop.querySelector('.dialog-action').addEventListener('click', () => { if (!['Close', 'Done'].includes(actionLabel)) showToast(`${actionLabel} selected`); });
	backdrop.addEventListener('click', (event) => { if (event.target === backdrop || event.target.closest('.dialog-close') || event.target.closest('.dialog-action')) close(); });
}

function buildWorkspaceTools() {
	const section = document.createElement('section');
	section.id = 'workspace-tools';
	section.className = 'workspace-tools';
	section.innerHTML = `<div class="tools-heading"><div><p class="eyebrow">WORKSPACE TOOLS</p><h2>Keep everything in one place.</h2><p>Provision rooms and follow up with students without leaving your classroom.</p></div><span class="tools-badge">Connected to Leroy API</span></div><div class="tools-grid"><div class="tool-panel"><div class="tool-panel-heading"><div><p class="eyebrow">ROOM MANAGEMENT</p><h3>Create a scheduled room</h3></div><span class="tool-icon">＋</span></div><form id="inline-room-form"><div class="form-row"><label>Room name<input name="title" required placeholder="e.g. Ocean ecosystems" /></label><label>Year group<input name="year" required placeholder="e.g. Year 8" /></label></div><label>Subject<input name="subject" required placeholder="e.g. Biology Lab" /></label><label>Description<textarea name="description" rows="2" placeholder="What will students explore?"></textarea></label><button class="primary-button" type="submit">Create scheduled room <span>→</span></button><p class="inline-message" id="inline-room-message" role="status"></p></form></div><div class="tool-panel"><div class="tool-panel-heading"><div><p class="eyebrow">STUDENT SUPPORT</p><h3>Internship check-in</h3></div><span class="tool-icon coral-icon">☎</span></div><form id="inline-checkin-form"><label>Student<select name="studentId" id="inline-student-select" required><option value="">Choose a student</option></select></label><div class="form-row"><label>Outcome<select name="status"><option value="complete">Completed</option><option value="scheduled">Follow-up needed</option><option value="needs-call">Could not reach</option></select></label><label>Next call<input name="nextCall" required placeholder="Friday, Nov 01" /></label></div><label>Call notes<textarea name="notes" rows="2" required placeholder="Progress, wellbeing, feedback, or support needed…"></textarea></label><button class="primary-button" type="submit">Save check-in <span>→</span></button><p class="inline-message" id="inline-checkin-message" role="status"></p></form></div></div><div class="tool-panel student-list-panel"><div class="tool-panel-heading"><div><p class="eyebrow">INTERNSHIP DIRECTORY</p><h3>Students to follow up with</h3></div><button class="text-button" id="open-backend-console">Open detailed view <span>↗</span></button></div><div class="student-chip-list" id="inline-student-list"><span class="loading-copy">Loading student records…</span></div></div>`;
	document.querySelector('.main-content').appendChild(section);
	return section;
}

function buildCallerTool() {
	const section = document.createElement('section');
	section.className = 'caller-tools workspace-tools';
	section.innerHTML = `<div class="tools-heading"><div><p class="eyebrow">CALL PARTICIPANTS</p><h2>Add someone to a call.</h2><p>Create a private invite for a student, mentor, parent, or colleague using their email address.</p></div><span class="tools-badge">Invite links are private</span></div><div class="caller-layout"><div class="tool-panel"><div class="tool-panel-heading"><div><p class="eyebrow">NEW CALLER</p><h3>Caller details</h3></div><span class="tool-icon coral-icon">✉</span></div><form id="caller-form"><div class="form-row"><label>Full name<input name="name" required placeholder="e.g. Jordan Lee" /></label><label>Email address<input name="email" type="email" required placeholder="name@example.com" /></label></div><div class="form-row"><label>Relationship<select name="relationship" required><option value="Student">Student</option><option value="Internship mentor">Internship mentor</option><option value="Parent or guardian">Parent or guardian</option><option value="Colleague">Colleague</option></select></label><label>Phone (optional)<input name="phone" type="tel" placeholder="+1 555 000 0000" /></label></div><button class="primary-button" type="submit">Add caller and create invite <span>→</span></button><p class="inline-message" id="caller-message" role="status"></p></form></div><div class="tool-panel caller-list-panel"><div class="tool-panel-heading"><div><p class="eyebrow">CALLER DIRECTORY</p><h3>People you can invite</h3></div><span class="panel-note" id="caller-count">Loading…</span></div><div class="caller-list" id="caller-list"><span class="loading-copy">Loading caller records…</span></div></div></div>`;
	document.querySelector('.main-content').appendChild(section);
	const list = section.querySelector('#caller-list');
	const renderCallers = (callers) => { section.querySelector('#caller-count').textContent = `${callers.length} caller${callers.length === 1 ? '' : 's'}`; list.innerHTML = callers.map((caller) => `<div class="caller-row"><span class="chip-avatar">${caller.name.split(' ').map((part) => part[0]).join('').slice(0, 2)}</span><span><strong>${caller.name}</strong><small>${caller.email} · ${caller.relationship}</small></span><button class="invite-caller" data-email="${caller.email}" data-name="${caller.name}" data-room="${caller.roomId}">Email invite ↗</button></div>`).join(''); list.querySelectorAll('.invite-caller').forEach((button) => button.addEventListener('click', () => { const link = `${window.location.origin}/call.html?room=${button.dataset.room}`; window.location.href = `mailto:${button.dataset.email}?subject=Leroy%20call%20invitation&body=Hi%20${encodeURIComponent(button.dataset.name)},%20join%20my%20Leroy%20call%20here%3A%20${encodeURIComponent(link)}`; })); };
	fetch('/api/callers').then((response) => response.json()).then((data) => renderCallers(data.callers)).catch(() => { list.textContent = 'Caller records are unavailable.'; });
	section.querySelector('#caller-form').addEventListener('submit', async (event) => { event.preventDefault(); const form = event.currentTarget; const message = section.querySelector('#caller-message'); message.textContent = 'Adding caller…'; try { const response = await fetch('/api/callers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.fromEntries(new FormData(form))) }); const result = await response.json(); if (!response.ok) throw new Error(result.error); message.textContent = `${result.caller.name} was added. Invite ready to email.`; form.reset(); const data = await fetch('/api/callers').then((res) => res.json()); renderCallers(data.callers); } catch (error) { message.textContent = error.message || 'Could not add caller.'; } });
}

async function loadWorkspaceTools() {
	const section = buildWorkspaceTools();
	try {
		const data = await fetch('/api/internships').then((response) => response.json());
		const students = data.internships;
		const select = section.querySelector('#inline-student-select');
		select.innerHTML += students.map((student) => `<option value="${student.id}">${student.studentName} · ${student.placement}</option>`).join('');
		section.querySelector('#inline-student-list').innerHTML = students.map((student) => `<button class="student-chip" data-student-id="${student.id}"><span class="chip-avatar">${student.studentName.split(' ').map((name) => name[0]).join('')}</span><span><strong>${student.studentName}</strong><small>${student.placement} · ${student.status === 'complete' ? 'Complete' : `Next call ${student.nextCall}`}</small></span><span class="chip-arrow">→</span></button>`).join('');
		section.querySelectorAll('.student-chip').forEach((chip) => chip.addEventListener('click', () => { select.value = chip.dataset.studentId; section.querySelector('#inline-checkin-form').scrollIntoView({ behavior: 'smooth', block: 'center' }); }));
	} catch { section.querySelector('#inline-student-list').textContent = 'Student records are unavailable.'; }
	section.querySelector('#open-backend-console').addEventListener('click', () => { window.location.href = '/backend/backend.html'; });
	section.querySelector('#inline-room-form').addEventListener('submit', async (event) => {
		event.preventDefault();
		const form = event.currentTarget;
		const status = section.querySelector('#inline-room-message');
		status.textContent = 'Creating room…';
		try { const response = await fetch('/api/rooms', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(Object.fromEntries(new FormData(form))) }); const room = await response.json(); if (!response.ok) throw new Error(room.error); status.textContent = `${room.title} is ready as ${room.code}.`; form.reset(); loadLiveDashboard(); } catch (error) { status.textContent = error.message || 'Could not create room.'; }
	});
	section.querySelector('#inline-checkin-form').addEventListener('submit', async (event) => {
		event.preventDefault();
		const form = event.currentTarget;
		const status = section.querySelector('#inline-checkin-message');
		status.textContent = 'Saving check-in…';
		try { const response = await fetch('/api/internships/check-ins', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(Object.fromEntries(new FormData(form))) }); const result = await response.json(); if (!response.ok) throw new Error(result.error); status.textContent = result.message; form.reset(); } catch (error) { status.textContent = error.message || 'Could not save check-in.'; }
	});
}

function applyAuthGate() {
	const token = getToken();
	const authPage = document.querySelector('.auth-page');
	const appShell = document.querySelector('.app-shell');
	if (!token) {
		if (authPage) authPage.style.display = 'block';
		if (appShell) appShell.style.display = 'none';
		return false;
	}
	if (authPage) authPage.style.display = 'none';
	if (appShell) appShell.style.display = 'flex';
	return true;
}

async function restoreUserSession() {
	const token = getToken();
	if (!token) return false;
	try {
		const result = await fetchWithAuth('/api/auth/me');
		setAuthenticatedUser(result.user);
		const profileName = document.querySelector('.profile b');
		if (profileName) profileName.textContent = result.user.fullName;
		const profileMeta = document.querySelector('.profile small');
		if (profileMeta) profileMeta.textContent = result.user.role || 'Teacher';
		applyAuthGate();
		return true;
	} catch (error) {
		localStorage.removeItem('leroy-token');
		localStorage.removeItem('leroy-user');
		applyAuthGate();
		return false;
	}
}

document.querySelector('#enter-room').addEventListener('click', () => showToast('Opening Astronomy Lab…'));
document.querySelector('#create-room').addEventListener('click', () => { document.querySelector('#workspace-tools').scrollIntoView({ behavior: 'smooth' }); document.querySelector('#inline-room-form input[name="title"]').focus(); });
document.querySelector('#enter-room').addEventListener('click', () => {
	window.setTimeout(() => { window.location.href = '/call.html?room=room-01'; }, 450);
});
document.querySelector('.room-footer .text-button').addEventListener('click', () => { document.querySelector('#workspace-tools').scrollIntoView({ behavior: 'smooth' }); });
document.querySelector('.breadcrumb').firstChild.textContent = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(new Date());
document.querySelector('.school-switcher .icon-button').addEventListener('click', () => showDialog('Switch workspace', '<p class="dialog-lede">You are currently working in <strong>Riverside Middle</strong>.</p><button class="dialog-option">Riverside Middle <span>Selected</span></button><button class="dialog-option">Add another school <span>＋</span></button>'));
document.querySelector('.round-button').addEventListener('click', () => showDialog('Notifications', '<p class="dialog-lede">You are all caught up.</p><div class="dialog-list-item"><span class="status-dot"></span><span><strong>Astronomy Lab is live</strong><small>18 students are currently in the room.</small></span></div><div class="dialog-list-item"><span class="status-dot"></span><span><strong>Internship follow-up due</strong><small>Maya Johnson is ready for a check-in.</small></span></div>'));
document.querySelector('.help-button').addEventListener('click', () => showDialog('Help center', '<p class="dialog-lede">Find a quick answer or contact the Leroy team.</p><button class="dialog-option">Getting started <span>→</span></button><button class="dialog-option">Audio and video troubleshooting <span>→</span></button><button class="dialog-option">Contact support <span>→</span></button>', 'Done'));
document.querySelector('.profile .icon-button').addEventListener('click', () => showDialog('Leroy-Fred', '<p class="dialog-lede">leroyfredlosh@gmail.com · Science teacher · Riverside Middle</p><button class="dialog-option">Account details <span>→</span></button><button class="dialog-option">Sign out <span>→</span></button>'));
document.querySelector('.detail-heading .more-button').addEventListener('click', () => showDialog('Astronomy Lab', '<p class="dialog-lede">Room COSMOS-01 is live with 18 students.</p><button class="dialog-option">Copy room invite <span>↗</span></button><button class="dialog-option">Room settings <span>→</span></button>'));
document.querySelector('#calendar .text-button').addEventListener('click', () => showDialog('Today’s calendar', '<div class="dialog-list-item"><span class="calendar-time">10:00</span><span><strong>Exploring the cosmos</strong><small>Live now · Year 8</small></span></div><div class="dialog-list-item"><span class="calendar-time">01:30</span><span><strong>Mission: Mars</strong><small>Scheduled · Year 7</small></span></div><div class="dialog-list-item"><span class="calendar-time">03:45</span><span><strong>Open studio</strong><small>Scheduled · Year 8</small></span></div>'));
document.querySelector('.activity-block .more-button').addEventListener('click', () => showDialog('Recent activity', '<p class="dialog-lede">Your latest classroom materials are ready.</p><button class="dialog-option">Sort by newest <span>✓</span></button><button class="dialog-option">View all activity <span>→</span></button>'));
document.querySelectorAll('.activity-card .circle-arrow').forEach((button) => button.addEventListener('click', () => showToast(`${button.closest('.activity-card').querySelector('strong').textContent} opened`)));
document.querySelectorAll('.nav-item[href="#library"]').forEach((item) => item.addEventListener('click', (event) => { event.preventDefault(); showDialog('Resource library', '<p class="dialog-lede">12 resources are ready for your next class.</p><button class="dialog-option">Solar system quiz <span>12 questions</span></button><button class="dialog-option">Week 4 resources <span>12 items</span></button>', 'Open library'); }));
document.querySelectorAll('.nav-item[href="#settings"]').forEach((item) => item.addEventListener('click', (event) => { event.preventDefault(); showDialog('Settings', '<p class="dialog-lede">Manage your workspace preferences.</p><button class="dialog-option">Notifications <span>On</span></button><button class="dialog-option">Camera and microphone <span>Test</span></button><button class="dialog-option">Workspace details <span>→</span></button>'); }));

async function loadLiveDashboard() {
	try {
		const dashboard = await fetch('/api/dashboard').then((response) => response.json());
		const room = dashboard.liveRoom;
		if (!room) return;
		document.querySelector('.visual-title span').textContent = room.code.replace('-', ' ');
		document.querySelector('.visual-title h2').innerHTML = `${room.title.split(' ')[0]}<br /><strong>${room.title.split(' ').slice(1).join(' ')}</strong>`;
		document.querySelector('.visual-title p').textContent = `${room.year} · ${room.subject}`;
		document.querySelector('.detail-heading h3').textContent = room.title;
		document.querySelector('.room-description').textContent = room.description;
		document.querySelectorAll('.room-stats strong')[0].firstChild.textContent = room.studentsHere;
		document.querySelectorAll('.room-stats strong')[1].firstChild.textContent = room.durationMinutes;
		document.querySelectorAll('.room-stats strong')[2].firstChild.textContent = room.participation;
	} catch { showToast('Using the saved classroom preview'); }
}
applyAuthGate();
restoreUserSession();
loadLiveDashboard();
loadWorkspaceTools();
buildCallerTool();
document.querySelectorAll('.nav-item').forEach((item) => {
	item.addEventListener('click', () => {
		document.querySelectorAll('.nav-item').forEach((navItem) => navItem.classList.remove('active'));
		item.classList.add('active');
	});
});

const registerForm = document.getElementById('register-form');
if (registerForm) {
	registerForm.addEventListener('submit', async (event) => {
		event.preventDefault();
		const form = new FormData(event.currentTarget);
		const payload = Object.fromEntries(form.entries());
		try {
			const result = await apiRequest('/api/auth/register', payload);
			localStorage.setItem('leroy-token', result.token);
			setAuthenticatedUser(result.user);
			showToast('Registration successful');
			registerForm.reset();
			applyAuthGate();
			console.log(result.user);
		} catch (error) {
			showToast(error.message);
		}
	});
}

const loginForm = document.getElementById('login-form');
if (loginForm) {
	loginForm.addEventListener('submit', async (event) => {
		event.preventDefault();
		const form = new FormData(event.currentTarget);
		const payload = Object.fromEntries(form.entries());
		try {
			const result = await apiRequest('/api/auth/login', payload);
			localStorage.setItem('leroy-token', result.token);
			setAuthenticatedUser(result.user);
			showToast('Login successful');
			loginForm.reset();
			applyAuthGate();
			console.log(result.user);
		} catch (error) {
			showToast(error.message);
		}
	});
}

const forgotForm = document.getElementById('forgot-form');
if (forgotForm) {
	forgotForm.addEventListener('submit', async (event) => {
		event.preventDefault();
		const form = new FormData(event.currentTarget);
		const payload = Object.fromEntries(form.entries());
		try {
			const result = await apiRequest('/api/auth/request-reset', payload);
			showToast(result.message);
			if (result.resetToken) {
				document.querySelector('#reset-form input[name="token"]').value = result.resetToken;
			}
			forgotForm.reset();
		} catch (error) {
			showToast(error.message);
		}
	});
}

const resetForm = document.getElementById('reset-form');
if (resetForm) {
	resetForm.addEventListener('submit', async (event) => {
		event.preventDefault();
		const form = new FormData(event.currentTarget);
		const payload = Object.fromEntries(form.entries());
		try {
			const result = await apiRequest('/api/auth/reset-password', payload);
			localStorage.setItem('leroy-token', result.token);
			showToast('Password reset successful');
			resetForm.reset();
		} catch (error) {
			showToast(error.message);
		}
	});
}
