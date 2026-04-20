const MODEL_URL = 'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights';
let labeledDescriptors = [];
let attendedToday = new Set();
let isLoginMode = true;

// Auth Logic
function toggleAuthMode() {
    isLoginMode = !isLoginMode;
    document.getElementById('auth-title').innerText = isLoginMode ? "Admin Login" : "Admin Register";
    document.getElementById('auth-btn').innerText = isLoginMode ? "Login" : "Register";
    document.getElementById('toggle-text').innerText = isLoginMode ? "Need account? Register" : "Have account? Login";
}

function handleAuth() {
    const user = document.getElementById('username').value;
    const pass = document.getElementById('password').value;
    if (isLoginMode) {
        const stored = JSON.parse(localStorage.getItem('admin_user'));
        if (stored && stored.u === user && stored.p === pass) {
            document.getElementById('auth-page').style.display = 'none';
            document.getElementById('main-dashboard').style.display = 'flex';
            initApp();
        } else { alert("Wrong details!"); }
    } else {
        localStorage.setItem('admin_user', JSON.stringify({ u: user, p: pass }));
        alert("Registered! Now Login.");
        toggleAuthMode();
    }
}

// Camera & AI Init
async function initApp() {
    const video = document.getElementById('video');
    const stream = await navigator.mediaDevices.getUserMedia({ video: {} });
    video.srcObject = stream;
    document.getElementById('status').innerText = "⏳ Loading AI Models...";
    await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
    ]);
    document.getElementById('status').innerText = "✅ System Active";
    startRecognition();
}

async function registerFace() {
    const name = prompt("Student Name:");
    if (!name) return;
    const video = document.getElementById('video');
    const detection = await faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks().withFaceDescriptor();
    if (detection) {
        labeledDescriptors.push(new faceapi.LabeledFaceDescriptors(name, [detection.descriptor]));
        alert(name + " Registered!");
    }
}

function startRecognition() {
    const video = document.getElementById('video');
    const canvas = faceapi.createCanvasFromMedia(video);
    document.querySelector('.cam-section').append(canvas);
    const displaySize = { width: video.offsetWidth, height: video.offsetHeight };
    faceapi.matchDimensions(canvas, displaySize);

    setInterval(async () => {
        if (labeledDescriptors.length === 0) return;
        const detections = await faceapi.detectAllFaces(video, new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks().withFaceDescriptors();
        const resized = faceapi.resizeResults(detections, displaySize);
        canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
        const faceMatcher = new faceapi.FaceMatcher(labeledDescriptors, 0.6);
        resized.forEach(det => {
            const result = faceMatcher.findBestMatch(det.descriptor);
            new faceapi.draw.DrawBox(det.detection.box, { label: result.toString() }).draw(canvas);
            if (result.label !== 'unknown' && !attendedToday.has(result.label)) {
                markAttendance(result.label);
            }
        });
    }, 200);
}

// MARK ATTENDANCE WITH IMAGE
function markAttendance(name) {
    attendedToday.add(name);
    const video = document.getElementById('video');
    
    // Capture Snapshot
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = video.videoWidth;
    tempCanvas.height = video.videoHeight;
    tempCanvas.getContext('2d').drawImage(video, 0, 0);
    const snap = tempCanvas.toDataURL('image/jpeg', 0.5);

    let history = JSON.parse(localStorage.getItem('attendance_db')) || [];
    const record = { id: Date.now(), name, image: snap, date: new Date().toLocaleDateString(), time: new Date().toLocaleTimeString() };
    history.push(record);
    localStorage.setItem('attendance_db', JSON.stringify(history));

    const li = document.createElement('li');
    li.innerText = `✅ ${name} marked`;
    document.getElementById('log').prepend(li);
}

// REPORT VIEW WITH PHOTO
function viewFullAttendance() {
    const history = JSON.parse(localStorage.getItem('attendance_db')) || [];
    const win = window.open("", "_blank");
    win.document.write(`
        <html>
        <head>
            <title>Attendance Report</title>
            <style>
                body { font-family: sans-serif; padding: 20px; background: #f1f5f9; }
                .header { display: flex; justify-content: space-between; margin-bottom: 20px; }
                table { width: 100%; border-collapse: collapse; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
                th, td { padding: 12px; border: 1px solid #eee; text-align: left; }
                th { background: #3b82f6; color: white; }
                .face-img { width: 60px; height: 60px; border-radius: 8px; object-fit: cover; border: 1px solid #ddd; }
                .btn-del { background: #ef4444; color: white; border: none; padding: 6px; cursor: pointer; border-radius: 4px; }
                .btn-back { background: #334155; color: white; padding: 10px; text-decoration: none; border-radius: 5px; }
            </style>
        </head>
        <body>
            <div class="header">
                <h2>Attendance Report</h2>
                <a href="#" class="btn-back" onclick="window.close()">← Back to Dashboard</a>
            </div>
            <table>
                <tr><th>Photo</th><th>Name</th><th>Date</th><th>Time</th><th>Action</th></tr>
                ${history.reverse().map(r => `
                    <tr>
                        <td><img src="${r.image}" class="face-img"></td>
                        <td>${r.name}</td><td>${r.date}</td><td>${r.time}</td>
                        <td><button class="btn-del" onclick="window.opener.deleteRecord(${r.id}); location.reload();">Delete</button></td>
                    </tr>
                `).join('')}
            </table>
        </body>
        </html>
    `);
}

window.deleteRecord = function(id) {
    let history = JSON.parse(localStorage.getItem('attendance_db')) || [];
    localStorage.setItem('attendance_db', JSON.stringify(history.filter(i => i.id !== id)));
};

function logout() { location.reload(); }