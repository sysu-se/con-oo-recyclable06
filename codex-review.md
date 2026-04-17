# con-oo-recyclable06 - Review

## Review 结论

当前代码已经把 `Game` / `Sudoku` 真正接进了 Svelte 的开局、输入、撤销/重做主流程，说明“领域对象不只存在于测试里”这一点基本达成；但从设计质量看，关键业务语义仍然分散在 store/UI 层，领域对象还没有成为完整的单一事实来源，因此整体更接近“已接入的领域封装”而不是成熟、闭合的 OOD 方案。

## 总体评价

| 维度 | 评价 |
| --- | --- |
| OOP | fair |
| JS Convention | fair |
| Sudoku Business | fair |
| OOD | fair |

## 缺点

### 1. 关键业务状态没有收敛到领域层

- 严重程度：core
- 位置：src/domain/index.js:32-79, src/node_modules/@sudoku/stores/grid.js:122-166, src/node_modules/@sudoku/stores/game.js:7-18
- 原因：`Sudoku` / `Game` 负责写入与部分规则校验，但“哪些格子冲突”“是否获胜”仍由 `invalidCells` 和 `gameWon` 在 store 层基于二维数组重新计算。这样领域对象并不是游戏状态的单一事实来源，业务规则被拆散在 domain 和 Svelte store 两处，后续规则调整时很容易出现两套逻辑漂移。

### 2. 领域规则与现有数独交互语义不一致

- 严重程度：major
- 位置：src/domain/index.js:39-49, src/components/Board/index.svelte:49-51, src/node_modules/@sudoku/stores/grid.js:122-166
- 原因：`Sudoku.guess` 会直接拒绝任何形成冲突的输入，而界面又保留了 `invalidCells` / `conflictingNumber` 的冲突高亮流程。按当前静态代码路径推断，正常用户输入几乎不会产生可高亮的冲突态，等于把原有“允许输入并标红”的 UI 语义改成了“非法输入静默丢弃”，业务反馈前后不一致。

### 3. Game API 丢失了命令结果

- 严重程度：major
- 位置：src/domain/index.js:167-184, src/node_modules/@sudoku/stores/grid.js:60-65
- 原因：`Sudoku.guess` 返回布尔值，但 `Game.guess` 没有继续返回这个结果，`userGrid.set` 也因此无法区分“成功修改”“重复输入”“非法输入”。这让适配层只能无条件同步快照，UI 无法基于领域结果提供明确反馈，也削弱了 `Game` 作为面向 UI 的操作入口。

### 4. 领域层反向依赖前端工程目录

- 严重程度：major
- 位置：src/domain/index.js:1-2
- 原因：`src/domain` 直接从 `../node_modules/@sudoku/constants.js` 读取常量，把领域模型绑定到了当前 Svelte starter 的目录结构上。对 OOD 来说这是层次泄漏；对 JS 生态惯例来说，这也让领域模块的可复用性和可迁移性变差。

### 5. Sudoku 构造器的输入校验不完整

- 严重程度：minor
- 位置：src/domain/index.js:12-18
- 原因：构造器只校验了 `grid.length` 和 `grid[0].length`，没有验证其余各行长度，也没有验证元素是否都是 0-9 的数字。对于领域对象入口，这会让部分非法盘面绕过防线进入系统。

### 6. 适配层读取 store 当前值的方式不符合 Svelte 惯例

- 严重程度：minor
- 位置：src/node_modules/@sudoku/stores/grid.js:82-86
- 原因：`applyHint` 为了拿到当前 `userGrid`，临时 `subscribe` 再立刻取消订阅。功能上能工作，但在 Svelte store 里这比直接使用同步读取工具更绕，也让适配层显得不够干净。

## 优点

### 1. 开局、输入、撤销、重做主流程都已走领域对象

- 位置：src/node_modules/@sudoku/stores/grid.js:47-50, src/node_modules/@sudoku/stores/grid.js:60-76, src/components/Controls/Keyboard.svelte:24, src/components/Controls/ActionBar/Actions.svelte:26-32
- 原因：`bootstrapGame` 会创建 `Game` / `Sudoku`，键盘输入通过 `currentGame.guess(...)`，Undo/Redo 通过 `currentGame.undo/redo()`；这说明领域对象已经进入真实 Svelte 流程，而不是只在测试中存在。

### 2. Sudoku 与 Game 的职责边界基本清晰

- 位置：src/domain/index.js:39-49, src/domain/index.js:167-206
- 原因：`Sudoku` 负责题面保护和落子合法性，`Game` 负责历史记录、撤销与重做，避免了把 Undo/Redo 等核心行为散落到组件事件处理中。

### 3. 响应式刷新链路明确

- 位置：src/node_modules/@sudoku/stores/grid.js:40-45, src/components/Board/index.svelte:40-51
- 原因：领域对象变化后统一通过 store `set` 同步到 `userGrid` / `canUndo` / `canRedo`，Board 组件只消费 `$store` 渲染，不直接修改二维数组，符合 Svelte 3 常见的 store 驱动 UI 模式。

### 4. 对象边界上提供了克隆与外表化能力

- 位置：src/domain/index.js:86-99, src/domain/index.js:230-287
- 原因：`clone`、`toJSON`、`createSudokuFromJSON`、`createGameFromJSON` 至少保证了领域状态可以以纯数据形式流出与恢复，降低了外部直接持有内部数组引用的风险。

## 补充说明

- 本次结论只基于静态阅读，没有运行测试，也没有启动 Svelte 应用；关于冲突高亮、胜利弹窗、hint 流程等实际界面表现，判断来自代码路径推断而非运行结果。
- 审查范围限制在 `src/domain/*` 及其直接相关的 Svelte 接入代码，主要包括 `src/node_modules/@sudoku/stores/grid.js`、`src/node_modules/@sudoku/stores/game.js`、`src/node_modules/@sudoku/game.js`、`src/App.svelte` 以及直接调用这些 store 的组件。
- 由于未实际运行，诸如“冲突高亮在正常输入路径上是否真的不可达”这一类结论，是依据 `Sudoku.guess` 的拒绝策略与 UI 代码的组合静态推断得出的。
