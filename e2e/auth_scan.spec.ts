import { test, expect } from '@playwright/test';

test.describe('LEGITIFY End-to-End Workflow', () => {
  const uniqueEmail = `e2e_student_${Date.now()}@legitify.io`;
  const password = 'StudentPassword@1234';

  test('User Registration', async ({ page }) => {
    // Navigate to registration page
    await page.goto('/register');
    await expect(page).toHaveURL('/register');

    // Fill in registration details
    await page.getByPlaceholder('Enter full name').fill('Playwright Student');
    await page.locator('input[type="email"]').fill(uniqueEmail);
    await page.locator('input[placeholder="Password"]').fill(password);
    await page.getByPlaceholder('Confirm').fill(password);

    // Select role (Student is selected by default, but click it explicitly)
    await page.click('button:has-text("Student")');

    // Submit registration
    await page.click('button[type="submit"]');

    // Upon registration, it should redirect directly to dashboard
    await page.waitForURL('/dashboard');
    await expect(page).toHaveURL('/dashboard');

    // Logout to leave clean slate for next tests
    await page.click('button:has-text("Sign Out")');
    await page.waitForURL('/login');
    await expect(page).toHaveURL('/login');
  });

  test('User Login, Scan Creation, Report Verification and Logout', async ({ page }) => {
    // 1. Login as the Admin user (pre-seeded) to ensure privileged workflow (mock scan-to-report completion) runs
    await page.goto('/login');
    await page.locator('input[type="email"]').fill('admin@legitify.io');
    await page.locator('input[type="password"]').fill('Admin@1234');
    await page.click('button[type="submit"]');

    // Should redirect to dashboard
    await page.waitForURL('/dashboard');
    await expect(page).toHaveURL('/dashboard');

    // Check dashboard metrics load (Total Scans and Average Trust Score are inside <p> labels)
    await expect(page.locator('p:has-text("Total Scans")')).toBeVisible();
    await expect(page.locator('p:has-text("Average Trust Score")')).toBeVisible();

    // 2. Navigate to Scan Page
    await page.goto('/scan');
    await page.waitForURL('/scan');

    // Select 'Text' scan type
    await page.click('button:has-text("Text")');

    // Enter raw text to verify
    const sampleText = 'Offer Letter from TechCorp Pvt Ltd. Position: Software Engineer Intern. Salary: 15 LPA. Requirements: Upfront deposit of ₹10,000 for training materials.';
    await page.locator('textarea').fill(sampleText);

    // Click Start Verification
    await page.click('button:has-text("Start AI Verification")');

    // Verify scan progress overlay appears
    await expect(page.locator('text=Verifying').first()).toBeVisible();

    // Wait for the redirect to report page (takes a few seconds to poll steps)
    await page.waitForURL(/\/report\/[a-f0-9-]+/, { timeout: 15000 });
    
    // Verify report page loaded
    await expect(page.locator('h2:has-text("AI Verification Report")')).toBeVisible();
    
    // 3. Verify evidence items are visible on report screen
    await expect(page.locator('text=Evidence Files & Findings')).toBeVisible();
    
    // 4. Logout using sidebar logout trigger
    await page.click('button:has-text("Sign Out")');
    await page.waitForURL('/login');
    await expect(page).toHaveURL('/login');
  });
});
