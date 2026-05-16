async (page) => {
  const results = { pass: [], fail: [], logs: [] };

  function log(msg) {
    results.logs.push(msg);
  }

  function assert(condition, message) {
    if (condition) {
      results.pass.push(message);
    } else {
      results.fail.push(message);
    }
  }

  try {
    log('Starting route tour QA');

    await page.route('**/ask*', async route => {
      log('Intercepted /ask request for mocking');
      const streamBody = 'data: alpha beta gamma\n\n';
      await route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: streamBody
      });
    });

    await page.goto('http://localhost:3000/workspace/test-session');
    await page.waitForSelector('[data-testid="dashboard-shell"]');
    
    const shell = await page.$('[data-testid="dashboard-shell"]');
    assert(!!shell, 'Dashboard shell exists');
    
    const sidebar = await page.$('[data-testid="app-sidebar"]');
    assert(!!sidebar, 'App sidebar exists');
    
    const header = await page.$('[data-testid="app-header"]');
    assert(!!header, 'App header exists');
    
    const content = await page.$('[data-testid="dashboard-content"]');
    assert(!!content, 'Dashboard content exists');

    const resizablePanels = await page.$$('[data-panel-resize-handle-id]');
    assert(resizablePanels.length === 0, 'No react-resizable-panels resize handles exist');

    const panelGroups = await page.$$('[data-panel-group-id]');
    assert(panelGroups.length === 0, 'No react-resizable-panels group containers exist');

    log('Testing Cmd+K');
    await page.keyboard.press('Meta+KeyK');
    await page.waitForTimeout(500); 
    let commandPalette = await page.$('[cmdk-dialog], [role="dialog"]');
    if (!commandPalette) {
      await page.keyboard.press('Control+KeyK');
      await page.waitForTimeout(500); 
      commandPalette = await page.$('[cmdk-dialog], [role="dialog"]');
    }
    assert(!!commandPalette, 'Command Palette opens on Cmd/Ctrl+K');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    log('Testing Cmd+J and Stream Survival');
    const noSheetBefore = await page.$('[data-testid="copilot-sheet-content"]');
    assert(!noSheetBefore, 'Copilot Sheet is not permanently mounted / visible before Cmd+J');

    await page.keyboard.press('Meta+KeyJ');
    await page.waitForTimeout(500);
    let sheetAfter = await page.$('[data-testid="copilot-sheet-content"]');
    if (!sheetAfter) {
      await page.keyboard.press('Control+KeyJ');
      await page.waitForTimeout(500);
      sheetAfter = await page.$('[data-testid="copilot-sheet-content"]');
    }
    assert(!!sheetAfter, 'Copilot Sheet opens on Cmd/Ctrl+J');
    
    log('Typing /btw test message into Copilot');
    await page.fill('input[placeholder*="Type /help"]', '/btw hello stream test');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1000);
    
    const messages1 = await page.$$eval('.prose.prose-sm', els => els.map(el => el.innerText));
    log('Current assistant messages: ' + JSON.stringify(messages1));
    assert(messages1.some(m => m.includes('alpha beta gamma')), 'Stream response rendered in chat');
    
    log('Closing sheet');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    log('Navigating to another route to test survival');
    const sdlcBtn = await page.$('[data-testid="sidebar-nav-sdlc"]');
    if (sdlcBtn) {
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle' }).catch(() => {}),
        sdlcBtn.click()
      ]);
      await page.waitForSelector('[data-testid="dashboard-shell"]', { timeout: 5000 }).catch(() => {});
    }

    log('Re-opening sheet');
    await page.keyboard.press('Meta+KeyJ');
    await page.waitForTimeout(500);
    
    const messages2 = await page.$$eval('.prose.prose-sm', els => els.map(el => el.innerText));
    log('Messages after navigation: ' + JSON.stringify(messages2));
    assert(messages2.some(m => m.includes('alpha beta gamma')), 'Stream response survived route navigation');
    
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    const navItems = [
      { id: 'chat', label: 'AI Copilot' },
      { id: 'explorer', label: 'Explorer' },
      { id: 'sdlc', label: 'SDLC Pipeline' },
      { id: 'tracing', label: 'Tracing' },
      { id: 'db', label: 'Database' },
      { id: 'settings', label: 'Settings' },
      { id: 'world', label: 'World' },
      { id: 'sessions', label: 'Sessions' }
    ];

    for (const item of navItems) {
      log(`Testing route: ${item.id}`);
      
      const navSelector = `[data-testid="sidebar-nav-${item.id}"]`;
      const navBtn = await page.$(navSelector);
      
      if (navBtn) {
        await Promise.all([
          page.waitForNavigation({ waitUntil: 'networkidle' }).catch(() => {}),
          navBtn.click()
        ]);
        
        await page.waitForSelector('[data-testid="dashboard-shell"]', { timeout: 5000 }).catch(() => {});
        
        await page.screenshot({ path: `.sisyphus/evidence/task-11-route-tour/route-${item.id}.png` });
        
        const contentVisible = await page.$eval('[data-testid="dashboard-content"]', el => el.innerText.length > 0).catch(() => false);
        assert(contentVisible, `Content is rendered for route ${item.id}`);
        
        const pageText = await page.content();
        if (pageText.includes('This page could not be found')) {
          log(`Route ${item.id} returned a 404 page`);
        } else {
          log(`Route ${item.id} loaded successfully`);
        }
      } else {
        assert(false, `Nav button for ${item.id} not found`);
      }
    }
    
    await page.keyboard.press('Meta+KeyJ');
    await page.waitForTimeout(500);
    await page.screenshot({ path: '.sisyphus/evidence/task-11-stream-route-survival.png' });

  } catch (error) {
    results.fail.push('Script error: ' + error.message);
  }

  const summaryText = `
QA Browser Tour Results:
Passed: ${results.pass.length}
Failed: ${results.fail.length}

Passes:
${results.pass.map(p => '✅ ' + p).join('\n')}

Failures:
${results.fail.map(f => '❌ ' + f).join('\n')}

Logs:
${results.logs.join('\n')}
`;
  return summaryText.trim();
}
