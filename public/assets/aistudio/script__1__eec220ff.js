document.addEventListener("DOMContentLoaded", function () {
    const gallery = document.querySelector(".gallery");
    const images = Array.from(gallery.children);

    function shuffleImages() {
        // Shuffle array using Fisher-Yates algorithm
        for (let i = images.length - 1; i > 0; i--) {
            let j = Math.floor(Math.random() * (i + 1));
            [images[i], images[j]] = [images[j], images[i]];
        }

        // Remove and re-append shuffled images
        images.forEach(img => gallery.appendChild(img));
    }

    // Change images position every 15 seconds
    setInterval(shuffleImages,15000);
}// মডাল খোলার ফাংশন
function openModal(img) {
    const modal = document.getElementById("myModal");
    const modalImg = document.getElementById("modalImage");
    modal.style.display = "block";
    modalImg.src = img.src;
}

// মডাল বন্ধ করার ফাংশন
function closeModal() {
    const modal = document.getElementById("myModal");
    modal.style.display = "none";
}

// মডালের বাইরে ক্লিক করলে বন্ধ করুন
window.onclick = function(event) {
    const modal = document.getElementById("myModal");
    if (event.target === modal) {
        modal.style.display = "none";
    }
};);
