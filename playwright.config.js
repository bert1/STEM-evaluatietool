// Testreeks voor de gebouwde tool (stem-evaluatietool/dist/). Draaien met
// "npm test": dat bouwt eerst en test dan.
const { defineConfig, devices } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    ...devices["Desktop Chrome"],
    viewport: { width: 1300, height: 900 },
  },
});
