import { createRouter, createWebHashHistory } from 'vue-router';
import Home from '../views/Home.vue';

const Game = () => import('../views/Game.vue');
const Result = () => import('../views/Result.vue');

const router = createRouter({
	history: createWebHashHistory(),
	routes: [
		{ path: '/', name: 'home', component: Home },
		{ path: '/game', name: 'game', component: Game },
		{ path: '/result', name: 'result', component: Result },
		{
			path: '/:pathMatch(.*)*',
			redirect: '/'
		}
	]
});

export default router;
