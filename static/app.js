let mediaRecorder;
let audioChunks = [];
let currentPromptText = null;
let isRecording = false;
let recordingCount = 0;
let hasRecording = false;
let userConsented = false;
const consentModal = document.getElementById('consentModal');
const agreeButton = document.getElementById('agreeButton');
const declineButton = document.getElementById('declineButton');
const recordButton = document.getElementById('recordButton');
const saveButton = document.getElementById('saveButton');
const nextButton = document.getElementById('nextButton');
const submitButton = document.getElementById('submitButton');
const promptText = document.getElementById('promptText');
const recordingStatus = document.getElementById('recordingStatus');
const messageDiv = document.getElementById('message');
const recordingCountSpan = document.getElementById('recordingCount');
document.addEventListener('DOMContentLoaded', () => {
    setupConsentModal();
    setupEventListeners();
});
function setupConsentModal() {
    agreeButton.addEventListener('click', () => {
        userConsented = true;
        consentModal.style.display = 'none';
        loadPrompt();
    });
    declineButton.addEventListener('click', () => {
        const modalContent = document.querySelector('.modal-content');
        modalContent.innerHTML = `
            <h2>Consent Required</h2>
            <p style="margin: 30px 0; font-size: 16px; color: #333;">
                You must consent to participate in order to use this application.
                Your participation helps improve AI systems.
            </p>
            <p style="font-size: 14px; color: #666; margin-bottom: 30px;">
                If you change your mind, you can go back to review the consent terms.
            </p>
            <div style="display: flex; gap: 12px; justify-content: center;">
                <button class="btn-agree" onclick="window.location.reload()">
                    Go Back
                </button>
            </div>
        `;
    });
}
function setupEventListeners() {
    recordButton.addEventListener('click', toggleRecording);
    saveButton.addEventListener('click', tryAgain);
    nextButton.addEventListener('click', nextPrompt);
    submitButton.addEventListener('click', submitSession);
}
async function loadPrompt() {
    try {
        showStatus('Loading prompt...', 'processing');
        const response = await fetch('/api/prompt');
        if (!response.ok) {
            throw new Error('Failed to load prompt');
        }
        const prompt = await response.json();
        currentPromptText = prompt.text;
        promptText.textContent = currentPromptText;
        showStatus('');
        hasRecording = false;
        window.currentAudioBlob = null;
        updateButtonStates();
    } catch (error) {
        console.error('Error loading prompt:', error);
        showMessage('Failed to load prompt. Please refresh the page.', 'error');
    }
}
async function toggleRecording() {
    if (!isRecording) {
        await startRecording();
    } else {
        await stopRecording();
    }
}
async function startRecording() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];
        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                audioChunks.push(event.data);
            }
        };
        mediaRecorder.onstop = () => {
            const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
            hasRecording = true;
            updateButtonStates();
            window.currentAudioBlob = audioBlob;
        };
        mediaRecorder.start();
        isRecording = true;
        recordButton.classList.add('recording');
        showStatus('Recording...', 'recording');
        updateButtonStates();
    } catch (error) {
        console.error('Error starting recording:', error);
        showMessage('Failed to access microphone. Please grant permission.', 'error');
    }
}
async function stopRecording() {
    if (mediaRecorder && isRecording) {
        mediaRecorder.stop();
        mediaRecorder.stream.getTracks().forEach(track => track.stop());
        isRecording = false;
        recordButton.classList.remove('recording');
        showStatus('Recording complete. Save or try again.', 'ready');
        updateButtonStates();
    }
}
async function tryAgain() {
    if (isRecording) {
        await stopRecording();
    }
    window.currentAudioBlob = null;
    hasRecording = false;
    updateButtonStates();
    showStatus('');
    showMessage('Ready to record again', 'success');
    setTimeout(() => {
        messageDiv.innerHTML = '';
    }, 2000);
}
async function nextPrompt() {
    if (isRecording) {
        await stopRecording();
    }
    if (hasRecording && window.currentAudioBlob) {
        await saveRecording();
    }
    await loadPrompt();
}
async function saveRecording() {
    if (!window.currentAudioBlob) {
        console.error('No audio blob to save');
        return false;
    }
    if (!currentPromptText) {
        console.error('No prompt text available');
        return false;
    }
    try {
        showStatus('Saving recording...', 'processing');
        const reader = new FileReader();
        reader.readAsDataURL(window.currentAudioBlob);
        return new Promise((resolve, reject) => {
            reader.onloadend = async () => {
                try {
                    const base64Audio = reader.result;
                    console.log('Saving recording for prompt:', currentPromptText);
                    const response = await fetch('/api/save-recording', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            prompt_text: currentPromptText,
                            audio_data: base64Audio
                        })
                    });
                    if (!response.ok) {
                        const errorData = await response.json().catch(() => ({}));
                        console.error('Server error:', errorData);
                        throw new Error(errorData.error || 'Failed to save recording');
                    }
                    await response.json();
                    recordingCount++;
                    recordingCountSpan.textContent = recordingCount;
                    const labelSpan = document.getElementById('recordingLabel');
                    if (labelSpan) {
                        labelSpan.textContent = recordingCount === 1 ? 'recording done' : 'recordings done';
                    }
                    showMessage('Recording saved successfully!', 'success');
                    showStatus('');
                    window.currentAudioBlob = null;
                    hasRecording = false;
                    setTimeout(() => {
                        messageDiv.innerHTML = '';
                    }, 2000);
                    resolve(true);
                } catch (error) {
                    console.error('Error saving recording:', error);
                    showMessage('Failed to save recording. ' + error.message, 'error');
                    showStatus('');
                    reject(error);
                }
            };
            reader.onerror = (error) => {
                console.error('FileReader error:', error);
                reject(new Error('Failed to read audio file'));
            };
        });
    } catch (error) {
        console.error('Error in saveRecording:', error);
        showMessage('Failed to save recording. ' + error.message, 'error');
        showStatus('');
        return false;
    }
}
async function submitSession() {
    if (isRecording) {
        await stopRecording();
    }
    if (hasRecording && window.currentAudioBlob) {
        await saveRecording();
    }
    sessionStorage.setItem('recordingCount', recordingCount);
    window.location.href = '/complete';
}
function updateButtonStates() {
    saveButton.disabled = !hasRecording || isRecording;
    nextButton.disabled = !hasRecording || isRecording;
    submitButton.disabled = false;
}
function showStatus(message, type = '') {
    if (!message) {
        recordingStatus.innerHTML = '';
        return;
    }
    let icon = '';
    if (type === 'recording') {
        icon = '<span class="recording-indicator"></span>';
    }
    recordingStatus.innerHTML = `<span class="status-indicator">${icon}${message}</span>`;
}
function showMessage(message, type) {
    messageDiv.innerHTML = `<div class="message ${type}">${message}</div>`;
}
