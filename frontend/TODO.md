# ISSUE


## 1 

在selection状态时允许navigate可能会导致预想不到的错误，应该禁止在selection状态时navigate，或者在navigate时自动取消selection状态

## 2

NavigatePreview中似乎存在更新卡顿的情况，需Check

## 3

在PDFPreview中，若焦点被iframe获取，则无法响应键盘事件，需Check

# 4

ImageOnly模式下，会出现：

Maximum update depth exceeded. This can happen when a component calls setState inside useEffect, but useEffect either doesn't have a dependency array, or one of the dependencies changes on every render.

# TODO

- 全局的右键菜单
- 实现rename
- 实现mkdir
- 实现rmdir（出于安全考虑，我将删除文件夹作为一个单独的api从delete中提取）