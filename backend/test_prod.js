const BASE_URL = 'https://rate-limiter-li71.onrender.com';

async function runTest() {
  console.log('--- SaaS Backend E2E Test (Production) ---');

  try {
    // 1. Signup
    console.log('1. Signing up...');
    let token;
    try {
      const signupRes = await fetch(`${BASE_URL}/api/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: `test${Date.now()}@example.com`,
          password: 'password123'
        })
      });
      const data = await signupRes.json();
      if (!signupRes.ok) throw new Error(JSON.stringify(data));
      token = data.token;
      console.log('  Signup success. Token received.');
    } catch (e) {
      console.error('  Signup failed:', e.message);
      return;
    }

    // 2. Create Project
    console.log('2. Creating Project for target "https://httpbin.org"...');
    let projectId;
    try {
      const projRes = await fetch(`${BASE_URL}/api/projects`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({
          name: 'Test Project',
          targetUrl: 'https://httpbin.org',
          rateLimitConfig: {
            algorithm: 'token-bucket',
            capacity: 3,
            refillRate: 1
          }
        })
      });
      const data = await projRes.json();
      if (!projRes.ok) throw new Error(JSON.stringify(data));
      projectId = data._id;
      console.log(`  Project created successfully. ID: ${projectId}`);
    } catch (e) {
      console.error('  Project creation failed:', e.message);
      return;
    }

    // 3. Test Proxy
    console.log(`3. Sending 4 requests to /proxy/${projectId}/get to trigger rate limiter...`);
    for (let i = 1; i <= 4; i++) {
        try {
            const proxyRes = await fetch(`${BASE_URL}/proxy/${projectId}/get`);
            if (proxyRes.ok) {
              console.log(`  Request ${i}: HTTP ${proxyRes.status} (Allowed) - RateLimit-Remaining: ${proxyRes.headers.get('x-ratelimit-remaining')}`);
            } else {
              const data = await proxyRes.json();
              console.log(`  Request ${i}: HTTP ${proxyRes.status} (Blocked) - ${data.message}`);
            }
        } catch (e) {
            console.error(`  Request ${i} failed:`, e.message);
        }
    }

    // 4. Test Analytics
    console.log('4. Waiting 1.5 seconds for analytics buffer to flush...');
    await new Promise(r => setTimeout(r, 1500));
    console.log('5. Fetching Analytics Summary...');
    try {
      const statsRes = await fetch(`${BASE_URL}/api/analytics/summary`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await statsRes.json();
      console.log('  Analytics Data:', JSON.stringify(data, null, 2));
    } catch (e) {
      console.error('  Analytics fetch failed:', e.message);
    }

    console.log('--- Test Complete ---');
  } catch (err) {
    console.error('Unexpected error:', err.message);
  }
}

runTest();
