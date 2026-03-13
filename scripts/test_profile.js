const axios = require('axios');

async function testProfile() {
    try {
        console.log("Testing http://localhost:3000/profile...");
        const res = await axios.get('http://localhost:3000/profile', {
            maxRedirects: 0,
            validateStatus: () => true
        });
        console.log("Status:", res.status);
        console.log("Location:", res.headers.location);
        if (res.status === 200) {
            console.log("Page loaded successfully.");
        } else if (res.status === 302) {
            console.log("Redirected to:", res.headers.location);
        } else {
            console.log("Error status:", res.status);
            console.log(res.data.substring(0, 500));
        }
    } catch (err) {
        console.error("Request failed:", err.message);
    }
}

testProfile();
