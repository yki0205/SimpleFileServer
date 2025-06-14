import { test, expect, Page } from '@playwright/test';

// 登录逻辑保持不变
async function login(page: Page) {
    await page.goto('http://localhost:2712');
    await page.getByRole('button', { name: 'Login' }).click();
    await expect(page.getByRole('heading', { name: 'Login' })).toBeVisible();
    await expect(page.getByText('Enter your credentials to access the file server')).toBeVisible();
    await page.getByPlaceholder('Username').fill('admin');
    await page.getByPlaceholder('Password').fill('admin123');
    await page.getByRole('button', { name: 'Login' }).click();
    await page.waitForURL('http://localhost:2712');
    await page.waitForLoadState('networkidle');
}

// 通用目录点击函数（通过 div+svg 的结构点击目录）
async function clickDirectory(page: Page, dirName: string) {
    const item = page.locator(`div:has(svg) >> text=${dirName}`);
    await item.waitFor({ state: 'visible', timeout: 5000 });
    await item.click();
}

// 通用文件点击函数（通过 div+svg 的结构点击文件）
async function clickFile(page: Page, fileName: string) {
    const item = page.locator(`div:has(svg) >> text=${fileName}`);
    await item.waitFor({ state: 'visible', timeout: 5000 });
    await item.click();
}

// ✅ MP3预览测试
test('MP3文件预览测试', async ({ page }) => {
    await login(page);

    await clickDirectory(page, 'audio');

    await page.waitForLoadState('networkidle');
    await clickFile(page, '中山大学 - 中山大学校歌.mp3');

    const audioPlayer = page.locator('audio');
    await expect(audioPlayer).toBeVisible();
    console.log('MP3打开正常');

    // 检查音频时长大于0
    const duration = await audioPlayer.evaluate((audio: HTMLAudioElement) => audio.duration);
    expect(duration).toBeGreaterThan(0);

    // 模拟点击播放按钮
    await audioPlayer.evaluate((audio: HTMLAudioElement) => audio.play());
    await page.waitForTimeout(500);

    // 检查音频正在播放
    const isPlaying = await audioPlayer.evaluate((audio: HTMLAudioElement) => !audio.paused);
    expect(isPlaying).toBe(true);

    console.log('MP3播放正常');
    
    // 检查倍速播放（如支持，设置为2倍速）
    await audioPlayer.evaluate((audio: HTMLAudioElement) => { audio.playbackRate = 2.0; });
    const playbackRate = await audioPlayer.evaluate((audio: HTMLAudioElement) => audio.playbackRate);
    expect(playbackRate).toBe(2.0);
    console.log('MP3倍速播放正常');

    await page.keyboard.press('Escape');
    await page.mouse.click(500, 300);

});


// ✅ AAC预览测试（独有逻辑）
test('AAC文件预览测试', async ({ page }) => {
    await login(page);

    await clickDirectory(page, 'audio');
    await page.waitForLoadState('networkidle');
    await clickFile(page, 'ff-16b-2c-44100hz.aac');

    const audioPlayer = page.locator('audio');
    await expect(audioPlayer).toBeVisible();
    console.log('AAC文件打开正常');
    
    await page.keyboard.press('Escape');
    await page.mouse.click(500, 300);
});


// ✅ FLAC预览测试
test('FLAC文件预览测试', async ({ page }) => {
    await login(page);

    await clickDirectory(page, 'audio');

    await page.waitForLoadState('networkidle');
    await clickFile(page, 'gs-16b-1c-44100hz.flac');

    const audioPlayer = page.locator('audio');
    await expect(audioPlayer).toBeVisible();
    console.log('FLAC文件打开正常');

     // 检查音频时长大于0
    const duration = await audioPlayer.evaluate((audio: HTMLAudioElement) => audio.duration);
    expect(duration).toBeGreaterThan(0);

    // 模拟点击播放按钮
    await audioPlayer.evaluate((audio: HTMLAudioElement) => audio.play());
    await page.waitForTimeout(500);

    // 检查音频正在播放
    const isPlaying = await audioPlayer.evaluate((audio: HTMLAudioElement) => !audio.paused);
    expect(isPlaying).toBe(true);

    console.log('FLAC播放正常');
    
    // 检查倍速播放（如支持，设置为2倍速）
    await audioPlayer.evaluate((audio: HTMLAudioElement) => { audio.playbackRate = 2.0; });
    const playbackRate = await audioPlayer.evaluate((audio: HTMLAudioElement) => audio.playbackRate);
    expect(playbackRate).toBe(2.0);
    console.log('FLAC倍速播放正常');

    await page.keyboard.press('Escape');
    await page.mouse.click(500, 300);

});

// ✅ WAV预览测试
test('WAV文件预览测试', async ({ page }) => {
    await login(page);

    await clickDirectory(page, 'audio');

    await page.waitForLoadState('networkidle');
    await clickFile(page, 'gs-16b-1c-44100hz.wav');

    const audioPlayer = page.locator('audio');
    await expect(audioPlayer).toBeVisible();
    console.log('WAV文件打开正常');

     // 检查音频时长大于0
    const duration = await audioPlayer.evaluate((audio: HTMLAudioElement) => audio.duration);
    expect(duration).toBeGreaterThan(0);

    // 模拟点击播放按钮
    await audioPlayer.evaluate((audio: HTMLAudioElement) => audio.play());
    await page.waitForTimeout(500);

    // 检查音频正在播放
    const isPlaying = await audioPlayer.evaluate((audio: HTMLAudioElement) => !audio.paused);
    expect(isPlaying).toBe(true);

    console.log('WAV播放正常');
    
    // 检查倍速播放（如支持，设置为2倍速）
    await audioPlayer.evaluate((audio: HTMLAudioElement) => { audio.playbackRate = 2.0; });
    const playbackRate = await audioPlayer.evaluate((audio: HTMLAudioElement) => audio.playbackRate);
    expect(playbackRate).toBe(2.0);
    console.log('AWV倍速播放正常');
    await page.keyboard.press('Escape');
    await page.mouse.click(500, 300);

});
