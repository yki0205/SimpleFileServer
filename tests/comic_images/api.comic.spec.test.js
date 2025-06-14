jest.setTimeout(2000);
const request = require('supertest');
const http = require('http');
const app = require('../app'); // 你的 express app
const path = require('path');

const username = 'admin';
const password = 'admin123';
const authHeader = 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64');

let server;

/*
beforeAll(done => {
  server = http.createServer(app);
  server.listen(0, done); // 随机端口监听，done 确保服务器启动完成
});

afterAll(done => {
  server.close(done); // 关闭服务器，释放资源
});*/
// 在所有测试之前启动服务器
beforeAll(async () => {
  server = http.createServer(app);
  await new Promise(resolve => server.listen(0, resolve));
});

// 在所有测试之后关闭服务器
afterAll(async () => {
  await new Promise(resolve => server.close(resolve));
});

describe('GET /api/comic', () => {
  test('TC-1: 解析 test.cbz 成功', async () => {
    const fs = require('fs');
    console.log(fs.existsSync(path.join('D:/SimpleFileServer/comic'))); // 应该是 true
    console.log('当前工作目录:', process.cwd());

    const res = await request(server)
      .get('/api/comic')
      .auth('admin', '123456')
      .query({ path: 'comic/test.cbz' });

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.pages)).toBe(true);
  });

  test('TC-2: 解析 test.cbr 成功', async () => {
    const res = await request(server)
      .get('/api/comic')
      .auth('admin', '123456')
      .query({ path: 'comic/test.cbr' });

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.pages)).toBe(true);
  });

  test('TC-3: 不支持格式 abc.docx', async () => {
    const res = await request(server)
      .get('/api/comic')
      .auth('admin', '123456')
      .query({ path: 'comic/test.docx' });

    expect(res.status).toBe(400);
  });

  test('TC-4: 文件不存在 missing.cbz', async () => {
    const res = await request(server)
      .get('/api/comic')
      .auth('admin', '123456')
      .query({ path: 'comic/missing.cbz' });

    expect(res.status).toBe(404);
  });

  test('TC-5: 非法路径 ../../../secret.cbz', async () => {
    const res = await request(server)
      .get('/api/comic')
      .auth('admin', '123456')
      .query({ path: '../../../secret.cbz' });

    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});
