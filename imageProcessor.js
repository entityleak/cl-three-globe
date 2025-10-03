// Image processing utilities for the social assets generator

export function calculateImageFit(imgWidth, imgHeight, canvasWidth, canvasHeight) {
	const imgAspect = imgWidth / imgHeight;
	const canvasAspect = canvasWidth / canvasHeight;
	
	let width, height, x, y;
	
	if (imgAspect > canvasAspect) {
		// Image is wider than canvas ratio - scale to fill height, crop sides
		height = canvasHeight;
		width = canvasHeight * imgAspect;
		x = (canvasWidth - width) / 2;
		y = 0;
	} else {
		// Image is taller than canvas ratio - scale to fill width, crop top/bottom
		width = canvasWidth;
		height = canvasWidth / imgAspect;
		x = 0;
		y = (canvasHeight - height) / 2;
	}
	
	return { x, y, width, height };
}

export function adjustContrastExposure(imageData, contrast, exposure) {
	const data = imageData.data;
	
	// Normalize values: contrast 0-2 (1 = no change), exposure -1 to 1 (0 = no change)
	const contrastFactor = contrast;
	const exposureFactor = Math.pow(2, exposure);
	
	for (let i = 0; i < data.length; i += 4) {
		// Apply exposure first (brightness adjustment)
		let r = (data[i] / 255) * exposureFactor;
		let g = (data[i + 1] / 255) * exposureFactor;
		let b = (data[i + 2] / 255) * exposureFactor;
		
		// Apply contrast (around midpoint 0.5)
		r = ((r - 0.5) * contrastFactor) + 0.5;
		g = ((g - 0.5) * contrastFactor) + 0.5;
		b = ((b - 0.5) * contrastFactor) + 0.5;
		
		// Clamp values to 0-1 range and convert back to 0-255
		data[i] = Math.max(0, Math.min(255, Math.round(r * 255)));
		data[i + 1] = Math.max(0, Math.min(255, Math.round(g * 255)));
		data[i + 2] = Math.max(0, Math.min(255, Math.round(b * 255)));
		// Alpha channel (data[i + 3]) remains unchanged
	}
	return imageData;
}

export function invertImageData(imageData) {
	const data = imageData.data;
	for (let i = 0; i < data.length; i += 4) {
		data[i] = 255 - data[i];         // Red
		data[i + 1] = 255 - data[i + 1]; // Green
		data[i + 2] = 255 - data[i + 2]; // Blue
		// Alpha channel (data[i + 3]) remains unchanged
	}
	return imageData;
}

export function applyMedianFilter(imageData, radius = 1) {
	const data = imageData.data;
	const width = imageData.width;
	const height = imageData.height;
	
	// Create new image data for filtered result
	const newImageData = new ImageData(width, height);
	const newData = newImageData.data;
	
	// Kernel size based on radius (diameter = radius * 2 + 1)
	const kernelSize = radius * 2 + 1;
	const kernelArea = kernelSize * kernelSize;
	
	// Process each pixel
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			const pixelIndex = (y * width + x) * 4;
			
			// Collect neighboring pixels for each channel
			const rValues = [];
			const gValues = [];
			const bValues = [];
			
			// Sample pixels in the kernel area
			for (let ky = -radius; ky <= radius; ky++) {
				for (let kx = -radius; kx <= radius; kx++) {
					const sampleX = Math.max(0, Math.min(width - 1, x + kx));
					const sampleY = Math.max(0, Math.min(height - 1, y + ky));
					const sampleIndex = (sampleY * width + sampleX) * 4;
					
					rValues.push(data[sampleIndex]);
					gValues.push(data[sampleIndex + 1]);
					bValues.push(data[sampleIndex + 2]);
				}
			}
			
			// Sort arrays and find median
			rValues.sort((a, b) => a - b);
			gValues.sort((a, b) => a - b);
			bValues.sort((a, b) => a - b);
			
			const medianIndex = Math.floor(kernelArea / 2);
			
			newData[pixelIndex] = rValues[medianIndex];     // Red
			newData[pixelIndex + 1] = gValues[medianIndex]; // Green
			newData[pixelIndex + 2] = bValues[medianIndex]; // Blue
			newData[pixelIndex + 3] = data[pixelIndex + 3]; // Alpha (unchanged)
		}
	}
	
	return newImageData;
}

async function loadPatternImageScaled(scale = 1) {
	return new Promise((resolve, reject) => {
		const img = new Image();
		img.onload = () => {
			const canvas = document.createElement('canvas');
			const ctx = canvas.getContext('2d');
			canvas.width = img.width * scale;
			canvas.height = img.height * scale;
			
			// Scale up pattern with nearest neighbor to maintain crisp edges
			ctx.imageSmoothingEnabled = false;
			ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
			const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
			resolve(imageData);
		};
		img.onerror = reject;
		img.src = '/static/dot_149.png';
	});
}

export async function applyPatternDithering(imageData, patternImageData) {
	const data = imageData.data;
	const width = imageData.width;
	const height = imageData.height;
	
	const patternData = patternImageData.data;
	const patternWidth = patternImageData.width;
	const patternHeight = patternImageData.height;
	
	// Create new image data for dithered result
	const newImageData = new ImageData(width, height);
	const newData = newImageData.data;
	
	// Process each pixel
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			const pixelIndex = (y * width + x) * 4;
			
			// Get source pixel brightness
			const r = data[pixelIndex];
			const g = data[pixelIndex + 1];
			const b = data[pixelIndex + 2];
			const brightness = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
			
			// Get corresponding pattern pixel
			const patternX = x % patternWidth;
			const patternY = y % patternHeight;
			const patternIndex = (patternY * patternWidth + patternX) * 4;
			const patternR = patternData[patternIndex];
			const patternBrightness = patternR / 255; // Use red channel as threshold
			
			// Apply threshold: if source brightness > pattern brightness, use white; else black
			const outputColor = brightness > patternBrightness ? 255 : 0;
			
			newData[pixelIndex] = outputColor;     // Red
			newData[pixelIndex + 1] = outputColor; // Green
			newData[pixelIndex + 2] = outputColor; // Blue
			newData[pixelIndex + 3] = 255;         // Alpha
		}
	}
	
	return newImageData;
}


async function loadPatternImage() {
	return new Promise((resolve, reject) => {
		const img = new Image();
		img.onload = () => {
			const canvas = document.createElement('canvas');
			const ctx = canvas.getContext('2d');
			canvas.width = img.width;
			canvas.height = img.height;
			ctx.drawImage(img, 0, 0);
			const imageData = ctx.getImageData(0, 0, img.width, img.height);
			resolve(imageData);
		};
		img.onerror = reject;
		img.src = '/static/dot_149.png';
	});
}

export async function processImage(image, canvasWidth, canvasHeight, effects) {
	if (!image) return null;
	
	// Create temporary canvas for image processing
	const tempCanvas = document.createElement('canvas');
	const tempCtx = tempCanvas.getContext('2d');
	
	tempCanvas.width = canvasWidth;
	tempCanvas.height = canvasHeight;
	
	// Draw and scale image to fit canvas
	const { x, y, width, height } = calculateImageFit(
		image.width,
		image.height,
		canvasWidth,
		canvasHeight
	);
	
	tempCtx.drawImage(image, x, y, width, height);
	
	// Get image data for processing
	let imageData = tempCtx.getImageData(0, 0, canvasWidth, canvasHeight);
	
	// Apply contrast and exposure adjustments
	if (effects.contrast !== undefined && effects.exposure !== undefined) {
		imageData = adjustContrastExposure(imageData, effects.contrast, effects.exposure);
	}
	
	// Apply pattern dithering by default
	const patternImageData = await loadPatternImage();
	imageData = await applyPatternDithering(imageData, patternImageData);

	// Apply median filter after dithering to smooth jagged edges
	if (effects.medianEnabled) {
		imageData = applyMedianFilter(imageData, effects.medianRadius);
	}

	// Apply effects
	if (effects.invertImage) {
		imageData = invertImageData(imageData);
	}
	
	
	return imageData;
}

export async function processImageForExport(image, canvasWidth, canvasHeight, effects) {
	if (!image) return null;
	
	const scale = 2; // 2x scale for export
	const exportWidth = canvasWidth * scale;
	const exportHeight = canvasHeight * scale;
	
	// Create temporary canvas for 2x scale processing
	const tempCanvas = document.createElement('canvas');
	const tempCtx = tempCanvas.getContext('2d');
	
	tempCanvas.width = exportWidth;
	tempCanvas.height = exportHeight;
	
	// Disable smoothing for crisp scaling
	tempCtx.imageSmoothingEnabled = false;
	
	// Draw and scale image to fit 2x canvas
	const { x, y, width, height } = calculateImageFit(
		image.width,
		image.height,
		exportWidth,
		exportHeight
	);
	
	tempCtx.drawImage(image, x, y, width, height);
	
	// Get image data for processing
	let imageData = tempCtx.getImageData(0, 0, exportWidth, exportHeight);
	
	// Apply contrast and exposure adjustments
	if (effects.contrast !== undefined && effects.exposure !== undefined) {
		imageData = adjustContrastExposure(imageData, effects.contrast, effects.exposure);
	}
	
	// Apply pattern dithering with 2x scaled pattern
	const patternImageData = await loadPatternImageScaled(scale);
	imageData = await applyPatternDithering(imageData, patternImageData);

	// Apply median filter at 2x scale (effectively smaller relative filter)
	if (effects.medianEnabled) {
		imageData = applyMedianFilter(imageData, effects.medianRadius);
	}

	// Apply effects
	if (effects.invertImage) {
		imageData = invertImageData(imageData);
	}
	
	return imageData;
}

export function renderText(ctx, textSettings) {
	const { content } = textSettings;
	if (!content.trim()) return;
	
	// Apply text properties
	ctx.font = `${textSettings.fontWeight} ${textSettings.fontSize}px ${textSettings.fontFamily}`;
	ctx.fillStyle = textSettings.color;
	ctx.textAlign = textSettings.textAlign;
	ctx.textBaseline = textSettings.textBaseline;
	
	// Apply effects
	if (textSettings.strokeEnabled) {
		ctx.strokeStyle = textSettings.strokeColor;
		ctx.lineWidth = textSettings.strokeWidth;
	}
	
	if (textSettings.shadowEnabled) {
		ctx.shadowOffsetX = textSettings.shadowOffsetX;
		ctx.shadowOffsetY = textSettings.shadowOffsetY;
		ctx.shadowBlur = textSettings.shadowBlur;
		ctx.shadowColor = textSettings.shadowColor;
	}
	
	// Handle multi-line text
	const lines = content.split('\n');
	const lineHeightPx = textSettings.fontSize * textSettings.lineHeight;
	
	lines.forEach((line, index) => {
		const lineY = textSettings.y + (index * lineHeightPx);
		
		if (textSettings.letterSpacing === 0) {
			// Standard rendering
			if (textSettings.strokeEnabled) {
				ctx.strokeText(line, textSettings.x, lineY);
			}
			ctx.fillText(line, textSettings.x, lineY);
		} else {
			// Custom letter spacing
			renderTextWithLetterSpacing(ctx, line, textSettings.x, lineY, textSettings.letterSpacing, textSettings.strokeEnabled);
		}
	});
	
	// Reset shadow
	ctx.shadowOffsetX = 0;
	ctx.shadowOffsetY = 0;
	ctx.shadowBlur = 0;
	ctx.shadowColor = 'transparent';
}

function renderTextWithLetterSpacing(ctx, text, startX, y, letterSpacing, strokeEnabled) {
	let currentX = startX;
	
	// Adjust starting position based on text alignment
	if (ctx.textAlign === 'center') {
		const totalWidth = measureTextWithLetterSpacing(ctx, text, letterSpacing);
		currentX = startX - totalWidth / 2;
	} else if (ctx.textAlign === 'right') {
		const totalWidth = measureTextWithLetterSpacing(ctx, text, letterSpacing);
		currentX = startX - totalWidth;
	}
	
	for (let i = 0; i < text.length; i++) {
		const char = text[i];
		
		if (strokeEnabled) {
			ctx.strokeText(char, currentX, y);
		}
		ctx.fillText(char, currentX, y);
		
		currentX += ctx.measureText(char).width + letterSpacing;
	}
}

function measureTextWithLetterSpacing(ctx, text, letterSpacing) {
	let totalWidth = 0;
	for (let i = 0; i < text.length; i++) {
		totalWidth += ctx.measureText(text[i]).width;
		if (i < text.length - 1) {
			totalWidth += letterSpacing;
		}
	}
	return totalWidth;
}

export async function renderCanvas(canvas, ctx, canvasSettings, textSettings, effects, imageStore) {
	if (!canvas || !ctx) return;
	
	// Clear canvas
	ctx.fillStyle = '#ffffff';
	ctx.fillRect(0, 0, canvas.width, canvas.height);
	
	// Process and draw image if available
	if (imageStore.original) {
		const processedImageData = await processImage(
			imageStore.original,
			canvasSettings.width,
			canvasSettings.height,
			effects
		);
		
		if (processedImageData) {
			ctx.putImageData(processedImageData, 0, 0);
		}
	}
	
	// Render text
	// renderText(ctx, textSettings);
}