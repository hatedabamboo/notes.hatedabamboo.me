async function updateViewCounter() {
    const pageUrl = encodeURIComponent(window.location.pathname);
    const fallbackValue = "?";
    try {
        const response = await fetch(`https://api.hatedabamboo.me/views?pageUrl=${pageUrl}`);
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        const data = await response.json();
        const counters = document.querySelectorAll("#counter");
        counters.forEach(counter => {
            counter.innerText = data.views || fallbackValue;
        });
    } catch (error) {
        const counters = document.querySelectorAll("#counter");
        counters.forEach(counter => {
            counter.innerText = fallbackValue;
        });
        console.error("Error updating view counter:", error);
    }
}

document.addEventListener("DOMContentLoaded", updateViewCounter);
