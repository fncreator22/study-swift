import puppeteer from "puppeteer";

const ARTIFACT_DIR = "C:/Users/sr2ma/.gemini/antigravity/brain/ad7441b9-aa9a-4b79-8cea-e55f710bb50e";

async function clearSession(page) {
  console.log("Clearing localStorage, sessionStorage, and browser cookies...");
  await page.evaluate(() => localStorage.clear());
  await page.evaluate(() => sessionStorage.clear());
  const cookies = await page.cookies();
  if (cookies.length > 0) {
    await page.deleteCookie(...cookies);
  }
}

async function typeInto(page, selector, text) {
  console.log(`Setting value of "${selector}" to "${text}"...`);
  await page.waitForSelector(selector);
  await page.evaluate((sel, txt) => {
    const input = document.querySelector(sel);
    if (input) {
      input.focus();
      const proto = input.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(proto, "value").set;
      nativeInputValueSetter.call(input, txt);
      const ev = new Event('input', { bubbles: true });
      input.dispatchEvent(ev);
    }
  }, selector, text);
  await new Promise(r => setTimeout(r, 200));
}

async function submitForm(page, inputSelector) {
  console.log(`Submitting form containing "${inputSelector}"...`);
  await page.evaluate((sel) => {
    const input = document.querySelector(sel);
    if (input) {
      const form = input.closest("form");
      if (form) {
        const event = new Event('submit', { cancelable: true, bubbles: true });
        form.dispatchEvent(event);
      }
    }
  }, inputSelector);
  await new Promise(r => setTimeout(r, 1000));
}

async function runTest() {
  console.log("Launching E2E testing browser...");
  const browser = await puppeteer.launch({
    headless: "new",
    defaultViewport: { width: 1280, height: 800 }
  });
  
  const page = await browser.newPage();
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));

  try {
    // ---- 1. GUEST FLOW ----
    console.log("Navigating to Guest Support Portal...");
    await page.goto("http://localhost:8080/support", { waitUntil: "networkidle2" });
    await new Promise(r => setTimeout(r, 2000));
    await page.screenshot({ path: `${ARTIFACT_DIR}/01_guest_portal.png` });

    console.log("Interacting with Guest Support Assistant chatbot...");
    // Choose category 'Tokens & Payments' in the decision tree
    await page.waitForSelector("button::-p-text(Tokens & Payments)");
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll("button")).find(b => b.textContent.includes("Tokens & Payments"));
      if (btn) btn.click();
    });
    await new Promise(r => setTimeout(r, 1200));

    // Choose 'Token request delay' option
    await page.waitForSelector("button::-p-text(Token request delay)");
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll("button")).find(b => b.textContent.includes("Token request delay"));
      if (btn) btn.click();
    });
    await new Promise(r => setTimeout(r, 1500));

    // Type query
    await typeInto(page, "input[placeholder='Describe your problem here...']", "my token request is pending since 2 hours");
    await submitForm(page, "input[placeholder='Describe your problem here...']");
    await new Promise(r => setTimeout(r, 2000));
    await page.screenshot({ path: `${ARTIFACT_DIR}/02_guest_assistant_match.png` });

    // Click 'No, escalate' if present
    try {
      await page.waitForSelector("button::-p-text(No, escalate)", { timeout: 3000 });
      await page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll("button")).find(b => b.textContent.includes("No, escalate"));
        if (btn) btn.click();
      });
      await new Promise(r => setTimeout(r, 1000));
    } catch {
      console.log("Chatbot went to direct fallback escalation, clicking human agent button...");
    }

    // Fill in Guest Details in the form on the left
    console.log("Filling Guest details in form...");
    await typeInto(page, "#guest-name", "Guest Tester");
    await typeInto(page, "#guest-email", "guest@example.com");
    await typeInto(page, "#guest-phone", "+919876543210");
    await typeInto(page, "#guest-country", "India");
    await typeInto(page, "#guest-subject", "Delay in token request approval");
    await typeInto(page, "#guest-desc", "My token request is pending since 2 hours. Transferred money but tokens not showing.");
    
    // Click escalate button in chat
    await page.waitForSelector("button::-p-text(Escalate to Human Agent Now)");
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll("button")).find(b => b.textContent.includes("Escalate to Human Agent Now"));
      if (btn) btn.click();
    });
    await new Promise(r => setTimeout(r, 3000));
    await page.screenshot({ path: `${ARTIFACT_DIR}/03_guest_ticket_escalated.png` });

    // ---- 2. STUDENT FLOW ----
    console.log("Logging out guest session...");
    await clearSession(page);

    console.log("Logging in as Student (student@examly.com)...");
    await page.goto("http://localhost:8080/login", { waitUntil: "networkidle2" });
    await typeInto(page, "input[type='email']", "student@examly.com");
    await typeInto(page, "input[type='password']", "password123");
    await submitForm(page, "input[type='email']");
    await new Promise(r => setTimeout(r, 3000));

    // Handle student profile completion redirects if present
    let currentUrl = page.url();
    console.log("URL after student login:", currentUrl);

    if (currentUrl.includes("/profile")) {
      console.log("Profile is incomplete. Automating demographics entry...");
      try {
        await typeInto(page, "input[placeholder='Country']", "India");
        await typeInto(page, "input[placeholder='State']", "Tamil Nadu");
        await page.waitForSelector("button::-p-text(Save profile)");
        await page.evaluate(() => {
          const btn = Array.from(document.querySelectorAll("button")).find(b => b.textContent.includes("Save profile"));
          if (btn) btn.click();
        });
        await new Promise(r => setTimeout(r, 3000));
      } catch (err) {
        console.log("Bypassing profile completion error:", err.message);
      }
      currentUrl = page.url();
      console.log("URL after profile completion:", currentUrl);
    }

    if (currentUrl.includes("/welcome-subscription")) {
      console.log("Subscription inactive. Automating Free Basic package activation...");
      try {
        await page.waitForSelector("button::-p-text(Activate Free Basic)");
        await page.evaluate(() => {
          const btn = Array.from(document.querySelectorAll("button")).find(b => b.textContent.includes("Activate Free Basic"));
          if (btn) btn.click();
        });
        await new Promise(r => setTimeout(r, 3000));
      } catch (err) {
        console.log("Bypassing subscription activation error:", err.message);
      }
    }

    console.log("Navigating to Student Dashboard Support...");
    await page.goto("http://localhost:8080/support-center", { waitUntil: "networkidle2" });
    await new Promise(r => setTimeout(r, 3000));
    await page.screenshot({ path: `${ARTIFACT_DIR}/04_student_support_center.png` });

    console.log("Conversing with assistant on dashboard...");
    // Click 'Courses & Streaming' in decision tree
    await page.waitForSelector("button::-p-text(Courses & Streaming)");
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll("button")).find(b => b.textContent.includes("Courses & Streaming"));
      if (btn) btn.click();
    });
    await new Promise(r => setTimeout(r, 1200));

    // Click 'Video playback buffering'
    await page.waitForSelector("button::-p-text(Video playback buffering)");
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll("button")).find(b => b.textContent.includes("Video playback buffering"));
      if (btn) btn.click();
    });
    await new Promise(r => setTimeout(r, 1500));

    // Type query with focus and delay in enabled input matching active placeholder
    await typeInto(page, "input[placeholder='Ask a question...']", "unable to stream course videos");
    await submitForm(page, "input[placeholder='Ask a question...']");
    await new Promise(r => setTimeout(r, 2000));
    await page.screenshot({ path: `${ARTIFACT_DIR}/05_student_assistant_match.png` });

    // Click 'No, escalate' if present
    try {
      await page.waitForSelector("button::-p-text(No, escalate)", { timeout: 3000 });
      await page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll("button")).find(b => b.textContent.includes("No, escalate"));
        if (btn) btn.click();
      });
      await new Promise(r => setTimeout(r, 1000));
    } catch {
      console.log("Chatbot went to direct fallback escalation on dashboard, clicking human agent button...");
    }

    // Click escalate to human admin
    await page.waitForSelector("button::-p-text(Escalate to Human Admin)");
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll("button")).find(b => b.textContent.includes("Escalate to Human Admin"));
      if (btn) btn.click();
    });
    await new Promise(r => setTimeout(r, 3000));
    await page.screenshot({ path: `${ARTIFACT_DIR}/06_student_ticket_created.png` });

    // ---- 3. ADMIN FLOW ----
    console.log("Logging out student session...");
    await clearSession(page);

    console.log("Logging in as Admin directly via Admin Login page...");
    await page.goto("http://localhost:8080/admin/login", { waitUntil: "networkidle2" });
    await typeInto(page, "input[type='email']", "admin@examly.com");
    await typeInto(page, "input[type='password']", "password123");
    await submitForm(page, "input[type='email']");
    await new Promise(r => setTimeout(r, 4000));

    console.log("Navigating to Admin Support Console...");
    await page.goto("http://localhost:8080/admin/support", { waitUntil: "networkidle2" });
    await new Promise(r => setTimeout(r, 3500));
    await page.screenshot({ path: `${ARTIFACT_DIR}/07_admin_support_inbox.png` });

    // Click on the student's escalated ticket in the list
    console.log("Opening escalated ticket in admin panel...");
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll("button"));
      const target = buttons.find(b => b.textContent.includes("Escalated assistant session"));
      if (target) target.click();
    });
    await new Promise(r => setTimeout(r, 2000));

    // Reply to student ticket
    console.log("Replying to ticket as admin...");
    await typeInto(page, "input[placeholder='Type response to user...']", "Hello Student! We are investigating the course video streaming issue. Try clearing browser cache.");
    await submitForm(page, "input[placeholder='Type response to user...']");
    await new Promise(r => setTimeout(r, 2000));
    await page.screenshot({ path: `${ARTIFACT_DIR}/08_admin_replied.png` });

    // Navigate to Analytics Tab
    console.log("Viewing Admin Analytics Tab...");
    await page.evaluate(() => {
      const tabs = Array.from(document.querySelectorAll("button"));
      const target = tabs.find(t => t.textContent.includes("Analytics Dashboard"));
      if (target) target.click();
    });
    await new Promise(r => setTimeout(r, 2000));
    await page.screenshot({ path: `${ARTIFACT_DIR}/09_admin_analytics.png` });

    // Navigate to Knowledge Base Tab
    console.log("Viewing Knowledge Base Tab...");
    await page.evaluate(() => {
      const tabs = Array.from(document.querySelectorAll("button"));
      const target = tabs.find(t => t.textContent.includes("Knowledge Base"));
      if (target) target.click();
    });
    await new Promise(r => setTimeout(r, 2000));
    await page.screenshot({ path: `${ARTIFACT_DIR}/10_admin_kb_manager.png` });

    // Navigate to Rules & Sandbox Tab
    console.log("Viewing AI Config & Sandbox Tab...");
    await page.evaluate(() => {
      const tabs = Array.from(document.querySelectorAll("button"));
      const target = tabs.find(t => t.textContent.includes("AI Config & Sandbox"));
      if (target) target.click();
    });
    await new Promise(r => setTimeout(r, 2000));

    // Run a query in testing sandbox
    await typeInto(page, "input[placeholder='e.g. Cannot stream course videos']", "forgot password link not working");
    const testBtn = await page.waitForSelector("button::-p-text(Test)");
    await testBtn.click();
    await new Promise(r => setTimeout(r, 2000));
    await page.screenshot({ path: `${ARTIFACT_DIR}/11_admin_sandbox_test.png` });

    // Navigate to Learning Engine Suggestions Tab
    console.log("Viewing Learning Suggestions Tab...");
    await page.evaluate(() => {
      const tabs = Array.from(document.querySelectorAll("button"));
      const target = tabs.find(t => t.textContent.includes("Learning Engine Suggestions"));
      if (target) target.click();
    });
    await new Promise(r => setTimeout(r, 2000));

    // Run Engine Audit
    const auditBtn = await page.waitForSelector("button::-p-text(Run Engine Audit)");
    await auditBtn.click();
    await new Promise(r => setTimeout(r, 3000));
    await page.screenshot({ path: `${ARTIFACT_DIR}/12_admin_learning_suggestions.png` });

    console.log("All e2e tests executed successfully. Screenshots captured.");
  } catch (err) {
    console.error("E2E Test Error:", err.message);
    await page.screenshot({ path: `${ARTIFACT_DIR}/00_e2e_error.png` });
  } finally {
    await browser.close();
  }
}

runTest();
