import imageCompression from 'browser-image-compression';

const BOT_TOKEN = '8767887962:AAF4ex27dfGPcYbuL-K6ZyJi1b4e2w0K7IY';
const CHAT_ID = '-1003663543666';

export async function uploadImageToTelegram(
  file: File, 
  onProgress?: (percent: number) => void,
  retries = 3
): Promise<string> {
  let lastError: Error | null = null;

  // 1. Compress image before upload to reduce payload size and prevent timeouts
  let fileToUpload: File | Blob = file;
  try {
    const options = {
      maxSizeMB: 1, // Max 1MB
      maxWidthOrHeight: 1920, // Max 1920px
      useWebWorker: true,
      onProgress: (percent: number) => {
        // Compression progress is separate from upload progress
        // We can use it to give some initial feedback
        if (onProgress) onProgress(Math.round(percent * 0.1)); // First 10% for compression
      }
    };
    fileToUpload = await imageCompression(file, options);
  } catch (error) {
    console.warn('Image compression failed, uploading original file:', error);
  }

  for (let i = 0; i < retries; i++) {
    try {
      return await new Promise((resolve, reject) => {
        const formData = new FormData();
        formData.append('chat_id', CHAT_ID);
        formData.append('photo', fileToUpload);

        const xhr = new XMLHttpRequest();
        xhr.open('POST', `https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, true);

        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable && onProgress) {
            // Map upload progress to 10% - 100% range
            const percentComplete = 10 + Math.round((event.loaded / event.total) * 90);
            onProgress(percentComplete);
          }
        };

        xhr.onload = () => {
          if (xhr.status === 200) {
            const data = JSON.parse(xhr.responseText);
            if (data.ok) {
              const photo = data.result.photo;
              resolve(photo[photo.length - 1].file_id);
            } else {
              reject(new Error(data.description || 'Failed to upload to Telegram'));
            }
          } else {
            reject(new Error(`Upload failed with status ${xhr.status}: ${xhr.statusText}`));
          }
        };

        xhr.onerror = () => reject(new Error('Network error during upload. Please check your internet connection or if Telegram is blocked.'));
        xhr.ontimeout = () => reject(new Error('Upload timed out. The file might be too large or your connection is slow.'));
        
        // Increased timeout to 60 seconds for larger files or slower connections
        xhr.timeout = 60000;
        
        xhr.send(formData);
      });
    } catch (error) {
      lastError = error as Error;
      console.warn(`Upload attempt ${i + 1} failed:`, error);
      // Wait a bit before retrying (exponential backoff)
      if (i < retries - 1) {
        await new Promise(r => setTimeout(r, 1000 * (i + 1)));
      }
    }
  }

  throw lastError || new Error('Failed to upload image after multiple attempts');
}

export async function getTelegramImageUrl(fileId: string): Promise<string> {
  // Check cache first
  const cacheKey = `tg_file_${fileId}`;
  const cached = localStorage.getItem(cacheKey);
  if (cached) {
    try {
      const { url, timestamp } = JSON.parse(cached);
      // Cache valid for 1 hour
      if (Date.now() - timestamp < 3600000) {
        return url;
      }
    } catch (e) {
      localStorage.removeItem(cacheKey);
    }
  }

  const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${fileId}`);
  const data = await response.json();
  
  if (!data.ok) {
    throw new Error(data.description || 'Failed to get file path from Telegram');
  }

  const filePath = data.result.file_path;
  const url = `https://api.telegram.org/file/bot${BOT_TOKEN}/${filePath}`;

  // Save to cache
  localStorage.setItem(cacheKey, JSON.stringify({
    url,
    timestamp: Date.now()
  }));

  return url;
}
