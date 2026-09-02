const roomId = new URLSearchParams(window.location.search).get('room') || 'room-01';
const localVideo = document.querySelector('#local-video');
const remoteVideo = document.querySelector('#remote-video');
const localPlaceholder = document.querySelector('#local-placeholder');
const remotePlaceholder = document.querySelector('#remote-placeholder');
const statusText = document.querySelector('#connection-status');
const dot = document.querySelector('#connection-dot');
let localStream;
let peer;
let lastSignal = 0;
let polling = true;
let iceServers = [{ urls:'stun:stun.l.google.com:19302' }];

function setStatus(text, ready = false) { statusText.textContent = text; dot.classList.toggle('ready', ready); }
function showMessage(text) { document.querySelector('#call-message').textContent = text; }
async function sendSignal(type, payload) { await fetch(`/api/calls/${roomId}/signals`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ type, payload }) }); }
async function makePeer(initiator) {
  peer = new RTCPeerConnection({ iceServers });
  localStream.getTracks().forEach((track) => peer.addTrack(track, localStream));
  peer.ontrack = (event) => { remoteVideo.srcObject = event.streams[0]; remotePlaceholder.hidden = true; };
  peer.onicecandidate = (event) => { if (event.candidate) sendSignal('candidate', event.candidate); };
  peer.onconnectionstatechange = () => { if (peer.connectionState === 'connected') setStatus('Connected', true); if (['failed','disconnected'].includes(peer.connectionState)) setStatus('Connection interrupted'); };
  if (initiator) { const offer = await peer.createOffer(); await peer.setLocalDescription(offer); await sendSignal('offer', offer); setStatus('Waiting for second tab…'); }
}
async function processSignals() {
  if (!polling) return;
  try {
    const response = await fetch(`/api/calls/${roomId}/signals?since=${lastSignal}`);
    const { signals } = await response.json();
    for (const signal of signals) {
      lastSignal = Math.max(lastSignal, signal.createdAt);
      if (signal.type === 'offer' && !peer) { await makePeer(false); await peer.setRemoteDescription(signal.payload); const answer = await peer.createAnswer(); await peer.setLocalDescription(answer); await sendSignal('answer', answer); setStatus('Connecting…'); }
      else if (signal.type === 'answer' && peer && !peer.currentRemoteDescription) await peer.setRemoteDescription(signal.payload);
      else if (signal.type === 'candidate' && peer && peer.remoteDescription) { try { await peer.addIceCandidate(signal.payload); } catch {} }
    }
  } catch { setStatus('Server unavailable'); }
  setTimeout(processSignals, 800);
}
async function start() {
  try { const config = await fetch('/api/calls/config').then((response) => response.json()); iceServers = config.iceServers || iceServers; localStream = await navigator.mediaDevices.getUserMedia({video:true, audio:true}); localVideo.srcObject = localStream; localPlaceholder.hidden = true; setStatus('Camera ready', true); await makePeer(true); processSignals(); }
  catch { setStatus('Camera permission needed'); showMessage('Allow camera and microphone access in your browser to test the call.'); }
}
document.querySelector('#email-invite').addEventListener('click', () => { const link = window.location.href; window.location.href = `mailto:leroyfredlosh@gmail.com?subject=Leroy%20call%20test&body=Open%20this%20Leroy%20call%20room%20link%3A%20${encodeURIComponent(link)}`; });
document.querySelector('#copy-link').addEventListener('click', async () => { try { await navigator.clipboard.writeText(window.location.href); showMessage('Invite link copied to your clipboard.'); } catch { showMessage('Copy is unavailable; use the address bar to share this link.'); } });
document.querySelector('#mute-button').addEventListener('click', (event) => { const track = localStream?.getAudioTracks()[0]; if (!track) return; track.enabled = !track.enabled; event.currentTarget.textContent = track.enabled ? '🎙 Mute' : '🔇 Unmute'; });
document.querySelector('#camera-button').addEventListener('click', (event) => { const track = localStream?.getVideoTracks()[0]; if (!track) return; track.enabled = !track.enabled; event.currentTarget.textContent = track.enabled ? '▣ Camera' : '□ Camera'; });
document.querySelector('#end-button').addEventListener('click', () => { polling = false; localStream?.getTracks().forEach((track) => track.stop()); peer?.close(); setStatus('Call ended'); showMessage('You left the call. Refresh to start again.'); });
start();
