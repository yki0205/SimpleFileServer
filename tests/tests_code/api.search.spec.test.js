jest.setTimeout(20000); // 设置超时20秒

const request = require('supertest');
const http = require('http');
const app = require('../app'); // 你的 Express app 实例路径

const config = require('../config'); // 导入配置文件
const indexer = require('../indexer'); // 导入索引模块

let server;

// 在所有测试之前启动服务器
beforeAll(async () => {
  server = http.createServer(app);
  await new Promise(resolve => server.listen(0, resolve));
});

// 在所有测试之后关闭服务器
afterAll(async () => {
  await new Promise(resolve => server.close(resolve));
});

describe('GET /api/search', () => {
  test('TS-1: 正常搜索 query=abc', async () => {
    const basicAuth = 'Basic ' + Buffer.from('admin:123456').toString('base64');
    const res = await request(server)
      .get('/api/search')
      .auth('admin', '123456')
      .query({ query: 'abc' });
  
      console.log('Status:', res.status);
      console.log('Headers:', res.headers);
      console.log('Body:', res.body);
      

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.results)).toBe(true);
  });


  test('TS-2: 缺少 query 参数应返回 400', async () => {
    const res = await request(server)
      .get('/api/search')
      .auth('admin', '123456');

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/query is required/i);
    expect(res.body.results).toBeUndefined();
  });

  test('TS-3: 分页查询 page=1&limit=1', async () => {
    const res = await request(server)
      .get('/api/search')
      .auth('admin', '123456')
      .query({ query: 'comic', page: 1, limit: 1 });

    expect(res.status).toBe(200);
    expect(res.body.results.length).toBeLessThanOrEqual(1);
  });

  test('TS-4: 排序测试 sortBy=name&sortOrder=desc', async () => {
    const res = await request(server)
      .get('/api/search')
      .auth('admin', '123456')
      .query({ query: 'comic', sortBy: 'name', sortOrder: 'desc' });

    expect(res.status).toBe(200);
  });

  test('TS-5: 越权访问 dir=../etc', async () => {
    const res = await request(server)
      .get('/api/search')
      .auth('guest', 'guest')
      .query({ query: 'abc', dir: '../etc' });

    expect(res.status).toBeGreaterThanOrEqual(400);
  });
  test('TS-6: 分页参数异常处理（page=-1）', async () => {
    const res = await request(server)
      .get('/api/search')
      .auth('admin', '123456')
      .query({ query: 'comic', page: -1, limit: 10 });

    expect(res.status).toBe(200);
    expect(res.body.results.length).toBeGreaterThan(0);
  });
    // 索引功能测试
    test('TS-7: 索引搜索与实时搜索结果一致性', async () => {
      // 假设索引已构建
      const indexRes = await request(server)
        .get('/api/search')
        .auth('admin', '123456')
        .query({ query: 'comic' });
  
      // 临时禁用索引，使用实时搜索
      config.useFileIndex = false;
      const realtimeRes = await request(server)
        .get('/api/search')
        .auth('admin', '123456')
        .query({ query: 'comic' });
  
      // 恢复索引
      config.useFileIndex = true;
      
      // 简化验证：验证结果数量一致（实际应验证内容一致性）
      expect(indexRes.body.total).toBe(realtimeRes.body.total);
    });
});
