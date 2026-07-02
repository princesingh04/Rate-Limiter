const BASE_URL = 'http://127.0.0.1:4000';

async function test() {
  console.log('\n═══════════════════════════════════════════════');
  console.log('  LIVE PROXY TEST — Rate Limiter Demo');
  console.log('═══════════════════════════════════════════════\n');

  try {
    // 1. Signup
    console.log('1️⃣  Signing up user...');
    const email = `test${Date.now()}@example.com`;
    const signupRes = await fetch(`${BASE_URL}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'password123' })
    });
    const { token } = await signupRes.json();
    console.log(`   ✓ User created: ${email}`);
    console.log(`   ✓ Token: ${token.substring(0, 20)}...`);

    // 2. Create Project with token-bucket: capacity=3, refillRate=1 (1 token/sec)
    console.log('\n2️⃣  Creating project → httpbin.org (capacity=3, refill=1/sec)...');
    const projRes = await fetch(`${BASE_URL}/api/projects`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        name: 'Test Proxy Project',
        targetUrl: 'https://httpbin.org',
        rateLimitConfig: {
          algorithm: 'token-bucket',
          capacity: 3,
          refillRate: 1
        }
      })
    });
    const project = await projRes.json();
    const projectId = project._id;
    console.log(`   ✓ Project ID: ${projectId}`);
    console.log(`   ✓ Proxy URL: ${BASE_URL}/proxy/${projectId}/get`);

    // 3. Send 5 requests rapidly to trigger rate limit
    console.log('\n3️⃣  Sending 5 rapid requests (should allow 3, block 2)...\n');
    const promises = [];
    for (let i = 1; i <= 5; i++) {
      promises.push(
        fetch(`${BASE_URL}/proxy/${projectId}/get`, { method: 'GET' })
          .then(res => ({
            status: res.status,
            rateLimit: res.headers.get('X-RateLimit-Remaining'),
            algorithm: res.headers.get('X-RateLimit-Algorithm')
          }))
      );
    }
    const results = await Promise.all(promises);
    results.forEach((res, i) => {
      const statusEmoji = res.status === 200 ? '✅' : res.status === 429 ? '🚫' : '❓';
      console.log(
        `   Request ${i+1}: ${statusEmoji} HTTP ${res.status} | ` +
        `Remaining: ${res.rateLimit} | Algorithm: ${res.algorithm}`
      );
    });

    console.log('\n4️⃣  Checking analytics (last request summary)...');
    const analyticsRes = await fetch(`${BASE_URL}/api/analytics/summary`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const summary = await analyticsRes.json();
    const lastHour = summary[summary.length - 1];
    if (lastHour) {
      console.log(`   ✓ Last hour: ${lastHour.allowed} allowed, ${lastHour.blocked} blocked`);
    }

    console.log('\n✨ TEST COMPLETE ✨\n');
  } catch (err) {
    console.error('\n❌ Error:', err.message);
  }
}

test();
