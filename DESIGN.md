# DESIGN.md

## 1. 作业目标与本次实现范围

本次 Homework 1.1 的核心目标是：

1. 改进 HW1 的 `Sudoku` / `Game` 领域对象设计。
2. 将领域对象**真实接入**现有 Svelte 3 游戏流程，而不是只在测试中使用。

本实现采用了作业要求推荐的 **方案 A：Store Adapter**。  
即：在 Svelte store 层建立领域对象适配层，统一承接 UI 输入并驱动响应式状态更新。

---

## 2. 领域对象设计

### 2.1 `Sudoku` 的职责

`src/domain/index.js` 中的 `Sudoku` 负责：

- 持有盘面数据 `grid` 与题面 `initialGrid`
- 处理落子 `guess(move)`
- 规则校验 `isValidMove(row, col, value)`
- 克隆 `clone()`
- 序列化/反序列化相关数据支持（`toJSON()` + `createSudokuFromJSON`）
- 外表化 `toString()`（便于调试）

### 2.2 `Game` 的职责

`src/domain/index.js` 中的 `Game` 负责：

- 持有当前 `Sudoku`
- 管理 `undoStack` / `redoStack`
- 提供 `guess/undo/redo/canUndo/canRedo`
- 提供 `toJSON()` 供游戏态序列化

### 2.3 `Move` 的定位

`move = { row, col, value }` 作为轻量值对象使用。  
在历史中扩展为 `{ row, col, oldValue, newValue }`，用于撤销/重做。

---

## 3. View 如何消费领域对象（重点）

### 3.1 采用的适配层

适配层位于：

- `src/node_modules/@sudoku/stores/grid.js`

其中 `createGrid()` 内部维护 `currentGame`（领域层 `Game` 实例），并对 UI 暴露：

- 响应式状态：
  - `grid`（题面）
  - `userGrid`（当前可视盘面）
  - `invalidCells`（冲突格）
  - `canUndo` / `canRedo`
- 响应式命令：
  - `userGrid.set(pos, value)`
  - `userGrid.undo()`
  - `userGrid.redo()`
  - `userGrid.applyHint(pos)`

> 命名说明：作业中 `createGameStore(...)` / `createSudokuStore(...)` 为示例命名，并非强制命名。  
> 本实现使用 `createGrid()` 承载 adapter 职责，语义等价且已满足“View 真正消费领域对象”的要求。

### 3.2 UI 数据来源

- `Board/index.svelte` 渲染 `$userGrid`，不直接改二维数组。
- `Keyboard.svelte` 输入时调用 `userGrid.set(...)`。
- `ActionBar/Actions.svelte` 的 Undo/Redo 按钮调用 `userGrid.undo/redo`。

即：UI 层只负责“读 store + 发命令”，核心行为在领域层/适配层。

---

## 4. 关键交互链路

### 4.1 开局

- `game.startNew()` / `game.startCustom()` 最终触发 `grid.generate()` / `grid.decodeSencode()`
- 适配层内部 `bootstrapGame(puzzleGrid)`：
  1. `currentGame = createGame({ sudoku: createSudoku(puzzleGrid) })`
  2. 更新 `grid`（题面）
  3. `syncFromDomain()` 同步 `userGrid`、`canUndo`、`canRedo`

### 4.2 用户输入

- `Keyboard` -> `userGrid.set(pos, value)`
- 适配层调用 `currentGame.guess(...)`
- 成功后 `syncFromDomain()` 推送到 Svelte store
- 组件通过 `$store` 自动刷新 UI

### 4.3 Undo / Redo

- `Actions` -> `userGrid.undo()` / `userGrid.redo()`
- 适配层调用 `Game.undo/redo`
- 再次 `syncFromDomain()`
- 按钮禁用状态由 `$canUndo/$canRedo` 自动联动

---

## 5. 为什么 Svelte 会更新（响应式机制说明）

本实现依赖的是 **Svelte 3 store 的 `set/subscribe` 机制**：

1. 领域对象变化后，不直接让组件读对象内部字段。
2. 统一由适配层调用 `userGrid.set(...)`、`canUndo.set(...)`、`canRedo.set(...)`。
3. 组件中 `$userGrid/$canUndo/$canRedo` 自动触发重渲染。

### 5.1 响应式边界

- 领域层内部状态（`Game`、`Sudoku` 实例、历史栈）对 UI 不直接可见。
- UI 只消费 adapter 暴露的 store 快照。

### 5.2 若直接 mutate 的风险

如果组件直接改二维数组元素、或直接改领域对象内部字段：

- 可能不会触发 Svelte 订阅更新（尤其是引用不变时）
- 业务规则容易分散到组件，破坏职责边界
- Undo/Redo 时间线难以保证一致性

---

## 6. 深拷贝/浅拷贝与历史策略

### 6.1 当前历史策略

`Game` 使用命令历史（move log）：

- `undoStack` / `redoStack` 保存 `{ row, col, oldValue, newValue }`
- 优点：内存开销低、意图清晰
- 代价：需要保证回放语义正确

### 6.2 拷贝策略

- `Sudoku` 构造与 `getGrid()` 使用深拷贝
- `clone()` 返回新 `Sudoku`，避免共享嵌套数组
- `toJSON()` 输出纯数据对象，避免泄漏实例引用

---

## 7. 相比 HW1 的改进

1. **从“仅测试可用”升级为“真实 UI 可消费”**：
   - 关键输入、撤销、重做已接入领域对象。
2. **建立了明确的 adapter 边界**：
   - 组件不再承载核心业务规则。
3. **状态联动更清晰**：
   - `canUndo/canRedo` 与按钮禁用联动。

### 7.1 为什么 HW1 做法不足

HW1 仅保证领域 API 测试通过，但如果 UI 仍直接操作旧 store/数组：

- 会出现“领域对象存在但没有真正驱动产品行为”的问题。

### 7.2 trade-off

- 优点：分层清晰、可测试性高、便于后续迁移。
- 代价：需要维护一层 adapter，同步逻辑略增。

---

## 8. 测试与验证

### 8.1 静态/单元测试

已通过：

- `tests/hw1/01-contract.test.js`
- `tests/hw1/02-sudoku-basic.test.js`
- `tests/hw1/03-clone.test.js`
- `tests/hw1/04-game-undo-redo.test.js`
- `tests/hw1/05-serialization.test.js`

### 8.2 运行时验证

已使用 `npm run dev` 成功启动开发环境，并完成一整局手工游玩验证，重点覆盖：

- 开局与渲染
- 输入联动
- Undo/Redo 行为与禁用状态
- 冲突高亮联动

> 注：本仓库生产构建链路存在历史依赖兼容问题（非本次作业核心评分点），不影响 HW1.1 的领域接入与运行时行为验证。

---


## 9. 与作业要求逐项对照（便于助教快速核查）

1. **是否存在领域对象并改进（`Sudoku`/`Game`）**：是 ✅
2. **是否真实接入 Svelte 流程（开局/渲染/输入/Undo/Redo）**：是 ✅
3. **是否采用可被 `$store` 消费的响应式暴露**：是 ✅
4. **是否将关键逻辑从组件中收敛到领域层+适配层**：是 ✅
5. **响应式状态覆盖（要求示例）**：
   - `grid`：已提供 ✅
   - `invalidCells`：已提供 ✅
   - `won`：由 `@sudoku/stores/game` 的 `gameWon` 提供 ✅
   - `selectedCell`：由 `cursor` store 等价提供 ✅
6. **响应式命令覆盖（要求示例）**：
   - `guess`：通过 `userGrid.set(...)` 间接调用 `Game.guess` ✅
   - `undo`：`userGrid.undo()` -> `Game.undo` ✅
   - `redo`：`userGrid.redo()` -> `Game.redo` ✅
7. **是否完成文档解释（消费链路/响应式机制/改进与 trade-off）**：是 ✅
