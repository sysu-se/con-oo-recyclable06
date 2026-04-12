import { cloneDeep } from 'lodash'
import { BOX_SIZE, SUDOKU_SIZE } from '../node_modules/@sudoku/constants.js';

/**
 * 数独盘面
 */
class Sudoku {
    /**
     * 初始化数独盘面
     * @param {number[][]} grid 9x9 的二维数字数组 数组元素为0~9
     */
    constructor(grid,initialGrid = null){
        if (!Array.isArray(grid) || grid.length !== SUDOKU_SIZE || !Array.isArray(grid[0]) || grid[0].length !== SUDOKU_SIZE) {
            throw new Error("Invalid Sudoku grid dimensions");
        }
        this.grid=cloneDeep(grid);
        this.initialGrid = initialGrid ? cloneDeep(initialGrid) : cloneDeep(grid);
    }

    /**
     * 获取当前数独盘面的数据
     * @returns {number[][]} 数据的深拷贝
     */
    getGrid(){
        return cloneDeep(this.grid);
    }

    /**
     * 执行落子操作
     * @param {Object} move 动作对象
     */
    guess(move){
        const { row, col, value } = move;

        // 1. 基础边界校验
        if (row < 0 || row > 8 || col < 0 || col > 8) return false;
        if (value < 0 || value > 9) return false; 

        // 2. 修复 Issue 2: 题面保护，不可修改初始固定的数字
        if (this.initialGrid[row][col] !== 0) return false;

        // 3. 修复 Issue 2: 领域规则校验，非法局面直接拒绝写入
        if (!this.isValidMove(row, col, value)) return false;

        // 4. 如果值没有发生实质变化，视为无效操作
        if (this.grid[row][col] === value) return false;

        this.grid[row][col] = value;
        return true; // 执行成功
    }

    /**
     * 判断落子操作是否符合数独规则
     * @param {number} row 行坐标 (0-8)
     * @param {number} col 列坐标 (0-8)
     * @param {number} value 填入的数字 (1-9，0为空)
     */
    isValidMove(row, col, value) {
        if (value === 0) return true; // 0 (擦除) 永远合法

        // 修复 Issue 5: 使用 === 严格相等
        for (let i = 0; i < 9; i++) {
            if (i !== col && this.grid[row][i] === value) return false;
            if (i !== row && this.grid[i][col] === value) return false;
        }

        let startRow=Math.floor(row/3)*3;
        let startCol=Math.floor(col/3)*3;
        
        for (let i = 0; i < 3; i++) {
            for (let j = 0; j < 3; j++) {
                let r = startRow + i;
                let c = startCol + j;
                if (r !== row && c !== col && this.grid[r][c] === value) {
                    return false;
                }
            }
        }
        return true;
    }

    /**
     * 克隆当前的数独盘面
     * @returns {Sudoku} 一个深拷贝的新 Sudoku 实例
     */
    clone(){
        return new Sudoku(cloneDeep(this.grid),cloneDeep(this.initialGrid));
    }

    /**
     * 序列化接口
     * @returns {Object} 纯数据对象
     */
    toJSON(){
        return { 
            grid: this.getGrid(),
            initialGrid: cloneDeep(this.initialGrid)
        };
    }

    /**
     * 可读的外表化（复用）
     * @returns {string} 格式化的字符串
     */
    toString() {
        let out = '╔═══════╤═══════╤═══════╗\n';

        for (let row = 0; row < SUDOKU_SIZE; row++) {
            if (row !== 0 && row % BOX_SIZE === 0) {
                out += '╟───────┼───────┼───────╢\n';
            }

            for (let col = 0; col < SUDOKU_SIZE; col++) {
                if (col === 0) {
                    out += '║ ';
                } else if (col % BOX_SIZE === 0) {
                    out += '│ ';
                }

                out += (this.grid[row][col] === 0 ? '·' : this.grid[row][col]) + ' ';

                if (col === SUDOKU_SIZE - 1) {
                    out += '║';
                }
            }

            out += '\n';
        }

        out += '╚═══════╧═══════╧═══════╝';

        return out;
    }
}


/**
 * 游戏管理器
 */
class Game {
    /**
     * 初始化游戏会话
     * @param {Sudoku} sudokuInitial 初始数独
     * @param {Object[]} [undoStack=[]] 撤销栈
     * @param {Object[]} [redoStack=[]] 重做栈
     * @param {string} [history_mode="Command"] 历史记录模式标识
     */
    constructor(sudokuInitial, undoStackInitial = [], redoStackInitial = []) {
        this.cur_sudoku = sudokuInitial.clone();
        this.undoStack = cloneDeep(undoStackInitial);
        this.redoStack = cloneDeep(redoStackInitial);
    }


    /**
     * 获取当前游戏的数独实例
     * @returns {Sudoku} 当前盘面
     */
    getSudoku(){ 
        return this.cur_sudoku.clone(); 
    }

    /**
     * 执行落子并记录
     * @param {Object} move 动作对象
     */
    guess(move){ 
        const oldValue = this.cur_sudoku.getGrid()[move.row][move.col];
        
        // 修复 Issue 1: 必须先尝试让领域对象落子。
        // 只有在 Sudoku 确认落子合法且成功执行后，才将其压入历史栈！
        const success = this.cur_sudoku.guess(move);
        
        if (success) {
            this.undoStack.push({
                row: move.row,
                col: move.col,
                oldValue: oldValue,
                newValue: move.value
            });
            // 发生新的有效动作，清空重做时间线
            this.redoStack = [];
        }
    }

    /**
     * 撤销上一步操作
     */
    undo(){
        if (!this.canUndo()) return;
        let lastMove = this.undoStack.pop();
        // 执行反向操作
        this.cur_sudoku.guess({row:lastMove.row,col:lastMove.col,value:lastMove.oldValue})
        this.redoStack.push(lastMove);
    }
    

    /**
     * 重做被撤销操作
     */
    redo(){
        if (!this.canRedo()) return;
        let nextMove = this.redoStack.pop();
        // 执行正向操作
        this.cur_sudoku.guess({row:nextMove.row,col:nextMove.col,value:nextMove.newValue})
        this.undoStack.push(nextMove);
        
    }

    /**
     * 检查是否可以撤销
     * @return {boolean}
     */
    canUndo(){ 
        return this.undoStack.length>0; 
    }

    /**
     * 检查是否可以重做
     * @returns {boolean}
     */
    canRedo(){ 
        return this.redoStack.length>0; 
    }

    /**
     * 序列化整个游戏状态
     * @returns {Object} 
     */
    toJSON(){ 
        return {
            cur_sudoku: this.cur_sudoku.toJSON(),
            undoStack: this.undoStack.map(m => ({...m})),
            redoStack: this.redoStack.map(m => ({...m}))
        };
    }
}

// ====== 统一评分接口导出 ======



/**
 * 创建一个新的 Sudoku 实例
 * @param {number[][]} input 9x9 的二维数组 数组元素为0~9
 * @returns {Sudoku}
 */
export function createSudoku(input){
    return new Sudoku(input);
}


/**
 * 从 JSON 数据中恢复 Sudoku 实例
 * @param {Object} json 纯数据对象
 * @returns {Sudoku}
 */
export function createSudokuFromJSON(json){
    // 支持恢复 initialGrid，保障反序列化后题面约束不丢失
    return new Sudoku(json.grid, json.initialGrid);
}


/**
 * 创建一个新的 Game 实例
 * @param {Object} params 配置参数
 * @param {Sudoku} params.sudoku Sudoku 实例
 * @returns {Game}
 */
export function createGame({ sudoku }){
    return new Game(sudoku);
}



/**
 * 从 JSON 数据中恢复 Game 状态
 * @param {Object} json 序列化的游戏状态对象
 * @returns {Game}  Game 实例
 */
export function createGameFromJSON(json) {
    let sudokuInitial = createSudokuFromJSON(json.cur_sudoku);
    let undoStack = json.undoStack.map(m => ({...m}));
    let redoStack = json.redoStack.map(m => ({...m}));

    return new Game(sudokuInitial, undoStack, redoStack);
}