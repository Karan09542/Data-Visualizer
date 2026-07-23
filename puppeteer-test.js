import puppeteer from 'puppeteer';

(async () => {
  console.log('Launching browser...');
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  page.on('console', msg => {
    try {
      console.log('BROWSER CONSOLE:', msg.type().toUpperCase(), msg.text());
    } catch (e) {}
  });
  page.on('pageerror', err => console.log('BROWSER ERROR:', err.toString()));
  page.on('requestfailed', request => console.log('REQUEST FAILED:', request.url(), request.failure().errorText));
  
  // Add a global error listener inside the page just to be sure
  await page.evaluateOnNewDocument(() => {
    window.addEventListener('error', (e) => {
      console.error('GLOBAL ERROR:', e.message, e.filename, e.lineno, e.error ? e.error.stack : '');
    });
    window.addEventListener('unhandledrejection', (e) => {
      console.error('UNHANDLED REJECTION:', e.reason);
    });
    
    // Override console.error to serialize objects
    const originalError = console.error;
    console.error = function(...args) {
      originalError.apply(console, args.map(a => typeof a === 'object' && a !== null ? (a.stack || JSON.stringify(a, Object.getOwnPropertyNames(a))) : a));
    };
  });  
  console.log('Navigating to http://localhost:4173/');
  await page.goto('http://localhost:4173/', { waitUntil: 'domcontentloaded', timeout: 30000 });

  console.log('Waiting 5s for app to initialize...');
  await new Promise(r => setTimeout(r, 5000));

  console.log('Triggering ImageWorkspace...');
  await page.evaluate(() => {
    try {
      const store = window.useStore && window.useStore.getState ? window.useStore.getState() : null;
      if (store) {
        console.log('Found store, setting activeExplorerFile...');
        store.setExpandedJsNodeId('test_image.png');
        store.setActiveExplorerFile('test_image.png');
        store.setWorkspaceTabs([{ path: 'test_image.png', isDirty: false }]);
        store.openWorkspaceTab('test_image.png');
      } else {
        console.log('Store not found on window');
      }
    } catch(e) {
      console.log('Eval error:', e.toString());
    }
  });

  const rects = await page.evaluate(() => {
    function toObj(rect) {
      if (!rect) return null;
      return {
        width: rect.width,
        height: rect.height,
        top: rect.top,
        left: rect.left,
        right: rect.right,
        bottom: rect.bottom
      };
    }
    const canvas = document.querySelector('canvas');
    if (!canvas) return null;
    const parent1 = canvas.parentElement;
    const result = {};
    const elements = document.querySelectorAll('canvas, div');
    for (const el of elements) {
      const cls = el.className;
      if (!cls || typeof cls !== 'string') continue;
      try {
        result[cls] = toObj(el.getBoundingClientRect());
      } catch(e) {
        console.log("Could not parse rect for", cls);
      }
    }
    return result;
  });
  console.log("Dimensions and Classes:", JSON.stringify(rects, null, 2));

  console.log("Waiting 5s for ImageWorkspace to render...");
  await new Promise(r => setTimeout(r, 5000));
  
  // Click on AITools Tab
  try {
    console.log("Clicking AITools Tab...");
    await page.evaluate(() => {
      const tabs = Array.from(document.querySelectorAll('button'));
      const aiTab = tabs.find(t => t.innerText && t.innerText.includes('AI Tools'));
      if (aiTab) aiTab.click();
    });
    
    await new Promise(r => setTimeout(r, 2000));
    
    console.log("Clicking Remove Background (ormbg)...");
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const rmBtn = btns.find(b => b.innerText && b.innerText.includes('Remove Background'));
      if (rmBtn) rmBtn.click();
    });
    
    console.log("Waiting 10s for Background Removal...");
    await new Promise(r => setTimeout(r, 10000));
    await page.screenshot({ path: 'puppeteer-seg-result.png', fullPage: true });
    console.log("Saved screenshot to puppeteer-seg-result.png");
  } catch(e) {
    console.error("Error interacting with AI Tools:", e);
  }

  const html = await page.evaluate(() => document.body.innerHTML);
  console.log("Body HTML length:", html.length);
  
  const fs = await import('fs');
  fs.writeFileSync('puppeteer-body.html', html);
  console.log('Saved HTML to puppeteer-body.html');
  
  await browser.close();
  console.log('Done.');
})();
