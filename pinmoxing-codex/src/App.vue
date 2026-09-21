<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue';
import { createEyeGame } from './game/createEyeGame';

let dispose: (() => void) | undefined;
onMounted(() => {
	dispose = createEyeGame('game');
});
onBeforeUnmount(() => dispose?.());
</script>

<template>
	<main>
		<div id="game" aria-label="眼球拆解大作战科普游戏"></div>
		<p class="rotate">请使用竖屏进行眼球拼装</p>
	</main>
</template>
