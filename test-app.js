// Automated verification test script for Library System
async function runTests() {
  const BASE_URL = 'http://localhost:3000';
  let passed = 0;
  let failed = 0;

  function assert(condition, testName) {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName}`);
      failed++;
    }
  }

  try {
    // 1. Catalog Page (FR-002)
    const catRes = await fetch(`${BASE_URL}/catalog`);
    const catHtml = await catRes.text();
    assert(catRes.status === 200, 'FR-002: Catalog page returns HTTP 200');
    assert(catHtml.includes('Introduction to Algorithms'), 'FR-002: Catalog contains seeded books');
    assert(catHtml.includes('ONLINE CATALOG'), 'FR-002: Catalog header rendered');

    // 2. Staff Authentication (FR-001)
    const staffParams = new URLSearchParams();
    staffParams.append('email', 'staff@amu.ac.in');
    staffParams.append('password', 'staff123');

    const staffLoginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: staffParams.toString(),
      redirect: 'manual'
    });

    assert(staffLoginRes.status === 302, 'FR-001: Staff login redirects (HTTP 302)');
    const staffCookie = staffLoginRes.headers.get('set-cookie');
    assert(staffCookie && staffCookie.includes('connect.sid'), 'FR-001: Staff receives session cookie');

    // 3. Staff Dashboard (FR-009)
    const dashRes = await fetch(`${BASE_URL}/staff/dashboard`, {
      headers: { 'Cookie': staffCookie }
    });
    const dashHtml = await dashRes.text();
    assert(dashRes.status === 200, 'FR-009: Staff Dashboard returns HTTP 200');
    assert(dashHtml.includes('Library Operations Command Center'), 'FR-009: Staff Dashboard header rendered');
    assert(dashHtml.includes('CATALOG TITLES'), 'FR-009: Dashboard KPIs rendered');

    // 4. Overdue Reports CSV Export (FR-010)
    const csvRes = await fetch(`${BASE_URL}/reports/overdue?format=csv`, {
      headers: { 'Cookie': staffCookie }
    });
    const csvContent = await csvRes.text();
    assert(csvRes.status === 200, 'FR-010: Overdue CSV report returns HTTP 200');
    assert(csvContent.includes('"Circulation ID","Copy ID","Patron Name"'), 'FR-010: CSV contains proper headers including Copy ID');
    assert(csvContent.includes('Prince Kaushal'), 'FR-010: CSV contains overdue patron data');

    // 5. Patron Authentication (FR-001)
    const patronParams = new URLSearchParams();
    patronParams.append('email', 'student@amu.ac.in');
    patronParams.append('password', 'student123');

    const patronLoginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: patronParams.toString(),
      redirect: 'manual'
    });

    assert(patronLoginRes.status === 302, 'FR-001: Patron login redirects (HTTP 302)');
    const patronCookie = patronLoginRes.headers.get('set-cookie');

    // 6. Patron Dashboard (FR-009)
    const patronDashRes = await fetch(`${BASE_URL}/patron/dashboard`, {
      headers: { 'Cookie': patronCookie }
    });
    const patronDashHtml = await patronDashRes.text();
    assert(patronDashRes.status === 200, 'FR-009: Patron dashboard returns HTTP 200');
    assert(patronDashHtml.includes('Welcome, Prince Kaushal!'), 'FR-009: Patron name displayed on dashboard');

    // 7. Patron My Requests & Tracking (FR-006)
    const reqRes = await fetch(`${BASE_URL}/patron/my-requests`, {
      headers: { 'Cookie': patronCookie }
    });
    const reqHtml = await reqRes.text();
    assert(reqRes.status === 200, 'FR-006: Patron requests tracking returns HTTP 200');
    assert(reqHtml.includes('REQ-2026-001'), 'FR-006: Tracks pending reservation request');

    // 8. Patron My Fines (FR-007)
    const finesRes = await fetch(`${BASE_URL}/patron/my-fines`, {
      headers: { 'Cookie': patronCookie }
    });
    const finesHtml = await finesRes.text();
    assert(finesRes.status === 200, 'FR-007: Patron fines tracking returns HTTP 200');
    assert(finesHtml.includes('TOTAL PENDING FINES'), 'FR-007: Fines summary displayed');

    // 9. Patron Notifications (FR-008)
    const notifRes = await fetch(`${BASE_URL}/patron/notifications`, {
      headers: { 'Cookie': patronCookie }
    });
    const notifHtml = await notifRes.text();
    assert(notifRes.status === 200, 'FR-008: Patron notifications page returns HTTP 200');
    assert(notifHtml.includes('Book Overdue Alert!'), 'FR-008: Overdue alert notification rendered');

    console.log('--------------------------------------------------');
    console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('--------------------------------------------------');
  } catch (err) {
    console.error('Test execution error:', err);
  }
}

runTests();
