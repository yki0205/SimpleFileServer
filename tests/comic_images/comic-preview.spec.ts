import { test, expect, Page } from '@playwright/test';

// 登录逻辑保持不变
async function login(page: Page) {
    await page.goto('http://localhost:2712');
    await page.getByRole('button', { name: 'Login' }).click();
    await expect(page.getByRole('heading', { name: 'Login' })).toBeVisible();
    await expect(page.getByText('Enter your credentials to access the file server')).toBeVisible();
    await page.getByPlaceholder('Username').fill('admin');
    await page.getByPlaceholder('Password').fill('123456');
    await page.getByRole('button', { name: 'Login' }).click();
    await page.waitForURL('http://localhost:2712');
    await page.waitForLoadState('networkidle');
}

// 通用目录点击函数
async function clickDirectory(page: Page, dirName: string) {
    const item = page.locator(`div:has(svg) >> text=${dirName}`);
    await item.waitFor({ state: 'visible', timeout: 5000 });
    await item.click();
}

// 通用文件点击函数
async function clickFile(page: Page, fileName: string) {
    const item = page.locator(`div:has(svg) >> text=${fileName}`);
    await item.waitFor({ state: 'visible', timeout: 5000 });
    await item.click();
}

// ✅ CBZ 测试
test('TF-05:CBZ 漫画预览功能测试', async ({ page }) => {
    await login(page);
    await page.waitForLoadState('networkidle');
    await clickDirectory(page, 'comic');
    await page.waitForLoadState('networkidle');
    await clickFile(page, 'test.cbz');

    // 确认打开了图片预览（假设 CBZ 解压后直接展示图片）
    await expect(page.getByRole('img', { name: 'Page 1' })).toBeVisible();


    // 浏览图片测试
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(300);
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('Escape');
    await page.mouse.click(500, 300);

    // 回到 comic 文件夹
    await expect(page.getByText('comic')).toBeVisible();
});

// ✅ CBR 测试
test('TF-06:CBR 漫画预览功能测试', async ({ page }) => {
    await login(page);
    await page.waitForLoadState('networkidle');
    await clickDirectory(page, 'comic');
    await page.waitForLoadState('networkidle');
    await clickFile(page, 'test.cbr');

    await expect(page.getByRole('img', { name: 'Page 1' })).toBeVisible();

    await page.keyboard.press('ArrowRight');//左右轮滑
    await page.waitForTimeout(300);
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('Escape');//esc
    await page.mouse.click(500, 300);

    await expect(page.getByText('comic')).toBeVisible();
});
