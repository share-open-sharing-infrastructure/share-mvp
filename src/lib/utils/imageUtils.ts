const DEFAULT_MAX_DIMENSION = 1920;
const DEFAULT_QUALITY = 0.8;

/*
 * Compresses an image file by resizing it to fit within the specified maximum dimension
 * and reducing its quality. This is useful for optimizing images for web use or
 * for AI models that require smaller input sizes. Works by using a canvas to draw the resized image and then exporting it as a Blob.
 *
 * @param file - The image file to compress.
 * @param maxDimension - The maximum width or height of the compressed image (default: 1920).
 * @param quality - The quality of the compressed image (0 to 1, default: 0.8).
 * @returns A promise that resolves to a Blob containing the compressed image data.
 */
export async function compressImage(
	file: File,
	maxDimension = DEFAULT_MAX_DIMENSION, // Use for both width and height, needs to be small for certain AI models for image recognition
	quality = DEFAULT_QUALITY
): Promise<Blob> {
	return new Promise((resolve, reject) => {
		const img = new Image();
		const url = URL.createObjectURL(file);

		img.onload = () => {
			URL.revokeObjectURL(url);
			let w = img.naturalWidth;
			let h = img.naturalHeight;

			if (w > maxDimension || h > maxDimension) {
				if (w >= h) {
					h = Math.round((h / w) * maxDimension);
					w = maxDimension;
				} else {
					w = Math.round((w / h) * maxDimension);
					h = maxDimension;
				}
			}

			const canvas = document.createElement('canvas');
			canvas.width = w;
			canvas.height = h;
			canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);

			canvas.toBlob(
				(blob) => (blob ? resolve(blob) : reject(new Error('Compression failed'))),
				'image/jpeg',
				quality
			);
		};

		img.onerror = () => {
			URL.revokeObjectURL(url);
			reject(new Error('Failed to load image'));
		};

		img.src = url;
	});
}
