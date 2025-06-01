# ISSUE

- 在selection状态时允许navigate可能会导致预想不到的错误，应该禁止在selection状态时navigate，或者在navigate时自动取消selection状态
- NavigatePreview中似乎存在更新卡顿的情况，需Check

# TODO

- 实现clone和move
- 实现rename
- 实现mkdir
- 实现rmdir（处于安全考虑，我将删除文件夹作为一个单独的api从delete中提取）
