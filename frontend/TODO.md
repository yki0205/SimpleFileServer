# ISSUE


## 1 

~在selection状态时允许navigate可能会导致预想不到的错误，应该禁止在selection状态时navigate，或者在navigate时自动取消selection状态~（已修改，待测试）

## 2

~NavigatePreview中似乎存在更新卡顿的情况，需Check~（已修改，待测试）

## 3

在PDFPreview中，若焦点被iframe获取，则无法响应键盘事件，需Check

# 4

~Maximum update depth exceeded. This can happen when a component calls setState inside useEffect, but useEffect either doesn't have a dependency array, or one of the dependencies changes on every render.~（已修改，待测试）

# 5

加载协调问题：

1. fetchData到accmulatedFiles的间隔
2. imageOnlyMode启用时的闪烁

# TODO

- ~全局的右键菜单~（不再需要，放弃实现）