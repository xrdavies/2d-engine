import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/browser",
  use: {
    baseURL: "http://127.0.0.1:4173",
  },
  projects: [
    {
      name: "chromium-webgpu",
      use: {
        browserName: "chromium",
        launchOptions: {
          args: ["--enable-unsafe-webgpu", "--use-angle=swiftshader"],
        },
      },
    },
    { name: "firefox", use: { browserName: "firefox" } },
    { name: "webkit", use: { browserName: "webkit" } },
  ],
  webServer: {
    command: "vite --host 127.0.0.1 --port 4173",
    url: "http://127.0.0.1:4173/examples/triangle/",
    reuseExistingServer: !process.env.CI,
  },
});
