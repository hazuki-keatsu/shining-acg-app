import imageCompression from 'browser-image-compression';
import * as tus from 'tus-js-client';

export interface UploadConfig {
	endpoint: string; // Tus 服务器端点
	onProgress?: (bytesUploaded: number, bytesTotal: number) => void;
	onSuccess?: () => void;
	onError?: (error: Error) => void;
	metadata?: Record<string, string>;
	headers?: Record<string, string>;
}

export interface ProcessingOptions {
	maxSizeMB?: number;
	maxWidthOrHeight?: number;
	fileType?: string;
}

/**
 * 处理媒体上传的服务，支持 Tus 协议和客户端处理。
 */
export class MediaUploadService {
	/**
	 * 压缩并剥离图片文件的元数据。
	 * 使用 Canvas 方式，天然支持将 HDR 转换为 SDR (sRGB)
	 * 并剥离 EXIF 数据（位置、设备信息）以保护隐私。
	 *
	 * 注意：对于 iOS 的 HEIC/Live Photo，此过程会将其转换为 JPEG 静态图，
	 * 从而解决兼容性问题并去除敏感信息。
	 */
	static async processImage(file: File, options: ProcessingOptions = {}): Promise<File> {
		// 平衡质量和性能的默认选项
		const defaultOptions = {
			maxSizeMB: 1.5, // 适合 Web 浏览的大小
			maxWidthOrHeight: 2560, // 2K 分辨率限制
			useWebWorker: true, // 使用 Web Worker 提升性能
			fileType: 'image/jpeg', // 转换为 JPEG 以获得最广泛的兼容性
			initialQuality: 0.8,
			alwaysKeepResolution: true // 仅在需要缩减大小时才调整分辨率
		};

		const compressionOptions = { ...defaultOptions, ...options };

		try {
			const compressedFile = await imageCompression(file, compressionOptions);
			// 创建新文件，如果扩展名改变则更新文件名
			const newName = file.name.replace(/\.[^/.]+$/, '') + '.jpg';
			return new File([compressedFile], newName, { type: compressedFile.type });
		} catch (error) {
			console.error('图片处理失败:', error);
			throw new Error('无法处理图片，请尝试其他文件。');
		}
	}

	/**
	 * 使用 Tus 协议上传文件。
	 * 支持断点续传、分片和可靠上传。
	 */
	static uploadFile(file: File | Blob, config: UploadConfig): tus.Upload {
		const { endpoint, onProgress, onSuccess, onError, metadata, headers } = config;

		const upload = new tus.Upload(file, {
			endpoint,
			retryDelays: [0, 3000, 5000, 10000, 20000], // 重试策略
			metadata: {
				filename: (file as File).name,
				filetype: file.type,
				...metadata
			},
			headers: headers || {},
			onError: (error) => {
				console.error('上传失败:', error);
				if (onError) onError(error);
			},
			onProgress: (bytesUploaded, bytesTotal) => {
				if (onProgress) onProgress(bytesUploaded, bytesTotal);
			},
			onSuccess: () => {
				if (onSuccess) onSuccess();
			},
			// 针对移动网络兼容性调整分片大小
			chunkSize: 5 * 1024 * 1024 // 5MB 分片
		});

		upload.start();
		return upload;
	}

	/**
	 * 判断文件是否为视频。
	 */
	static isVideo(file: File): boolean {
		return file.type.startsWith('video/');
	}

	/**
	 * 判断文件是否为图片。
	 */
	static isImage(file: File): boolean {
		return file.type.startsWith('image/');
	}
}
