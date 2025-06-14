import os
import requests
import shutil
import tempfile
from urllib.parse import quote

# 配置服务器地址
BASE_URL = "http://localhost:11073"
UPLOAD_DIR = "test_files"

# 创建测试文件夹
def setup_test_dir():
    if not os.path.exists(UPLOAD_DIR):
        os.makedirs(UPLOAD_DIR)

    # 创建测试文件
    test_files = {
        "test.txt": b"Hello, SimpleFileServer!",
        "test.jpg": b"\xFF\xD8\xFF\xE0\x00\x10\x4A\x46\x49\x46\x00\x01",  # dummy JPEG header
        "test.pdf": b"%PDF-1.5\n%\x93\xC3\x82\x92\n1 0 obj",
        "test.epub": b"PK\x03\x04\n\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00",
        "test.mp3": b"ID3\x03\x00\x00\x00\x00\x00\x03TIT2\x00\x00\x00\x13\x00\x00\x00This is a test MP3",
    }

    for filename, content in test_files.items():
        with open(os.path.join(UPLOAD_DIR, filename), "wb") as f:
            f.write(content)

def upload_file(filename):
    url = f"{BASE_URL}/api/upload"
    file_path = os.path.join(UPLOAD_DIR, filename)
    
    with open(file_path, "rb") as f:
        files = {"file": (filename, f)}
        data = {"path": "/"}
        response = requests.post(url, files=files, data=data)
    
    print(f"[Upload] {filename} => Status Code: {response.status_code}")
    assert response.status_code == 200, f"Upload failed for {filename}"

def download_file(filename):
    encoded_path = quote(f"/{filename}")
    url = f"{BASE_URL}/api/raw?path={encoded_path}"
    response = requests.get(url, stream=True)

    print(f"[Download] {filename} => Status Code: {response.status_code}")
    assert response.status_code == 200, f"Download failed for {filename}"

    download_path = os.path.join(UPLOAD_DIR, f"downloaded_{filename}")
    with open(download_path, "wb") as f:
        shutil.copyfileobj(response.raw, f)

    print(f"Downloaded file saved to {download_path}")

def cleanup():
    shutil.rmtree(UPLOAD_DIR)
    print("[Cleanup] Test directory removed")

if __name__ == "__main__":
    print("🚀 Starting tests for SimpleFileServer...\n")
    
    setup_test_dir()

    try:
        # 上传测试
        print("📤 Testing file upload...")
        for filename in os.listdir(UPLOAD_DIR):
            upload_file(filename)

        # 下载测试
        print("\n📥 Testing file download...")
        for filename in os.listdir(UPLOAD_DIR):
            if not filename.startswith("downloaded_"):
                download_file(filename)

        print("\n✅ All tests passed successfully!")

    except Exception as e:
        print(f"❌ Test failed: {e}")
    
    finally:
        cleanup()