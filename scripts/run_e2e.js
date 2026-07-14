import puppeteer from "puppeteer";

async function runAutomation() {
  console.log("Launching Puppeteer browser...");
  const browser = await puppeteer.launch({
    headless: "new",
    defaultViewport: { width: 1280, height: 800 }
  });
  const page = await browser.newPage();
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));
  
  try {
    // ---- 1. Login Page ----
    console.log("Navigating to Login Page...");
    await page.goto("http://localhost:8080/login", { waitUntil: "networkidle2" });
    await page.screenshot({ path: "C:/Users/sr2ma/.gemini/antigravity/brain/a8592d4b-85c0-4aff-871f-66e5f2c25e72/01_login_page.png" });

    // ---- 2. Admin Login ----
    console.log("Logging in as Admin (admin@examly.com)...");
    await page.type("input[type='email']", "admin@examly.com");
    await page.type("input[type='password']", "password123");
    await page.click("button[type='submit']");
    await page.waitForNavigation({ waitUntil: "networkidle2" });
    await page.screenshot({ path: "C:/Users/sr2ma/.gemini/antigravity/brain/a8592d4b-85c0-4aff-871f-66e5f2c25e72/02_admin_dashboard.png" });

    // ---- 3. Admin Course List ----
    console.log("Navigating to Admin Courses list...");
    await page.goto("http://localhost:8080/admin/courses", { waitUntil: "networkidle2" });
    await page.screenshot({ path: "C:/Users/sr2ma/.gemini/antigravity/brain/a8592d4b-85c0-4aff-871f-66e5f2c25e72/03_admin_course_list.png" });

    // ---- 4. Admin Create Course ----
    console.log("Opening Course Creation Dialog...");
    const addBtn = await page.waitForSelector("button::-p-text(Add course)");
    await addBtn.click();
    await new Promise(r => setTimeout(r, 1000));
    
    console.log("Filling course form details...");
    const inputs = await page.$$("input");
    await inputs[0].type("Advanced Python Certification Masterclass");
    
    // Select category "Professional"
    await page.select("select", "Professional");
    
    const textarea = await page.waitForSelector("textarea");
    await textarea.type("Learn production-grade Python patterns, decorators, metaclasses, and async execution workflows.");
    
    await inputs[1].type("50");
    await inputs[2].type("Expert Python Architect");
    await inputs[3].type("Principal Python Educator with 15+ years experience.");

    await page.screenshot({ path: "C:/Users/sr2ma/.gemini/antigravity/brain/a8592d4b-85c0-4aff-871f-66e5f2c25e72/04_admin_course_modal_filled.png" });
    
    // Click save
    const footerBtn = await page.waitForSelector("button::-p-text(Create Course)");
    await footerBtn.click();
    await new Promise(r => setTimeout(r, 2000)); // wait for database write
    await page.screenshot({ path: "C:/Users/sr2ma/.gemini/antigravity/brain/a8592d4b-85c0-4aff-871f-66e5f2c25e72/05_admin_course_created.png" });

    // ---- 5. Student Flow ----
    console.log("Logging out Admin / Clearing storage...");
    await page.evaluate(() => localStorage.clear());
    await page.evaluate(() => sessionStorage.clear());
    
    console.log("Navigating to login as Student (student@examly.com)...");
    await page.goto("http://localhost:8080/login", { waitUntil: "networkidle2" });
    await page.type("input[type='email']", "student@examly.com");
    await page.type("input[type='password']", "password123");
    await page.click("button[type='submit']");
    await page.waitForNavigation({ waitUntil: "networkidle2" });
    console.log("Waiting for subscription onboarding check...");
    await new Promise(r => setTimeout(r, 2500)); // wait for client-side redirect
    const urlAfterRedirect = page.url();
    if (urlAfterRedirect.includes("welcome-subscription")) {
      console.log("On subscription choice page. Clicking Activate Free Basic...");
      const activateBtn = await page.waitForSelector("button::-p-text(Activate Free Basic)");
      await activateBtn.click();
      await new Promise(r => setTimeout(r, 2500)); // wait for DB insert and redirect to dashboard
    }
    await page.screenshot({ path: "C:/Users/sr2ma/.gemini/antigravity/brain/a8592d4b-85c0-4aff-871f-66e5f2c25e72/06_student_dashboard.png" });

    // ---- 6. Student Marketplace ----
    console.log("Navigating to Marketplace...");
    await page.goto("http://localhost:8080/courses", { waitUntil: "networkidle2" });
    await page.screenshot({ path: "C:/Users/sr2ma/.gemini/antigravity/brain/a8592d4b-85c0-4aff-871f-66e5f2c25e72/07_student_marketplace.png" });

    // ---- 7. Click Course and view Authorization screen ----
    console.log("Clicking on the course card...");
    await page.waitForSelector("::-p-text(Advanced Python Certification Masterclass)");
    await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll("a"));
      const targetLink = links.find(a => a.textContent.includes("Advanced Python Certification Masterclass"));
      if (targetLink) {
        targetLink.click();
      } else {
        throw new Error("Target course link not found on marketplace!");
      }
    });
    await new Promise(r => setTimeout(r, 3500)); // wait for details page navigation and loader to clear
    await page.screenshot({ path: "C:/Users/sr2ma/.gemini/antigravity/brain/a8592d4b-85c0-4aff-871f-66e5f2c25e72/08_student_authorized_enroll_gate.png" });

    // ---- 8. Unlock or Enroll in Course ----
    console.log("Checking if Unlock or Enroll button is present...");
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll("button")).find(b => 
        b.textContent.includes("Unlock Course") || b.textContent.includes("Enroll in Course")
      );
      if (btn) {
        console.log("Clicking catalog action button...");
        btn.click();
      }
    });
    await new Promise(r => setTimeout(r, 6000)); // wait for database write and portal redirect
    await page.screenshot({ path: "C:/Users/sr2ma/.gemini/antigravity/brain/a8592d4b-85c0-4aff-871f-66e5f2c25e72/09_student_enrolled_player.png" });

    // ---- 9. Go to student dashboard ----
    console.log("Navigating to Student Dashboard to verify progress bar...");
    await page.goto("http://localhost:8080/dashboard", { waitUntil: "networkidle2" });
    await new Promise(r => setTimeout(r, 3500)); // wait for learning data sync and render
    await page.screenshot({ path: "C:/Users/sr2ma/.gemini/antigravity/brain/a8592d4b-85c0-4aff-871f-66e5f2c25e72/10_student_dashboard_enrolled.png" });

    console.log("Testing complete. Real browser screenshots saved successfully.");
  } catch (err) {
    console.error("E2E Execution Error:", err.message);
    await page.screenshot({ path: "C:/Users/sr2ma/.gemini/antigravity/brain/a8592d4b-85c0-4aff-871f-66e5f2c25e72/00_e2e_error.png" });
  } finally {
    await browser.close();
  }
}

runAutomation().catch(console.error);
