import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL } from '@ffmpeg/util';

let ffmpegInstance: FFmpeg | null = null;
let loadingPromise: Promise<FFmpeg> | null = null;
let instancePoisoned = false;

const MAX_LOGS = 250;
const recentLogs: string[] = [];

function logEvent(event: string, details: Record<string, unknown> = {}) {
  const entry = {
    time: new Date().toISOString(),
    event,
    ...details,
  };

  const line = JSON.stringify(entry);
  recentLogs.push(line);
  if (recentLogs.length > MAX_LOGS) recentLogs.shift();

  console.info('[VideoDiag]', line);
}

function normalizeError(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    const result: Record<string, unknown> = {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };

    // Baca cause tanpa bergantung pada dukungan Error.cause di TypeScript.
    const cause = (error as Error & { cause?: unknown }).cause;

    if (cause instanceof Error) {
      result.cause = {
        name: cause.name,
        message: cause.message,
        stack: cause.stack,
      };
    } else if (cause !== undefined) {
      result.cause = String(cause);
    }

    return result;
  }

  if (typeof error === 'object' && error !== null) {
    const value = error as Record<string, unknown>;
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
      details: Object.fromEntries(
        Object.entries(value).map(([key, item]) => [
          key,
          typeof item === 'string' ||
          typeof item === 'number' ||
          typeof item === 'boolean'
            ? item
            : String(item),
        ])
      ),
    };
  }

  return { value: String(error) };
}
async function getFFmpeg(): Promise<FFmpeg> {
  if (instancePoisoned) {
    throw new Error(
      'Instance FFmpeg sebelumnya mengalami kegagalan fatal. Muat ulang halaman sebelum mencoba lagi.'
    );
  }

  if (ffmpegInstance?.loaded) return ffmpegInstance;

  if (!loadingPromise) {
    loadingPromise = (async () => {
      const ffmpeg = new FFmpeg();

      ffmpeg.on('log', ({ message }) => {
        const line = `${new Date().toISOString()} ${message}`;
        recentLogs.push(line);
        if (recentLogs.length > MAX_LOGS) recentLogs.shift();
        console.debug('[FFmpeg]', message);
      });

      const base = import.meta.env.BASE_URL.endsWith('/')
        ? import.meta.env.BASE_URL
        : `${import.meta.env.BASE_URL}/`;
      const coreJsURL = `${base}ffmpeg/ffmpeg-core.js`;
      const coreWasmURL = `${base}ffmpeg/ffmpeg-core.wasm`;

      logEvent('core.load.start', { coreJsURL, coreWasmURL });

      for (const url of [coreJsURL, coreWasmURL]) {
        const started = performance.now();
        let response: Response;

        try {
          response = await fetch(url, { cache: 'no-cache' });
        } catch (error) {
          logEvent('core.fetch.error', {
            url,
            durationMs: Math.round(performance.now() - started),
            error: normalizeError(error),
          });
          throw new Error(`Tidak dapat mengakses aset FFmpeg: ${url}. ${String(error)}`);
        }

        const contentType = response.headers.get('content-type') ?? '';
        logEvent('core.fetch.result', {
          url,
          status: response.status,
          ok: response.ok,
          contentType,
          contentLength: response.headers.get('content-length'),
          durationMs: Math.round(performance.now() - started),
        });

        if (!response.ok) {
          throw new Error(`Aset FFmpeg gagal dimuat (${response.status}): ${url}`);
        }

        if (url.endsWith('.js') &&
            !contentType.includes('javascript') &&
            !contentType.includes('ecmascript')) {
          logEvent('core.content-type.warning', { url, contentType });
        }
      }

      const coreURL = await toBlobURL(coreJsURL, 'text/javascript');
      const wasmURL = await toBlobURL(coreWasmURL, 'application/wasm');

      const started = performance.now();
      try {
        await ffmpeg.load({ coreURL, wasmURL });
      } catch (error) {
        logEvent('core.load.error', {
          durationMs: Math.round(performance.now() - started),
          error: normalizeError(error),
        });
        throw error;
      }

      logEvent('core.load.success', {
        durationMs: Math.round(performance.now() - started),
      });

      ffmpegInstance = ffmpeg;
      return ffmpeg;
    })().catch((error) => {
      loadingPromise = null;
      ffmpegInstance = null;
      logEvent('core.initialization.failed', { error: normalizeError(error) });
      throw error;
    });
  }

  return loadingPromise;
}

export type ProcessedVideo = {
  preview: File;
  thumbnail: File;
};

export async function processVideo(
  original: File,
  onProgress?: (progress: number) => void
): Promise<ProcessedVideo> {
  if (!original.type.startsWith('video/') &&
      !original.name.toLowerCase().endsWith('.mp4')) {
    throw new Error('Pilih file video yang valid.');
  }

  const startedAt = performance.now();
  const diagnosticStart = recentLogs.length;
  const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  let ffmpeg: FFmpeg | null = null;
  let stage = 'getFFmpeg';
  let currentCommand: string[] = [];
  let fatalError = false;

  const inputName = 'portfolio-input.mp4';
  const previewName = 'portfolio-preview.mp4';
  const thumbnailName = 'portfolio-thumbnail.jpg';
  const fileNames = [inputName, previewName, thumbnailName];

  const runStage = async <T>(
    name: string,
    operation: () => Promise<T>
  ): Promise<T> => {
    stage = name;
    const started = performance.now();
    logEvent('stage.start', { runId, stage: name });

    try {
      const result = await operation();
      logEvent('stage.success', {
        runId,
        stage: name,
        durationMs: Math.round(performance.now() - started),
      });
      return result;
    } catch (error) {
      fatalError = true;
      logEvent('stage.error', {
        runId,
        stage: name,
        durationMs: Math.round(performance.now() - started),
        command: currentCommand,
        error: normalizeError(error),
      });
      throw error;
    }
  };

  try {
    logEvent('process.start', {
      runId,
      file: {
        name: original.name,
        size: original.size,
        type: original.type,
        lastModified: original.lastModified,
      },
      userAgent: navigator.userAgent,
      memory: (performance as Performance & {
        memory?: { usedJSHeapSize?: number; totalJSHeapSize?: number; jsHeapSizeLimit?: number }
      }).memory,
    });

    ffmpeg = await runStage('getFFmpeg', () => getFFmpeg());

    const handleProgress = ({ progress }: { progress: number }) => {
      onProgress?.(Math.max(0, Math.min(100, Math.round(progress * 100))));
    };

    ffmpeg.on('progress', handleProgress);

    try {
      const data = await runStage('read original.arrayBuffer', async () => {
        const buffer = await original.arrayBuffer();
        logEvent('input.buffer.ready', {
          runId,
          byteLength: buffer.byteLength,
        });
        return new Uint8Array(buffer);
      });

      await runStage('writeFile input', async () => {
        await ffmpeg!.writeFile(inputName, data);
        logEvent('input.write.complete', {
          runId,
          file: inputName,
          bytes: data.byteLength,
        });

        const storedInput = await ffmpeg!.readFile(inputName);
        logEvent('input.verify.complete', {
          runId,
          file: inputName,
          storedBytes: typeof storedInput === 'string'
            ? storedInput.length
            : storedInput.byteLength,
          expectedBytes: data.byteLength,
          matches: typeof storedInput !== 'string' &&
            storedInput.byteLength === data.byteLength,
        });
      });

      // Diagnostic: test basic video decoding before thumbnail generation.
      currentCommand = [
        '-v', 'error',
        '-i', inputName,
        '-map', '0:v:0',
        '-frames:v', '1',
        '-f', 'null',
        '-',
      ];

      logEvent('command.start', {
        runId,
        stage: 'diagnostic-decode',
        args: currentCommand,
      });

      const decodeResult = await runStage('diagnostic decode', async () =>
        ffmpeg!.exec(currentCommand)
      );

      logEvent('command.result', {
        runId,
        stage: 'diagnostic-decode',
        exitCode: decodeResult,
      });

      if (decodeResult !== 0) {
        throw new Error(`Tes decode gagal. Exit code: ${decodeResult}`);
      }

      // Diagnostic: inspect available encoders without processing video.
      currentCommand = ['-hide_banner', '-encoders'];

      logEvent('command.start', {
        runId,
        stage: 'diagnostic-encoders',
        args: currentCommand,
      });

      const encoderResult = await runStage('diagnostic encoders', async () =>
        ffmpeg!.exec(currentCommand)
      );

      logEvent('command.result', {
        runId,
        stage: 'diagnostic-encoders',
        exitCode: encoderResult,
      });

      // Continue with the thumbnail test.
      currentCommand = [
        '-ss', '1',
        '-i', inputName,
        '-frames:v', '1',
        '-c:v', 'mjpeg',
        '-q:v', '3',
        '-y', thumbnailName,
      ];

      const thumbnailResult = await runStage('exec thumbnail', async () => {
        logEvent('command.start', {
          runId,
          stage: 'thumbnail',
          args: currentCommand,
        });
        return await ffmpeg!.exec(currentCommand);
      });

      logEvent('command.result', {
        runId,
        stage: 'thumbnail',
        exitCode: thumbnailResult,
      });

      if (thumbnailResult !== 0) {
        throw new Error(`FFmpeg gagal membuat thumbnail. Exit code: ${thumbnailResult}`);
      }

      currentCommand = [
        '-i', inputName,
        '-vf', "scale='min(720,iw)':-2",
        '-c:v', 'libx264',
        '-preset', 'ultrafast',
        '-crf', '28',
        '-c:a', 'aac',
        '-b:a', '128k',
        '-movflags', '+faststart',
        '-y', previewName,
      ];

      const previewResult = await runStage('exec preview', async () => {
        logEvent('command.start', {
          runId,
          stage: 'preview',
          args: currentCommand,
        });
        return await ffmpeg!.exec(currentCommand);
      });

      logEvent('command.result', {
        runId,
        stage: 'preview',
        exitCode: previewResult,
      });

      if (previewResult !== 0) {
        throw new Error(`FFmpeg gagal membuat video preview. Exit code: ${previewResult}`);
      }

      const outputFiles = await runStage('listDir output', () => ffmpeg!.listDir('/'));
      const files = outputFiles.map((item) => ({
        name: item.name,
        type: item.isDir ? 'directory' : 'file',
        size: 'size' in item ? item.size : undefined,
      }));

      logEvent('filesystem.output', { runId, files });

      const previewExists = outputFiles.some((item) => item.name === previewName);
      const thumbnailExists = outputFiles.some((item) => item.name === thumbnailName);

      if (!previewExists || !thumbnailExists) {
        throw new Error(
          `File output tidak lengkap. Preview: ${previewExists}, thumbnail: ${thumbnailExists}`
        );
      }

      const previewData = await runStage('readFile preview', () =>
        ffmpeg!.readFile(previewName)
      );
      const thumbnailData = await runStage('readFile thumbnail', () =>
        ffmpeg!.readFile(thumbnailName)
      );

      if (typeof previewData === 'string' || typeof thumbnailData === 'string') {
        throw new Error('Hasil pemrosesan video tidak valid: output berupa teks.');
      }

      const preview = new File([previewData], 'preview.mp4', { type: 'video/mp4' });
      const thumbnail = new File([thumbnailData], 'thumbnail.jpg', { type: 'image/jpeg' });

      logEvent('output.ready', {
        runId,
        previewBytes: preview.size,
        thumbnailBytes: thumbnail.size,
      });

      if (preview.size > 15 * 1024 * 1024) {
        throw new Error('Preview masih lebih dari 15 MB. Video terlalu kompleks; perlu penyesuaian kompresi.');
      }

      if (thumbnail.size > 2 * 1024 * 1024) {
        throw new Error('Thumbnail melebihi batas 2 MB.');
      }

      logEvent('process.success', {
        runId,
        durationMs: Math.round(performance.now() - startedAt),
      });

      return { preview, thumbnail };
    } finally {
      ffmpeg.off('progress', handleProgress);
    }
  } catch (error) {
    logEvent('process.failed', {
      runId,
      stage,
      command: currentCommand,
      durationMs: Math.round(performance.now() - startedAt),
      fatalError,
      error: normalizeError(error),
      recentFFmpegLogs: recentLogs.slice(-80),
      diagnosticEvents: recentLogs.slice(diagnosticStart),
    });

    console.error('[VideoDiag] Ringkasan kegagalan:', {
      runId,
      stage,
      command: currentCommand,
      durationMs: Math.round(performance.now() - startedAt),
      fatalError,
      error: normalizeError(error),
      recentFFmpegLogs: recentLogs.slice(-80),
    });

    if (fatalError) {
      instancePoisoned = true;
      ffmpegInstance = null;
      loadingPromise = null;
      logEvent('instance.marked.unusable', {
        runId,
        reason: 'Operasi FFmpeg gagal; reload halaman sebelum mencoba ulang.',
      });
    }

    throw error;
  } finally {
    if (ffmpeg && !instancePoisoned) {
      for (const name of fileNames) {
        try {
          await ffmpeg.deleteFile(name);
          logEvent('cleanup.success', { runId, file: name });
        } catch (error) {
          logEvent('cleanup.warning', {
            runId,
            file: name,
            error: normalizeError(error),
          });
        }
      }
    } else if (instancePoisoned) {
      logEvent('cleanup.skipped', {
        runId,
        reason: 'Instance FFmpeg dianggap tidak aman setelah error fatal.',
      });
    }
  }
}






