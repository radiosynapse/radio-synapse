/**
 * Timeshift Audio Buffer Engine for Radio Synapse
 * Continuously records the live Icecast stream in a sliding circular memory buffer (last 20 minutes)
 * and allows instant rewinding, timeline seeking, and full-length deferred playback.
 */

export interface BufferedChunk {
  timestamp: number; // Unix timestamp in ms
  data: Uint8Array;
}

export class LiveTimeshiftRecorder {
  private streamUrl: string = '';
  private abortController: AbortController | null = null;
  private isRecording: boolean = false;
  private chunks: BufferedChunk[] = [];
  private maxDurationMs: number = 20 * 60 * 1000; // Keep last 20 minutes of live stream
  private onStatusChange?: (bufferedSeconds: number) => void;

  constructor(onStatusChange?: (bufferedSeconds: number) => void) {
    this.onStatusChange = onStatusChange;
  }

  public start(streamUrl: string) {
    if (this.streamUrl === streamUrl && this.isRecording) {
      return;
    }

    this.stop();
    this.streamUrl = streamUrl;
    this.isRecording = true;
    this.abortController = new AbortController();

    this.recordLoop(streamUrl, this.abortController.signal);
  }

  public stop() {
    this.isRecording = false;
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  private async recordLoop(url: string, signal: AbortSignal) {
    try {
      const response = await fetch(url, { signal });
      if (!response.ok || !response.body) {
        throw new Error(`HTTP ${response.status}`);
      }

      const reader = response.body.getReader();

      while (this.isRecording && !signal.aborted) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value && value.length > 0) {
          const now = Date.now();
          this.chunks.push({
            timestamp: now,
            data: value
          });

          // Trim chunks older than maxDurationMs
          const cutoff = now - this.maxDurationMs;
          while (this.chunks.length > 0 && this.chunks[0].timestamp < cutoff) {
            this.chunks.shift();
          }

          if (this.onStatusChange && this.chunks.length > 1) {
            const bufferedSec = Math.floor((this.chunks[this.chunks.length - 1].timestamp - this.chunks[0].timestamp) / 1000);
            this.onStatusChange(bufferedSec);
          }
        }
      }
    } catch (err: any) {
      if (err.name !== 'AbortError' && this.isRecording) {
        // Retry connection after brief delay
        setTimeout(() => {
          if (this.isRecording && !signal.aborted) {
            this.recordLoop(url, signal);
          }
        }, 3000);
      }
    }
  }

  /**
   * Get the total duration in seconds currently available in the live buffer
   */
  public getAvailableBufferDurationSeconds(): number {
    if (this.chunks.length < 2) return 0;
    return Math.floor((this.chunks[this.chunks.length - 1].timestamp - this.chunks[0].timestamp) / 1000);
  }

  /**
   * Generates a playable Blob URL starting from X seconds ago
   */
  public getTimeshiftBlobUrl(secondsAgo: number): string | null {
    if (this.chunks.length === 0) return null;

    const targetTime = Date.now() - secondsAgo * 1000;
    const relevantChunks = this.chunks.filter(c => c.timestamp >= targetTime);

    if (relevantChunks.length === 0) {
      // Return all available chunks if target is older than buffer start
      return this.createBlobFromChunks(this.chunks);
    }

    return this.createBlobFromChunks(relevantChunks);
  }

  private createBlobFromChunks(chunkList: BufferedChunk[]): string | null {
    if (chunkList.length === 0) return null;

    // Concatenate Uint8Array chunks
    const totalBytes = chunkList.reduce((sum, c) => sum + c.data.length, 0);
    const combined = new Uint8Array(totalBytes);
    let offset = 0;
    for (const chunk of chunkList) {
      combined.set(chunk.data, offset);
      offset += chunk.data.length;
    }

    const blob = new Blob([combined], { type: 'audio/mpeg' });
    return URL.createObjectURL(blob);
  }

  public clear() {
    this.chunks = [];
  }
}
