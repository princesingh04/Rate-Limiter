const BASE_URL = 'http://localhost:4000';

async function runTest() {
  console.log('--- STRICT RATE LIMIT BLOCKING TEST ---');

  try {
    // 1. Signup
    console.log('1. Signing up test user...');
    let token;
    const signupRes = await fetch(`${BASE_URL}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: `blocktest${Date.now()}@example.com`, password: 'password123' })
    });
    const data = await signupRes.json();
    token = data.token;

    // 2. Create Project with STRICT 2-request limit
    console.log('2. Creating Project with Capacity = 2...');
    let projectId;
    const projRes = await fetch(`${BASE_URL}/api/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({
        name: 'Strict Limit Project',
        targetUrl: 'https://httpbin.org',
        rateLimitConfig: { algorithm: 'token-bucket', capacity: 2, refillRate: 1 }
      })
    });
    const projData = await projRes.json();
    projectId = projData._id;

    // 3. Fire 5 requests immediately
    console.log(`3. Firing 5 concurrent requests to /proxy/${projectId}/get ...`);
    
    const requests = Array.from({ length: 5 }).map(async (_, i) => {
      const start = Date.now();
      const res = await fetch(`${BASE_URL}/proxy/${projectId}/get`);
      const isAllowed = res.ok;
      let text = '';
      if (!isAllowed) {
         try {
           const errData = await res.json();
           text = errData.message;
         } catch(e) { text = 'Rate limit exceeded'; }
      }
      return { id: i + 1, allowed: isAllowed, status: res.status, text };
    });

    const results = await Promise.all(requests);
    results.forEach(r => {
      if (r.allowed) {
        console.log(`  [ALLOWED] Request ${r.id} passed (HTTP ${r.status})`);
      } else {
        console.log(`  [BLOCKED] Request ${r.id} rejected (HTTP ${r.status}) - ${r.text}`);
      }
    });

    // 4. Test Analytics
    console.log('4. Waiting 1.5s for Analytics Buffer to flush...');
    await new Promise(r => setTimeout(r, 1500));
    
    console.log('5. Fetching Analytics for this Project...');
    const statsRes = await fetch(`${BASE_URL}/api/analytics/summary?projectId=${projectId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const stats = await statsRes.json();
    console.log('\n--- Analytics Result ---');
    console.log(JSON.stringify(stats, null, 2));

  } catch (err) {
    console.error('Error:', err.message);
  }
}

runTest();
