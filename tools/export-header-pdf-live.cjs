const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const chromePath = "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe";
const port = 9361;
const userDataDir = path.resolve("artifacts/header-system/chrome-pdf-profile");
const downloadDir = path.resolve("artifacts/header-system/pdf-downloads");
const target = path.resolve("artifacts/header-system/live-export-header-edition.pdf");

fs.rmSync(userDataDir, { recursive: true, force: true });
fs.mkdirSync(userDataDir, { recursive: true });
fs.mkdirSync(downloadDir, { recursive: true });
for (const file of fs.readdirSync(downloadDir)) {
  if (file.toLowerCase().endsWith(".pdf")) {
    fs.rmSync(path.join(downloadDir, file), { force: true });
  }
}

const chrome = spawn(
  chromePath,
  [
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${userDataDir}`,
    "--headless=new",
    "--disable-gpu",
    "--window-size=1440,1100",
    "http://localhost:3000",
  ],
  { stdio: "ignore" },
);

chrome.on("error", (error) => {
  console.error(error);
  process.exit(1);
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function readJson(url) {
  const response = await fetch(url);
  return response.json();
}

async function connect() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const pages = await readJson(`http://127.0.0.1:${port}/json`);
      const page = pages.find((candidate) => candidate.type === "page");

      if (page?.webSocketDebuggerUrl) {
        return new WebSocket(page.webSocketDebuggerUrl);
      }
    } catch {
      // Chrome is still starting.
    }

    await sleep(500);
  }

  throw new Error("Chrome CDP did not start");
}

async function main() {
  const ws = await connect();
  let id = 0;
  const pending = new Map();

  ws.onmessage = (event) => {
    const message = JSON.parse(event.data);

    if (message.id && pending.has(message.id)) {
      const handlers = pending.get(message.id);
      pending.delete(message.id);

      if (message.error) {
        handlers.reject(new Error(JSON.stringify(message.error)));
      } else {
        handlers.resolve(message.result);
      }
    }
  };

  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const callId = ++id;
      pending.set(callId, { resolve, reject });
      ws.send(JSON.stringify({ id: callId, method, params }));
    });

  await new Promise((resolve) => {
    ws.onopen = resolve;
  });

  await send("Page.enable");
  await send("Runtime.enable");
  await send("Browser.setDownloadBehavior", {
    behavior: "allow",
    downloadPath: downloadDir,
  });
  await sleep(12000);

  const pagesCreated = await send("Runtime.evaluate", {
    returnByValue: true,
    awaitPromise: true,
    expression: `(async () => {
      const normalize = (value) => (value || "").replace(/\\s+/g, " ").trim();
      const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      const getPageCount = () => {
        const match = document.body.innerText.match(/Page\\s+\\d+\\s+\\/\\s+(\\d+)/);
        return match ? Number(match[1]) : 0;
      };
      const buttons = Array.from(document.querySelectorAll("button"));
      const insertPageButton = buttons.find((el) => el.title === "Insert Page After");

      if (!insertPageButton) {
        return {
          created: false,
          pageCount: getPageCount(),
          buttons: buttons.slice(0, 180).map((el, index) => ({
            index,
            text: normalize(el.textContent),
            title: el.title || "",
          })),
        };
      }

      for (let attempt = 0; attempt < 4 && getPageCount() < 3; attempt += 1) {
        insertPageButton.click();
        await sleep(700);
      }

      return { created: getPageCount() >= 3, pageCount: getPageCount() };
    })()`,
  });

  if (!pagesCreated.result.value.created) {
    fs.writeFileSync(
      path.resolve("artifacts/header-system/pdf-export-page-actions.json"),
      JSON.stringify(pagesCreated.result.value, null, 2),
    );
    throw new Error("Unable to create a three-page document before PDF export");
  }

  await sleep(2000);

  const clicked = await send("Runtime.evaluate", {
    returnByValue: true,
    expression: `(() => {
      const buttons = Array.from(document.querySelectorAll("button"));
      const button = buttons.find((el) => (el.textContent || "").replace(/\\s+/g, " ").trim() === "Export PDF");

      if (!button) {
        return {
          clicked: false,
          buttons: buttons.slice(0, 180).map((el, index) => ({
            index,
            text: (el.textContent || "").replace(/\\s+/g, " ").trim(),
          })),
        };
      }

      button.click();
      return { clicked: true };
    })()`,
  });

  if (!clicked.result.value.clicked) {
    fs.writeFileSync(
      path.resolve("artifacts/header-system/pdf-export-buttons.json"),
      JSON.stringify(clicked.result.value, null, 2),
    );
    throw new Error("Export PDF button not found");
  }

  let downloaded = null;
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const files = fs
      .readdirSync(downloadDir)
      .filter((name) => name.toLowerCase().endsWith(".pdf"));

    if (files.length > 0) {
      downloaded = files
        .map((name) => path.join(downloadDir, name))
        .sort((first, second) => fs.statSync(second).mtimeMs - fs.statSync(first).mtimeMs)[0];
      break;
    }

    await sleep(500);
  }

  if (!downloaded) {
    throw new Error("PDF download did not appear");
  }

  fs.copyFileSync(downloaded, target);
  console.log(JSON.stringify({ downloaded, target, bytes: fs.statSync(target).size }, null, 2));
  ws.close();
  chrome.kill();
}

main().catch((error) => {
  console.error(error);
  chrome.kill();
  process.exit(1);
});
