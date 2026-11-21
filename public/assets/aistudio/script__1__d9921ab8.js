const SCRIPT_URL = '/.netlify/functions/register'; // Update this to your Netlify function path
let userData = {};

function showForm() {
    document.getElementById('landing-page').classList.add('d-none');
    document.getElementById('form-container').classList.remove('d-none');
}

function nextStep(step) {
    document.querySelectorAll('.step').forEach(el => el.classList.add('d-none'));
    document.getElementById('step' + step).classList.remove('d-none');
}

// Convert image to Base64 for storage
async function toBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
}

document.getElementById('regForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.innerText = "Processing...";
    submitBtn.disabled = true;

    const formData = new FormData(e.target);
    userData = Object.fromEntries(formData.entries());
    
    // 1. Generate Application ID (Format: NH-2026-XXXX)
    userData.appID = "NH-2026-" + Math.floor(1000 + Math.random() * 9000);

    // 2. Handle Photo
    const photoFile = document.getElementById('photoInput').files[0];
    if (photoFile) {
        userData.photo_url = await toBase64(photoFile);
    }

    try {
        // 3. Send to Netlify Function (Neon DB)
        const response = await fetch(SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify(userData),
            headers: { 'Content-Type': 'application/json' }
        });

        if (response.ok) {
            document.getElementById('form-container').classList.add('d-none');
            document.getElementById('success-container').classList.remove('d-none');
            document.getElementById('displayID').innerText = userData.appID;
            
            // 4. Generate QR Code for Admit Card
            new QRCode(document.getElementById("qrcode"), {
                text: userData.appID,
                width: 128,
                height: 128
            });
        }
    } catch (error) {
        alert("Submission failed. Please try again.");
        submitBtn.innerText = "Submit Application";
        submitBtn.disabled = false;
    }
});

function generatePDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // Admit Card Design
    doc.setDrawColor(0);
    doc.rect(10, 10, 190, 120); // Border
    
    doc.setFontSize(18);
    doc.text("EVENT ADMIT CARD - 2026", 105, 25, null, null, "center");
    
    doc.setFontSize(12);
    doc.text(`ID: ${userData.appID}`, 20, 45);
    doc.text(`Name: ${userData.name}`, 20, 55);
    doc.text(`Father: ${userData.father}`, 20, 65);
    doc.text(`DOB: ${userData.dob}`, 20, 75);
    doc.text(`Mobile: ${userData.mobile}`, 20, 85);
    doc.text(`Address: ${userData.address}`, 20, 95);

    // Add Photo if exists
    if (userData.photo_url) {
        doc.addImage(userData.photo_url, 'JPEG', 150, 40, 35, 45);
    }

    // Add QR Code
    const qrCanvas = document.querySelector('#qrcode canvas');
    if (qrCanvas) {
        const qrDataURL = qrCanvas.toDataURL("image/png");
        doc.addImage(qrDataURL, 'PNG', 150, 90, 30, 30);
    }

    doc.save(`AdmitCard_${userData.appID}.pdf`);
}