<template>
	<div class="page home">
		<div class="card">
			<div class="logo">👀</div>
			<h1>大家来找茬<span>· 护眼版</span></h1>
			<p class="sub">5 个用眼场景，每关限时 60 秒，<br />找出全部差异即可通关！</p>

			<ul class="rule">
				<!-- <li>✍ 读写姿势</li>
				<li>💡 光线环境</li>
				<li>⏱️ 用眼时长</li>
				<li>🖥️ 屏幕距离</li>
				<li>🌳 户外活动</li> -->
			</ul>

			<van-cell-group inset v-if="store.best > 0" class="best">
				<van-cell title="历史最佳评分" :value="store.best + ' 分'" />
				<van-cell title="已通关进度" :value="store.reached + ' / 5 关'" />
			</van-cell-group>

			<van-button type="primary" block round size="large" @click="start">开始游戏</van-button>
			<!-- <p class="hint-note">提示：</p> -->
		</div>
	</div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router';
import { Button as VanButton, Cell as VanCell, CellGroup as VanCellGroup } from 'vant';
import { useGameStore } from '../store/game';

const router = useRouter();
const store = useGameStore();

function start() {
	store.startNewGame();
	router.push('/game');
}
</script>

<style scoped>
.home {
	display: flex;
	align-items: center;
	justify-content: center;
	min-height: 100%;
}
.card {
	background: var(--card);
	border-radius: 20px;
	padding: 26px 20px;
	box-shadow: 0 12px 40px rgba(60, 90, 160, 0.12);
	text-align: center;
	width: 100%;
	max-width: 420px;
}
.logo {
	font-size: 56px;
}
h1 {
	font-size: 26px;
	margin: 8px 0;
}
h1 span {
	color: var(--blue);
	font-size: 18px;
}
.sub {
	color: var(--muted);
	font-size: 14px;
	line-height: 1.7;
	margin: 10px 0 16px;
}
.rule {
	list-style: none;
	display: grid;
	grid-template-columns: 1fr 1fr;
	gap: 8px;
	margin: 12px 0 20px;
}
.rule li {
	background: #f1f5fb;
	border-radius: 12px;
	padding: 10px;
	font-size: 14px;
}
.best {
	margin-bottom: 16px;
	text-align: left;
}
.hint-note {
	font-size: 12px;
	color: var(--muted);
	margin-top: 14px;
}
</style>
