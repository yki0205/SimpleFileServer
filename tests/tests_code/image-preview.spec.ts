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

// ✅ PNG 测试
test('TF-01:PNG 图像预览功能测试', async ({ page }) => {
    await login(page);

    await clickDirectory(page, 'images');

    await page.waitForLoadState('networkidle');
    await clickFile(page, 'test.png');

    await expect(page.getByRole('img', { name: 'Preview' })).toBeVisible();

    await page.keyboard.press('ArrowRight');//左右轮滑
    await page.waitForTimeout(500);
    await page.keyboard.press('ArrowLeft');
    await page.mouse.wheel(0, -500);//上下滚动
    await page.mouse.wheel(0, 500);
    await page.keyboard.press('Enter');//回车
    await page.waitForTimeout(1000);
    await page.keyboard.press('Escape');
    await page.mouse.click(500, 300);
    await expect(page.getByText('images')).toBeVisible();
    //await expect(page.locator('.toolbar')).toBeVisible();
});

// ✅ JPG 测试
test('TF-02:JPG 图像预览功能测试', async ({ page }) => {
    await login(page);
    await clickDirectory(page, 'images');
    await clickFile(page, 'test.jpg');
    await expect(page.getByRole('img', { name: 'Preview' })).toBeVisible(); // ✅ 精确匹配 alt="Preview"

    await expect(page.getByRole('img', { name: 'Preview' })).toBeVisible();

    await page.keyboard.press('ArrowRight');//左右轮滑
    await page.waitForTimeout(500);
    await page.keyboard.press('ArrowLeft');
    await page.mouse.wheel(0, -500);//上下滚动
    await page.mouse.wheel(0, 500);
    await page.keyboard.press('Enter');//回车
    await page.waitForTimeout(1000);
    await page.keyboard.press('Escape');
    await page.mouse.click(500, 300);
    await expect(page.getByText('images')).toBeVisible();
    //await expect(page.locator('.toolbar')).toBeVisible();

});

// ✅ JPEG 测试
test('TF-03:JPEG 图像预览功能测试', async ({ page }) => {
    await login(page);
    await clickDirectory(page, 'images');
    await clickFile(page, 'test.jpeg');
    await expect(page.getByRole('img', { name: 'Preview' })).toBeVisible(); // ✅ 精确匹配 alt="Preview"
    await expect(page.getByRole('img', { name: 'Preview' })).toBeVisible();

    await page.keyboard.press('ArrowRight');//左右轮滑
    await page.waitForTimeout(500);
    await page.keyboard.press('ArrowLeft');
    await page.mouse.wheel(0, -500);//上下滚动
    await page.mouse.wheel(0, 500);
    await page.keyboard.press('Enter');//回车
    await page.waitForTimeout(1000);
    await page.keyboard.press('Escape');
    await page.mouse.click(500, 300);
    await expect(page.getByText('images')).toBeVisible();
    //await expect(page.locator('.toolbar')).toBeVisible();


    
});

// ✅ GIF 测试
test('TF-04:GIF 图像预览功能测试', async ({ page }) => {
    await login(page);
    await clickDirectory(page, 'images');
    await page.waitForLoadState('networkidle');
    await clickFile(page, 'test.gif');

    await expect(page.getByRole('img', { name: 'Preview' })).toBeVisible();

    await page.keyboard.press('ArrowRight');//左右轮滑
    await page.waitForTimeout(500);
    await page.keyboard.press('ArrowLeft');
    await page.mouse.wheel(0, -500);//上下滚动
    await page.mouse.wheel(0, 500);
    await page.keyboard.press('Enter');//回车
    await page.waitForTimeout(1000);
    await page.keyboard.press('Escape');
    await page.mouse.click(500, 300);
    await expect(page.getByText('images')).toBeVisible();
});
