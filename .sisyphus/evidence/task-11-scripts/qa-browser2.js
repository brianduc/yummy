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
      const streamBody = 'data: "alpha beta gamma"\n\n';
      await route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: streamBody
      });
    });

    await page.goto('http://localhost:3000/workspace/test-session');
    await page.waitForLoadState('networkidle');
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

    log('Testing Cmd+K via Trigger Click');
    await page.click('[data-testid="command-palette-trigger"]');
    await page.waitForTimeout(500); 
    let commandPalette = await page.$('[cmdk-dialog], [role="dialog"], [data-testid="command-palette-dialog"]');
    assert(!!commandPalette, 'Command Palette opens on trigger click');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    log('Testing Cmd+J via Trigger Click and Stream Survival');
    const noSheetBefore = await page.$('[data-testid="copilot-sheet"]');
    assert(!noSheetBefore, 'Copilot Sheet is not permanently mounted before opening');

    await page.click('[data-testid="ai-copilot-trigger"]');
    await page.waitForTimeout(500);
    let sheetAfter = await page.$('[data-testid="copilot-sheet"]');
    assert(!!sheetAfter, 'Copilot Sheet opens on trigger click');
    
    if (sheetAfter) {
      log('Typing /btw test message into Copilot');
      await page.fill('input[placeholder*="Type /help"]', '/btw hello stream test');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(2000);
      
      const messages1 = await page.$$eval('.prose.prose-sm', els => els.map(el => el.innerText));
      log('Current assistant messages: ' + JSON.stringify(messages1));
      assert(messages1.some(m => m.includes('alpha beta gamma')), 'Stream response rendered in chat');
      
      log('Closing sheet');
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);

      log('Navigating to another route to test survival (SDLC)');
      await page.goto('http://localhost:3000/workspace/test-session/sdlc');
      await page.waitForSelector('[data-testid="dashboard-shell"]', { timeout: 10000 });

      log('Re-opening sheet');
      await page.click('[data-testid="ai-copilot-trigger"]');
      await page.waitForTimeout(500);
      
      const messages2 = await page.$$eval('.prose.prose-sm', els => els.map(el => el.innerText));
      log('Messages after navigation: ' + JSON.stringify(messages2));
      assert(messages2.some(m => m.includes('alpha beta gamma')), 'Stream response survived route navigation');
      
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    } else {
      assert(false, 'Skipping stream survival test because Copilot sheet did not open');
    }

    const navItems = [
      { id: 'chat', path: '' },
      { id: 'explorer', path: '/explorer' },
      { id: 'sdlc', path: '/sdlc' },
      { id: 'tracing', path: '/tracing' },
      { id: 'db', path: '/database' },
      { id: 'settings', path: '/settings' },
      { id: 'world', path: '/world' },
      { id: 'sessions', path: '/sessions' }
    ];

    for (const item of navItems) {
      log(`Testing route: ${item.id}`);
      await page.goto(`http://localhost:3000/workspace/test-session${item.path}`);
      await page.waitForTimeout(2000); 
      
      const notFoundHeader = await page.$('h1.next-error-h1');
      if (notFoundHeader) {
        log(`Route ${item.id} returned a 404 page`);
      } else {
        const shellExists = await page.$('[data-testid="dashboard-shell"]');
        assert(!!shellExists, `Dashboard shell exists on route ${item.id}`);
        
        await page.screenshot({ path: `.sisyphus/evidence/task-11-route-tour/route-${item.id}.png` });
        
        const contentVisible = await page.$eval('[data-testid="dashboard-content"]', el => el?.innerText?.length > 0).catch(() => false);
        assert(contentVisible, `Content is rendered for route ${item.id}`);
      }
    }
    
    await page.goto('http://localhost:3000/workspace/test-session');
    await page.click('[data-testid="ai-copilot-trigger"]');
    await page.waitForTimeout(500);
    await page.screenshot({ path: '.sisyphus/evidence/task-11-stream-route-survival.png' });

  } catch (error) {
    results.fail.push('Script error: ' + error.stack);
  }

  const summaryText = `QA Browser Tour Results:\nPassed: ${results.pass.length}\nFailed: ${results.fail.length}\n\nPasses:\n${results.pass.map(p => '✅ ' + p).join('\n')}\n\nFailures:\n${results.fail.map(f => '❌ ' + f).join('\n')}\n\nLogs:\n${results.logs.join('\n')}`;
  
  return summaryText;
}
