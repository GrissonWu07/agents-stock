const fs = require("node:fs");
const path = require("node:path");
const { defineConfig, devices } = require("@playwright/test");

const baseURL = process.env.E2E_UI_BASE_URL || "http://family-mac:12080";
const workers = Number(process.env.E2E_UI_WORKERS || 1);

function findExistingChromiumExecutable() {
  if (process.env.E2E_UI_CHROMIUM_EXECUTABLE) {
    return process.env.E2E_UI_CHROMIUM_EXECUTABLE;
  }

  const browserRoot = path.join(process.env.LOCALAPPDATA || "", "ms-playwright");
  if (!browserRoot || !fs.existsSync(browserRoot)) return undefined;

  return fs
    .readdirSync(browserRoot)
    .filter((name) => /^chromium-\d+$/.test(name))
    .sort((left, right) => Number(right.split("-")[1]) - Number(left.split("-")[1]))
    .map((name) => [
      path.join(browserRoot, name, "chrome-win64", "chrome.exe"),
      path.join(browserRoot, name, "chrome-win", "chrome.exe"),
    ])
    .flat()
    .find((candidate) => fs.existsSync(candidate));
}

const executablePath = findExistingChromiumExecutable();

module.exports = defineConfig({
  testDir: ".",
  testMatch: /.*\.spec\.js/,
  timeout: 600_000,
  expect: {
    timeout: 15_000,
  },
  fullyParallel: false,
  workers,
  reporter: [
    ["list"],
    ["html", { outputFolder: "playwright-report", open: "never" }],
    ["json", { outputFile: "test-results/results.json" }],
  ],
  use: {
    baseURL,
    browserName: "chromium",
    headless: process.env.E2E_UI_HEADED === "1" ? false : true,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    actionTimeout: 20_000,
    navigationTimeout: 30_000,
    locale: "zh-CN",
    timezoneId: "Asia/Shanghai",
    launchOptions: executablePath ? { executablePath } : undefined,
  },
  projects: [
    {
      name: "chromium-desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 1100 },
      },
    },
  ],
});
