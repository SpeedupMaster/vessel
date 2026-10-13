import { spawn } from 'node:child_process';
import { Readable, Writable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

export interface ProcessOptions {
  cwd?: string;
  timeout?: number;
  input?: Readable | string;
  output?: Writable;
  onLog?: (text: string) => void;
  maxOutputBytes?: number;
}

/** Arguments are never interpreted by the host shell. Stream and exit failures both reject. */
export async function runProcess(command: string, args: string[], options: ProcessOptions = {}) {
  const child = spawn(command, args, { cwd: options.cwd, shell: false, windowsHide: true });
  let stdout = '';
  let stderr = '';
  let outputBytes = 0;
  const limit = options.maxOutputBytes ?? 4 * 1024 * 1024;
  let timer: ReturnType<typeof setTimeout>;
  const exited = new Promise<void>((resolve, reject) => {
    timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`Command timed out after ${options.timeout ?? 120000} ms`));
    }, options.timeout ?? 120000);
    child.once('error', reject);
    child.once('close', (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(stderr.trim() || `Command exited with ${code ?? signal}`));
    });
  });
  const capture = (chunk: Buffer, error: boolean) => {
    outputBytes += chunk.length;
    if (outputBytes > limit) {
      child.kill('SIGKILL');
      return;
    }
    const text = chunk.toString();
    if (error) stderr += text;
    else stdout += text;
    options.onLog?.(text);
  };
  child.stderr.on('data', (chunk: Buffer) => capture(chunk, true));
  if (!options.output) child.stdout.on('data', (chunk: Buffer) => capture(chunk, false));
  const tasks: Promise<unknown>[] = [exited];
  if (options.output) tasks.push(pipeline(child.stdout, options.output));
  if (options.input !== undefined) {
    const input = typeof options.input === 'string' ? Readable.from([options.input]) : options.input;
    tasks.push(pipeline(input, child.stdin));
  } else child.stdin.end();
  try {
    await Promise.all(tasks);
    if (outputBytes > limit) throw new Error('Command output exceeded the allowed size');
    return { stdout, stderr };
  } catch (error) {
    child.kill('SIGKILL');
    child.stdin.destroy();
    child.stdout.destroy();
    options.output?.destroy();
    if (options.input instanceof Readable) options.input.destroy();
    await Promise.allSettled(tasks);
    throw error;
  } finally {
    clearTimeout(timer!);
  }
}

export const runDocker = (args: string[], options?: ProcessOptions) => runProcess('docker', args, options);
