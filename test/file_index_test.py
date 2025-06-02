#!/usr/bin/env python
# -*- coding: utf-8 -*-

import os
import random
import string
import time
import shutil
from pathlib import Path

class FileStructureGenerator:
    """用于生成复杂文件目录结构和测试文件的类"""
    
    def __init__(self, base_dir="test_files"):
        """初始化，设置基础目录"""
        self.base_dir = Path(base_dir)
        self.ensure_base_dir()
    
    def ensure_base_dir(self):
        """确保基础目录存在"""
        if self.base_dir.exists():
            print(f"基础目录 {self.base_dir} 已存在")
        else:
            self.base_dir.mkdir(parents=True)
            print(f"创建基础目录 {self.base_dir}")
    
    def generate_random_name(self, length=8):
        """生成随机文件或目录名"""
        return ''.join(random.choice(string.ascii_letters + string.digits) for _ in range(length))
    
    def create_empty_file(self, file_path):
        """创建空文件"""
        with open(file_path, 'w') as f:
            pass
        print(f"创建文件: {file_path}")
    
    def create_random_content_file(self, file_path, size_kb=1):
        """创建包含随机内容的文件"""
        with open(file_path, 'w') as f:
            content = ''.join(random.choice(string.ascii_letters + string.digits + ' \n') 
                             for _ in range(size_kb * 1024))
            f.write(content)
        print(f"创建随机内容文件: {file_path} ({size_kb}KB)")
    
    def create_directory_structure(self, depth=3, max_files=5, max_dirs=3, current_depth=0, parent_dir=None):
        """递归创建目录结构"""
        if current_depth > depth:
            return
        
        if parent_dir is None:
            parent_dir = self.base_dir
        
        # 创建随机数量的文件
        num_files = random.randint(1, max_files)
        for _ in range(num_files):
            file_name = self.generate_random_name() + '.txt'
            file_path = parent_dir / file_name
            
            # 随机决定是创建空文件还是有内容的文件
            if random.choice([True, False]):
                self.create_empty_file(file_path)
            else:
                size = random.randint(1, 5)  # 1-5KB
                self.create_random_content_file(file_path, size)
        
        # 如果未达到最大深度，创建子目录
        if current_depth < depth:
            num_dirs = random.randint(1, max_dirs)
            for _ in range(num_dirs):
                dir_name = self.generate_random_name()
                dir_path = parent_dir / dir_name
                dir_path.mkdir(exist_ok=True)
                print(f"创建目录: {dir_path}")
                
                # 递归创建子目录结构
                self.create_directory_structure(
                    depth=depth,
                    max_files=max_files,
                    max_dirs=max_dirs,
                    current_depth=current_depth + 1,
                    parent_dir=dir_path
                )
    
    def generate_file_index(self):
        """生成文件索引"""
        index = []
        
        for root, dirs, files in os.walk(self.base_dir):
            rel_path = os.path.relpath(root, start=os.path.dirname(self.base_dir))
            
            # 添加目录信息
            if root != self.base_dir:
                index.append({
                    'type': 'directory',
                    'path': rel_path,
                    'name': os.path.basename(root)
                })
            
            # 添加文件信息
            for file in files:
                file_path = os.path.join(root, file)
                size = os.path.getsize(file_path)
                
                index.append({
                    'type': 'file',
                    'path': os.path.join(rel_path, file),
                    'name': file,
                    'size': size,
                    'last_modified': os.path.getmtime(file_path)
                })
        
        return index
    
    def print_file_structure(self):
        """打印文件结构"""
        def print_tree(directory, prefix=""):
            paths = sorted(directory.iterdir(), key=lambda p: (p.is_file(), p.name))
            
            for i, path in enumerate(paths):
                is_last = i == len(paths) - 1
                print(f"{prefix}{'└── ' if is_last else '├── '}{path.name}")
                
                if path.is_dir():
                    extension = "    " if is_last else "│   "
                    print_tree(path, prefix + extension)
        
        print(f"\n文件结构 {self.base_dir}:")
        print_tree(self.base_dir)
    
    def make_random_changes(self, num_changes=3):
        """随机对文件结构进行修改"""
        changes = []
        
        for _ in range(num_changes):
            operation = random.choice(['add_file', 'add_dir', 'delete', 'modify'])
            
            # 获取所有目录路径
            all_dirs = [p for p in self.base_dir.glob('**/*') if p.is_dir()]
            if not all_dirs:
                all_dirs = [self.base_dir]
            
            # 获取所有文件路径
            all_files = [p for p in self.base_dir.glob('**/*') if p.is_file()]
            
            if operation == 'add_file':
                # 添加新文件
                if all_dirs:
                    target_dir = random.choice(all_dirs)
                    file_name = self.generate_random_name() + '.txt'
                    file_path = target_dir / file_name
                    
                    if random.choice([True, False]):
                        self.create_empty_file(file_path)
                    else:
                        size = random.randint(1, 5)
                        self.create_random_content_file(file_path, size)
                    
                    changes.append(f"添加文件: {file_path}")
            
            elif operation == 'add_dir':
                # 添加新目录
                if all_dirs:
                    target_dir = random.choice(all_dirs)
                    dir_name = self.generate_random_name()
                    dir_path = target_dir / dir_name
                    dir_path.mkdir(exist_ok=True)
                    changes.append(f"添加目录: {dir_path}")
            
            elif operation == 'delete':
                # 删除文件或目录
                if all_files and all_dirs and random.choice([True, False]):
                    # 删除文件
                    target_file = random.choice(all_files)
                    target_file.unlink()
                    changes.append(f"删除文件: {target_file}")
                elif all_dirs and len(all_dirs) > 1:
                    # 删除目录，但确保至少保留基础目录
                    non_base_dirs = [d for d in all_dirs if d != self.base_dir]
                    if non_base_dirs:
                        target_dir = random.choice(non_base_dirs)
                        shutil.rmtree(target_dir)
                        changes.append(f"删除目录: {target_dir}")
            
            elif operation == 'modify' and all_files:
                # 修改文件
                target_file = random.choice(all_files)
                size = random.randint(1, 5)
                self.create_random_content_file(target_file, size)
                changes.append(f"修改文件: {target_file}")
        
        return changes

def main():
    """主函数：创建测试文件结构并监视变化"""
    # 清理之前的测试文件
    test_dir = Path("test_files")
    if test_dir.exists():
        shutil.rmtree(test_dir)
        print(f"已清理旧的测试目录: {test_dir}")
    
    # 创建生成器实例
    generator = FileStructureGenerator(base_dir="test_files")
    
    # 生成初始文件结构
    print("\n=== 生成初始文件结构 ===")
    generator.create_directory_structure(depth=4, max_files=8, max_dirs=3)
    
    # 打印文件结构
    generator.print_file_structure()
    
    # 生成并打印文件索引
    initial_index = generator.generate_file_index()
    print(f"\n初始文件索引包含 {len(initial_index)} 个条目")
    
    # 模拟每隔一段时间进行文件变更
    cycles = 5
    for i in range(cycles):
        print(f"\n=== 周期 {i+1}/{cycles} ===")
        # 等待一段时间
        time.sleep(2)
        
        # 进行随机变更
        changes = generator.make_random_changes(num_changes=random.randint(2, 5))
        print("变更:")
        for change in changes:
            print(f"- {change}")
        
        # 更新并打印文件索引
        new_index = generator.generate_file_index()
        print(f"更新后的文件索引包含 {len(new_index)} 个条目")
        
        # 打印更新后的文件结构
        generator.print_file_structure()

if __name__ == "__main__":
    main() 