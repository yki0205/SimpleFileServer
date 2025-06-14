jest.setTimeout(20000); // 设置超时时间

const request = require('supertest');
const http = require('http');
const app = require('../app'); // 替换为你实际的 app 路径

let server;

beforeAll(done => {
  server = http.createServer(app);
  server.listen(0, done); // 使用随机端口
});

afterAll(done => {
  server.close(done); // 清理资源
});

describe('GET /api/images', () => {

  test('TI-1: 正常获取图片列表', async () => {
    const res = await request(server)
      .get('/api/images')
      .auth('admin', '123456')
      .query({ dir: 'images' }); // 假设 comic 目录下有图像

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.images)).toBe(true);
  });

  test('TI-2: 分页获取 limit=2&page=1', async () => {
    const res = await request(server)
      .get('/api/images')
      .auth('admin', '123456')
      .query({ dir: 'images', limit: 2, page: 1 });

    expect(res.status).toBe(200);
    expect(res.body.images.length).toBeLessThanOrEqual(2);
    expect(res.body).toHaveProperty('total');
    expect(res.body).toHaveProperty('hasMore');
  });

  test('TI-3: 排序测试 sortBy=name&sortOrder=desc', async () => {
    const res = await request(server)
      .get('/api/images')
      .auth('admin', '123456')
      .query({ dir: 'images', sortBy: 'name', sortOrder: 'desc' });

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.images)).toBe(true);
  });

  test('TI-4: 缺少 dir 参数默认根目录', async () => {
    const res = await request(server)
      .get('/api/images')
      .auth('admin', '123456');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.images)).toBe(true);
  });

  test('TI-5: 越权访问 dir=../../eTI', async () => {
    const res = await request(server)
      .get('/api/images')
      .auth('admin', '123456')
      .query({ dir: '../../eTI' });

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/access denied/i);
  });

    
    /*
  test('TI-16: 只返回支持的图片格式（如 jpg、png 等）', async () => {
    const res = await request(server)
      .get('/api/images')
      .auth('admin', '123456')
      .query({ dir: 'images' }); // 该目录应包含多种文件类型
  
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.images)).toBe(true);
  
    const allowedExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    
    for (const imgPath of res.body.images) {
      const ext = imgPath.toLowerCase().substring(imgPath.lastIndexOf('.'));
      expect(allowedExts).toContain(ext);
    }
  });*/
  describe('GET /api/images', () => {
    test('TI-6: 只返回支持的图片格式（如 jpg、png 等）', async () => {
      const res = await request(server)
        .get('/api/images')
        .auth('admin', '123456')
        .query({ dir: 'images', sortBy: 'name', sortOrder: 'desc' });
  
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.images)).toBe(true);
  
      // 支持的图片后缀
      const supportedExts = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'];
  
      // 确认每个图片文件名的后缀在支持范围内
      for (const img of res.body.images) {
        // img 是对象，使用 img.name 或 img.path（根据你实际结构）
        const name = img.name || '';
        const ext = name.slice(name.lastIndexOf('.')).toLowerCase();
  
        expect(supportedExts).toContain(ext);
      }
    });
  });
  
  
  test('TI-7: 支持大小写不敏感的 jpg', async () => {
    const res = await request(server)
      .get('/api/images')
      .auth('admin', '123456')
      .query({ dir: 'images' });

    expect(res.status).toBe(200);
    expect(res.body.images.some(img => /\.(jpg|JPG)$/.test(img.name))).toBe(true);
  });

  test('TI-8: 支持大小写不敏感的 png', async () => {
    const res = await request(server)
      .get('/api/images')
      .auth('admin', '123456')
      .query({ dir: 'images' });

    expect(res.status).toBe(200);
    expect(res.body.images.some(img => /\.(png|PNG)$/.test(img.name))).toBe(true);
  });

  test('TI-9: 支持大小写不敏感的 JPEG', async () => {
    const res = await request(server)
      .get('/api/images')
      .auth('admin', '123456')
      .query({ dir: 'images' });

    expect(res.status).toBe(200);
    expect(res.body.images.some(img => /\.(jpeg|JPEG)$/.test(img.name))).toBe(true);
  });

  test('TI-10: 支持大小写不敏感的 gif', async () => {
    const res = await request(server)
      .get('/api/images')
      .auth('admin', '123456')
      .query({ dir: 'images' });

    expect(res.status).toBe(200);
    expect(res.body.images.some(img => /\.(gif|GIF)$/.test(img.name))).toBe(true);
  });
    
});
