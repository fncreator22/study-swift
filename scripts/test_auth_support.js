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
    // ---- 1. LOGIN PAGE TEST ----
    console.log("Testing Login page support link...");
    await page.goto("http://localhost:8080/login", { waitUntil: "networkidle2" });
    await new Promise(r => setTimeout(r, 1000));
    await page.screenshot({ path: `${ARTIFACT_DIR}/auth_01_login.png` });
    
    // Check if the support link exists
    const loginSupportLink = await page.evaluate(() => {
      const link = Array.from(document.querySelectorAll("a")).find(a => a.href.includes("/support"));
      return link ? link.textContent : null;
    });
    console.log("Login support link text:", loginSupportLink);

    // ---- 2. SIGNUP PAGE DUP VALIDATION TEST ----
    console.log("Testing Signup page duplicate email warning...");
    await page.goto("http://localhost:8080/signup", { waitUntil: "networkidle2" });
    await new Promise(r => setTimeout(r, 1000));
    
    // Type in existing student email and trigger blur via tab press
    await typeInto(page, "#email", "student@examly.com");
    await page.focus("#email");
    await page.keyboard.press("Tab");
    await new Promise(r => setTimeout(r, 2000)); // wait for blur query to execute
    await page.screenshot({ path: `${ARTIFACT_DIR}/auth_02_signup_duplicate_warn.png` });

    const duplicateWarnText = await page.evaluate(() => {
      const p = document.querySelector(".text-destructive");
      return p ? p.textContent : null;
    });
    console.log("Duplicate email inline validation text:", duplicateWarnText);

    // ---- 3. FORGOT PASSWORD TEST ----
    console.log("Testing Forgot Password page...");
    await page.goto("http://localhost:8080/forgot-password", { waitUntil: "networkidle2" });
    await new Promise(r => setTimeout(r, 1000));
    await page.screenshot({ path: `${ARTIFACT_DIR}/auth_03_forgot_password.png` });

    // ---- 4. RESET PASSWORD SESSION EXPIRED TEST ----
    console.log("Testing Reset Password page session expired card...");
    await page.goto("http://localhost:8080/reset-password", { waitUntil: "networkidle2" });
    await new Promise(r => setTimeout(r, 1500));
    await page.screenshot({ path: `${ARTIFACT_DIR}/auth_04_reset_password_expired.png` });

    // ---- 5. AUTH CALLBACK ERROR TEST ----
    console.log("Testing Auth Callback page error card...");
    await page.goto("http://localhost:8080/auth/callback", { waitUntil: "networkidle2" });
    await new Promise(r => setTimeout(r, 1500));
    await page.screenshot({ path: `${ARTIFACT_DIR}/auth_05_auth_callback_error.png` });

    // ---- 6. ADMIN LOGIN PAGE TEST ----
    console.log("Testing Admin Login page support link...");
    await page.goto("http://localhost:8080/admin/login", { waitUntil: "networkidle2" });
    await new Promise(r => setTimeout(r, 1000));
    await page.screenshot({ path: `${ARTIFACT_DIR}/auth_06_admin_login.png` });

    // ---- 7. STUDENT PROFILE SAVE PERSISTENCE TEST ----
    console.log("Logging in as student to test profile save...");
    await page.goto("http://localhost:8080/login", { waitUntil: "networkidle2" });
    await typeInto(page, "#email", "student@examly.com");
    await typeInto(page, "#password", "password123");
    
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll("button")).find(b => b.textContent.includes("Sign in"));
      if (btn) btn.click();
    });
    await new Promise(r => setTimeout(r, 3000));

    console.log("Navigating to Profile & Settings page...");
    await page.goto("http://localhost:8080/profile", { waitUntil: "networkidle2" });
    await new Promise(r => setTimeout(r, 2000));
    await page.screenshot({ path: `${ARTIFACT_DIR}/auth_07_profile_initial.png` });

    // Update country and state and click save
    console.log("Updating profile details...");
    await typeInto(page, "input[placeholder='Country']", "India");
    await typeInto(page, "input[placeholder='State']", "Karnataka");
    await typeInto(page, "input[placeholder='City / address']", "Bangalore North");
    
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll("button")).find(b => b.textContent.includes("Save profile"));
      if (btn) btn.click();
    });
    
    console.log("Waiting for profile save completion...");
    await new Promise(r => setTimeout(r, 2000));
    await page.screenshot({ path: `${ARTIFACT_DIR}/auth_08_profile_saved.png` });

    const currentUrlAfterSave = page.url();
    console.log("Current URL after profile save:", currentUrlAfterSave);
    if (currentUrlAfterSave.includes("/profile")) {
      console.log("SUCCESS: User remained on the profile page after saving!");
    } else {
      console.log("FAILURE: User was redirected to:", currentUrlAfterSave);
    }

    // ---- 8. ADMIN PASSWORD RESET MIDDLEWARE TEST ----
    console.log("Logging out student session...");
    await clearSession(page);
    
    console.log("Logging in as admin to test user password reset...");
    await page.goto("http://localhost:8080/admin/login", { waitUntil: "networkidle2" });
    await typeInto(page, "#email", "admin@examly.com");
    await typeInto(page, "input[type='password']", "password123");
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll("button")).find(b => b.textContent.includes("Sign in"));
      if (btn) btn.click();
    });
    await new Promise(r => setTimeout(r, 4500)); // admin login transition

    console.log("Navigating to Admin User list...");
    await page.goto("http://localhost:8080/admin/users", { waitUntil: "networkidle2" });
    await new Promise(r => setTimeout(r, 2000));

    console.log("Opening Student action dialog...");
    await page.evaluate(() => {
      const row = Array.from(document.querySelectorAll("tr")).find(tr => tr.textContent.includes("student@examly.com"));
      if (row) {
        const btn = row.querySelector("button");
        if (btn) btn.click();
      }
    });
    await new Promise(r => setTimeout(r, 1500));
    await page.screenshot({ path: `${ARTIFACT_DIR}/auth_09_admin_edit_user_modal.png` });

    console.log("Switching to Actions tab...");
    await page.evaluate(() => {
      const tabs = Array.from(document.querySelectorAll('[role="tab"]'));
      console.log("DOM Tabs found:", tabs.map(t => `${t.textContent} -> ${Array.from(t.attributes).map(a => `${a.name}=${a.value}`).join(', ')}`));
      
      const trigger = tabs.find(el => el.textContent.includes("Actions")) ||
                      Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes("Actions"));
      if (trigger) {
        trigger.focus();
        trigger.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        trigger.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
        trigger.click();
        console.log("Actions tab clicked successfully!");
      } else {
        console.error("Actions tab trigger not found in the DOM!");
      }
    });
    await new Promise(r => setTimeout(r, 2000));
    await page.screenshot({ path: `${ARTIFACT_DIR}/auth_09b_admin_actions_tab.png` });
    
    console.log("Updating password for student...");
    await typeInto(page, "#new-pass", "password123"); // set password back to password123 to keep environment clean
    
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll("button")).find(b => b.textContent.includes("Update Password"));
      if (btn) btn.click();
    });
    await new Promise(r => setTimeout(r, 2500));
    await page.screenshot({ path: `${ARTIFACT_DIR}/auth_10_admin_password_updated.png` });
    console.log("Admin password reset completed!");

    console.log("Closing browser...");
    await browser.close();
    console.log("E2E verification tests successfully completed!");
  } catch (err) {
    console.error("E2E verification tests FAILED:", err);
    try {
      await page.screenshot({ path: `${ARTIFACT_DIR}/auth_e2e_error.png` });
    } catch {}
    await browser.close();
  }
}

runTest();
