<script lang="ts">
	import { cn } from '$lib/utils';
	import Hls from 'hls.js';
	import { onDestroy, onMount } from 'svelte';

	export let src: string;
	export let poster: string = '';
	export let autoplay = false;
	export let controls = true;
	export let className: string = '';

	let videoElement: HTMLVideoElement;
	let hls: Hls | null = null;

	function initPlayer() {
		if (!videoElement) return;

		if (Hls.isSupported()) {
			if (hls) hls.destroy();

			hls = new Hls({
				enableWorker: true,
				lowLatencyMode: true
			});

			hls.loadSource(src);
			hls.attachMedia(videoElement);

			hls.on(Hls.Events.MANIFEST_PARSED, () => {
				if (autoplay) {
					videoElement.play().catch(console.error);
				}
			});

			hls.on(Hls.Events.ERROR, (_event, data) => {
				if (data.fatal) {
					switch (data.type) {
						case Hls.ErrorTypes.NETWORK_ERROR:
							hls?.startLoad();
							break;
						case Hls.ErrorTypes.MEDIA_ERROR:
							hls?.recoverMediaError();
							break;
						default:
							hls?.destroy();
							break;
					}
				}
			});
		} else if (videoElement.canPlayType('application/vnd.apple.mpegurl')) {
			// 原生支持 (iOS Safari)
			videoElement.src = src;
			if (autoplay) {
				videoElement.addEventListener('loadedmetadata', () => {
					videoElement.play().catch(console.error);
				});
			}
		}
	}

	onMount(() => {
		if (src) initPlayer();
	});

	onDestroy(() => {
		if (hls) hls.destroy();
	});

	// 监听 src 变化
	$: if (src && videoElement) {
		// 如果 hls 实例已存在，只需加载新源
		if (hls) {
			hls.loadSource(src);
		} else if (videoElement.canPlayType('application/vnd.apple.mpegurl')) {
			videoElement.src = src;
		} else {
			// 首次初始化
			initPlayer();
		}
	}
</script>

<div class={cn('relative aspect-video w-full overflow-hidden rounded-lg bg-black', className)}>
	<video
		bind:this={videoElement}
		{poster}
		{controls}
		class="h-full w-full object-contain"
		playsinline
	>
		<slot>您的浏览器不支持视频播放。</slot>
	</video>
</div>
