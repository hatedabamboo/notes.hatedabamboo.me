async function updateViewCounter() {
    const pageUrl = encodeURIComponent(window.location.pathname);
    try {
        const response = await fetch(`https://api.hatedabamboo.me/views?pageUrl=${pageUrl}`);
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        const data = await response.json();
        document.getElementById("counter").innerText = data.views || "❔";
    } catch (error) {
        document.getElementById("counter").innerText = "❔";
        console.error("Error updating view counter:", error);
    }
}

document.addEventListener("DOMContentLoaded", updateViewCounter);
