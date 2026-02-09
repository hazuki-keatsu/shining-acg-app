<script lang="ts">
	import { cn } from '$lib/utils';
	import { fade } from 'svelte/transition';
	import * as tus from 'tus-js-client';
	import { MediaUploadService } from '../../services/upload';

	export let onUploadComplete: (uploadUrl: string) => void;
	export let maxFileSizeMB = 2048; // 最大支持 2GB 视频
	// 增加对 HEIC, MOV, QuickTime 的支持
	export let acceptedTypes = 'image/*,video/*,image/heic,image/heif,video/quicktime';
	export let endpoint = '/files/'; // Tus 服务端点

	let dragOver = false;
	let uploadProgress = 0;
	let isUploading = false;
	let errorMessage = '';
	let uploadInstance: tus.Upload | null = null;
	let fileInput: HTMLInputElement;

	async function handleFiles(files: FileList | null) {
		if (!files || files.length === 0) return;

		const file = files[0]; // 暂时只处理单文件
		errorMessage = '';
		uploadProgress = 0;

		// 验证文件大小
		if (file.size > maxFileSizeMB * 1024 * 1024) {
			errorMessage = `文件大小超过限制: ${maxFileSizeMB}MB`;
			return;
		}

		try {
			isUploading = true;
			let fileToUpload = file;

			// 处理图片 (压缩, 去除 EXIF, HDR转SDR)
			// 注意：HEIC/Live Photo 静态部分会在此处被处理为 JPEG
			if (
				MediaUploadService.isImage(file) ||
				file.type === 'image/heic' ||
				file.type === 'image/heif'
			) {
				console.log('正在处理图片...');
				fileToUpload = await MediaUploadService.processImage(file, {
					maxSizeMB: 2,
					maxWidthOrHeight: 2560
				});
			}

			// 开始上传
			uploadInstance = MediaUploadService.uploadFile(fileToUpload, {
				endpoint,
				onProgress: (bytesUploaded, bytesTotal) => {
					uploadProgress = (bytesUploaded / bytesTotal) * 100;
				},
				onSuccess: () => {
					isUploading = false;
					if (uploadInstance && uploadInstance.url) {
						onUploadComplete(uploadInstance.url);
					}
				},
				onError: (error) => {
					isUploading = false;
					errorMessage = error.message;
				},
				metadata: {
					originalName: file.name,
					mimeType: file.type
				}
			});
		} catch (err) {
			isUploading = false;
			errorMessage = (err as Error).message;
		}
	}

	function handleDrop(e: DragEvent) {
		e.preventDefault();
		dragOver = false;
		handleFiles(e.dataTransfer?.files || null);
	}

	function handleDragOver(e: DragEvent) {
		e.preventDefault();
		dragOver = true;
	}

	function handleDragLeave(e: DragEvent) {
		e.preventDefault();
		dragOver = false;
	}
</script>

<div
	class={cn(
		'relative flex min-h-[200px] w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed transition-colors',
		dragOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50',
		isUploading ? 'pointer-events-none opacity-80' : ''
	)}
	on:drop={handleDrop}
	on:dragover={handleDragOver}
	on:dragleave={handleDragLeave}
	on:click={() => fileInput.click()}
	role="button"
	tabindex="0"
	on:keydown={(e) => e.key === 'Enter' && fileInput.click()}
>
	<input
		type="file"
		accept={acceptedTypes}
		class="hidden"
		bind:this={fileInput}
		on:change={(e) => handleFiles(e.currentTarget.files)}
	/>

	{#if isUploading}
		<div class="flex w-full flex-col items-center gap-2 px-8" transition:fade>
			<div class="h-2 w-full overflow-hidden rounded-full bg-secondary">
				<div
					class="h-full bg-primary transition-all duration-300"
					style="width: {uploadProgress}%"
				></div>
			</div>
			<span class="text-sm text-muted-foreground">正在上传... {Math.round(uploadProgress)}%</span>
		</div>
	{:else}
		<div class="flex flex-col items-center gap-2 text-center" transition:fade>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width="48"
				height="48"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
				class="text-muted-foreground"
			>
				<path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" />
				<path d="M12 12v9" />
				<path d="m16 16-4-4-4 4" />
			</svg>
			<p class="text-lg font-medium text-foreground">点击或拖拽文件上传</p>
			<p class="text-sm text-muted-foreground">
				支持 JPEG, PNG, HEIC, MP4 (最大 {maxFileSizeMB}MB)
			</p>
		</div>
	{/if}

	{#if errorMessage}
		<p class="absolute bottom-2 text-sm font-medium text-destructive">{errorMessage}</p>
	{/if}
</div>
