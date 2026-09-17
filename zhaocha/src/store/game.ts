import { defineStore } from 'pinia';

const TOTAL = 5;

interface GameState {
	scores: number[];
	reached: number;
	best: number;
}

export const useGameStore = defineStore('eye-game', {
	state: (): GameState => ({
		scores: [],
		reached: Number(localStorage.getItem('eyeGameReached') || 0),
		best: Number(localStorage.getItem('eyeGameBest') || 0)
	}),
	getters: {
		/** 当前总评分（各关平均分） */
		totalScore(state): number {
			if (!state.scores.length) return 0;
			const sum = state.scores.reduce((a, b) => a + (b || 0), 0);
			return Math.round(sum / TOTAL);
		},
		rating(state): string {
			const s = this.totalScore;
			if (s >= 80) return '护眼达人';
			if (s >= 60) return '还需努力';
			return '急需改善';
		}
	},
	actions: {
		/** 新开局：清空本局得分 */
		startNewGame() {
			this.scores = [];
		},
		/** 记录某关得分 */
		setScore(index: number, score: number) {
			this.scores[index] = score;
			if (index + 1 > this.reached) this.reached = index + 1;
			this.persist();
		},
		/** 全部通关 */
		finishAll() {
			this.reached = TOTAL;
			if (this.totalScore > this.best) {
				this.best = this.totalScore;
				localStorage.setItem('eyeGameBest', String(this.best));
			}
			this.persist();
		},
		persist() {
			localStorage.setItem('eyeGameReached', String(this.reached));
		}
	}
});

export const TOTAL_LEVELS = TOTAL;
