async function testTwoStep() {
    const baseUrl = "https://script.google.com/macros/s/AKfycbylJdE0zrBJkgbjkvXKKCbhQYs2wnrHCTMutJueWPRISeiUcAuQNYBf-Mg5X9-1GEKZ0w/exec";
    const probe = await fetch(`${baseUrl}?action=ping`, { method: "GET", redirect: "follow" });
    const realBaseUrl = probe.url.split('?')[0];
    console.log("RealBaseURL:", realBaseUrl);
    
    const url = `${realBaseUrl}?action=ping`;
    try {
        const res = await fetch(url, {
            method: 'POST',
            redirect: 'follow',
            body: JSON.stringify({data: {}}),
            headers: {'Content-Type': 'text/plain'}
        });
        const text = await res.text();
        console.log('Status:', res.status);
        console.log('Response:', text.substring(0, 500));
    } catch(e) {
        console.log('Error:', e.message);
    }
}
testTwoStep();
