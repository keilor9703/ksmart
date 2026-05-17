/**
 * Utility to compress and resize images before uploading to the server.
 * Constraints: WebP format, Max width 800px, Max size 150KB.
 */

export const compressImageToWebP = async (file, maxWidth = 800, quality = 0.75) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                // Resize logic
                if (width > maxWidth) {
                    height = Math.round((height * maxWidth) / width);
                    width = maxWidth;
                }

                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                // Convert to WebP Base64
                // Note: quality is between 0 and 1
                const dataUrl = canvas.toDataURL('image/webp', quality);
                
                // Estimate size in bytes (approximate)
                const base64Length = dataUrl.length - (dataUrl.indexOf(',') + 1);
                const padding = (dataUrl.charAt(dataUrl.length - 2) === '=') ? 2 : ((dataUrl.charAt(dataUrl.length - 1) === '=') ? 1 : 0);
                const actualSize = (base64Length * 0.75) - padding;

                console.log(`Original size: ${file.size} bytes`);
                console.log(`Compressed size: ${Math.round(actualSize)} bytes`);

                resolve(dataUrl);
            };
            img.onerror = (err) => reject(err);
        };
        reader.onerror = (err) => reject(err);
    });
};
