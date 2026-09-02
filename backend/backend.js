const roomsTable = document.querySelector('#rooms-table');
const form = document.querySelector('#room-form');
const message = document.querySelector('#form-message');
const internshipsTable = document.querySelector('#internships-table');
const checkInForm = document.querySelector('#check-in-form');
const studentSelect = document.querySelector('#student-select');
const checkInMessage = document.querySelector('#check-in-message');

function setText(selector, value) {
	document.querySelector(selector).textContent = value;
}

function renderRooms(rooms) {
	roomsTable.innerHTML = rooms.map((room) => `<tr><td>${room.title}</td><td><span class="room-code">${room.code}</span></td><td>${room.year} · ${room.subject}</td><td><span class="status ${room.status}"><i></i>${room.status === 'live' ? 'Live now' : 'Scheduled'}</span></td><td>${room.studentsHere}</td></tr>`).join('');
}

function renderInternships(internships) {
	studentSelect.innerHTML = '<option value="">Choose a student</option>' + internships.map((internship) => `<option value="${internship.id}">${internship.studentName} · ${internship.placement}</option>`).join('');
	internshipsTable.innerHTML = internships.map((internship) => `<tr><td><div class="student-meta"><strong>${internship.studentName}</strong><small>${internship.email} · ${internship.phone}</small></div></td><td><div class="placement">${internship.placement}<small>Supervisor: ${internship.supervisor}</small></div></td><td>${internship.nextCall}</td><td><span class="call-status ${internship.status}"><i></i>${internship.status === 'needs-call' ? 'Needs call' : internship.status === 'complete' ? 'Complete' : 'Follow-up'}</span></td><td><button class="call-button" data-student-id="${internship.id}">${internship.status === 'complete' ? 'Review' : 'Call student'}</button></td></tr>`).join('');
	document.querySelectorAll('.call-button').forEach((button) => button.addEventListener('click', () => { studentSelect.value = button.dataset.studentId; checkInForm.scrollIntoView({ behavior: 'smooth', block: 'center' }); }));
	setText('#check-in-count', `${internships.filter((internship) => internship.status !== 'complete').length} follow-ups due`);
}

async function loadDashboard() {
	setText('#api-status', 'Checking…');
	try {
		const [health, dashboard, internshipData] = await Promise.all([
			fetch('/api/health').then((response) => response.json()),
			fetch('/api/dashboard').then((response) => response.json()),
			fetch('/api/internships').then((response) => response.json()),
		]);
		const liveRoom = dashboard.liveRoom;
		setText('#api-status', health.status === 'ok' ? 'Operational' : 'Unavailable');
		setText('#api-service', health.service);
		setText('#room-count', dashboard.rooms.length);
		setText('#student-count', dashboard.rooms.reduce((total, room) => total + room.studentsHere, 0));
		setText('#live-room', liveRoom ? liveRoom.title : 'None');
		setText('#live-subject', liveRoom ? `${liveRoom.year} · ${liveRoom.subject}` : 'No live class');
		setText('#last-updated', `Updated ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`);
		renderRooms(dashboard.rooms);
		renderInternships(internshipData.internships);
	} catch (error) {
		setText('#api-status', 'Offline');
		setText('#api-service', 'Start the Node server to connect');
		roomsTable.innerHTML = '<tr><td colspan="5" class="empty">Could not load room data.</td></tr>';
		internshipsTable.innerHTML = '<tr><td colspan="5" class="empty">Could not load internship data.</td></tr>';
	}
}

form.addEventListener('submit', async (event) => {
	event.preventDefault();
	message.className = 'form-message';
	message.textContent = 'Creating room…';
	const body = Object.fromEntries(new FormData(form));
	try {
		const response = await fetch('/api/rooms', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
		const result = await response.json();
		if (!response.ok) throw new Error(result.error || 'Could not create room');
		message.textContent = `${result.title} was created.`;
		form.reset();
		await loadDashboard();
	} catch (error) {
		message.className = 'form-message error';
		message.textContent = error.message;
	}
});

document.querySelector('#refresh-button').addEventListener('click', loadDashboard);
checkInForm.addEventListener('submit', async (event) => {
	event.preventDefault();
	checkInMessage.className = 'form-message';
	checkInMessage.textContent = 'Saving check-in…';
	try {
		const response = await fetch('/api/internships/check-ins', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.fromEntries(new FormData(checkInForm))) });
		const result = await response.json();
		if (!response.ok) throw new Error(result.error || 'Could not save check-in');
		checkInMessage.textContent = result.message;
		checkInForm.reset();
		await loadDashboard();
	} catch (error) {
		checkInMessage.className = 'form-message error';
		checkInMessage.textContent = error.message;
	}
});
loadDashboard();
