<template>
	<div class="page result">
		<div class="card">
			<h2 class="result-title">
				<img :src="smileIconUrl" alt="" aria-hidden="true" />
				<span>全部通关！</span>
			</h2>
			<canvas ref="cert" class="cert"></canvas>
			<div class="actions">
				<van-button type="primary" block @click="save">保存评分图片</van-button>
				<van-button plain type="default" block @click="again">再玩一次</van-button>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { Button as VanButton } from 'vant';
import { SCENES } from '../game/scenes';
import { useGameStore, TOTAL_LEVELS } from '../store/game';
import smileIconUrl from '../assets/smile.png';

const router = useRouter();
const store = useGameStore();
const cert = ref<HTMLCanvasElement | null>(null);
const totalLevels = TOTAL_LEVELS;
const avg = store.totalScore;

function txt(
	ctx: CanvasRenderingContext2D,
	str: string,
	x: number,
	y: number,
	size: number,
	color: string,
	align: CanvasTextAlign = 'center'
) {
	ctx.fillStyle = color;
	ctx.font = `bold ${size}px "PingFang SC","Microsoft YaHei",sans-serif`;
	ctx.textAlign = align;
	ctx.textBaseline = 'middle';
	ctx.fillText(str, x, y);
}
function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
	const radius = Math.min(r, h / 2, w / 2);

	ctx.beginPath();

	ctx.moveTo(x + radius, y);

	ctx.arcTo(x + w, y, x + w, y + h, radius);
	ctx.arcTo(x + w, y + h, x, y + h, radius);
	ctx.arcTo(x, y + h, x, y, radius);
	ctx.arcTo(x, y, x + w, y, radius);

	ctx.closePath();
}

function drawCertificate(ctx: CanvasRenderingContext2D) {
	const g = ctx.createLinearGradient(0, 0, 0, 840);
	g.addColorStop(0, '#eaf6ff');
	g.addColorStop(1, '#fff7e6');
	ctx.fillStyle = g;
	ctx.fillRect(0, 0, 600, 840);

	txt(ctx, '用眼习惯健康评分', 300, 90, 34, '#2c3e50');
	txt(ctx, 'EYE-CARE HEALTH REPORT', 300, 126, 14, '#8a9bb0');

	const color = avg >= 80 ? '#2ecc71' : avg >= 60 ? '#f39c12' : '#e74c3c';
	ctx.fillStyle = color;
	ctx.beginPath();
	ctx.arc(300, 250, 96, 0, Math.PI * 2);
	ctx.fill();
	ctx.strokeStyle = '#fff';
	ctx.lineWidth = 6;
	ctx.beginPath();
	ctx.arc(300, 250, 96, 0, Math.PI * 2);
	ctx.stroke();
	txt(ctx, String(avg), 300, 244, 64, '#fff');
	txt(ctx, '分', 300, 300, 20, '#fff');

	const rating = avg >= 80 ? '护眼达人' : avg >= 60 ? '还需努力' : '急需改善';
	txt(ctx, '评级：' + rating, 300, 380, 22, '#2c3e50');

	txt(ctx, '各场景表现', 300, 430, 18, '#2c3e50');
	SCENES.forEach((s, i) => {
		const y = 470 + i * 56;
		ctx.fillStyle = '#f1f5fb';
		rr(ctx, 60, y, 480, 44, 10);
		ctx.fill();
		txt(ctx, `${i + 1}. ${s.name}`, 80, y + 22, 17, '#34495e', 'left');
		const sc = store.scores[i] != null ? store.scores[i] : 0;
		ctx.fillStyle = '#e3e9f2';
		rr(ctx, 350, y + 10, 160, 24, 12);
		ctx.fill();
		ctx.fillStyle = sc >= 80 ? '#2ecc71' : sc >= 60 ? '#f39c12' : '#e74c3c';
		rr(ctx, 350, y + 10, (160 * sc) / 100, 24, 12);
		ctx.fill();
		txt(ctx, String(sc), 528, y + 22, 15, '#34495e', 'right');
	});

	const advice =
		avg >= 80
			? '你的用眼习惯很棒，继续保持！'
			: avg >= 60
				? '整体不错，注意薄弱环节多加练习。'
				: '用眼习惯风险较高，建议从姿势、光线、时长逐项改善。';
	txt(ctx, advice, 300, 770, 16, '#555');
	txt(ctx, '生成日期：' + new Date().toLocaleDateString('zh-CN'), 300, 800, 13, '#9aa6b5');
}

onMounted(() => {
	if (cert.value) {
		cert.value.width = 600;
		cert.value.height = 840;
		drawCertificate(cert.value.getContext('2d')!);
	}
});

function save() {
	if (!cert.value) return;
	const a = document.createElement('a');
	a.download = '用眼习惯健康评分.png';
	a.href = cert.value.toDataURL('image/png');
	a.click();
}

function again() {
	store.startNewGame();
	router.push('/');
}
</script>

<style scoped>
.result {
	display: flex;
	align-items: center;
	justify-content: center;
	min-height: 100%;
}
.card {
	background: var(--card);
	border-radius: 20px;
	padding: 22px 18px;
	box-shadow: 0 12px 40px rgba(60, 90, 160, 0.12);
	text-align: center;
	width: 100%;
	max-width: 420px;
}
h2 {
	font-size: 22px;
	margin-bottom: 12px;
}
.result-title {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	gap: 8px;
}
.result-title img {
	display: block;
	width: 28px;
	height: 28px;
	object-fit: contain;
}
.cert {
	width: 100%;
	max-width: 320px;
	border-radius: 12px;
	box-shadow: 0 8px 24px rgba(60, 90, 160, 0.18);
	margin: 4px auto 12px;
}
.actions {
	display: flex;
	flex-direction: column;
	gap: 10px;
}
</style>
