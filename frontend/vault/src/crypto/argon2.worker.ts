import { argon2id } from 'hash-wasm';

interface Argon2Request {
  id: number;
  password: string;
  salt: Uint8Array;
  parallelism: number;
  iterations: number;
  memorySize: number;
  hashLength: number;
}

self.onmessage = async (event: MessageEvent<Argon2Request>) => {
  const { id, password, salt, parallelism, iterations, memorySize, hashLength } = event.data;
  try {
    const hashHex = await argon2id({
      password,
      salt,
      parallelism,
      iterations,
      memorySize,
      hashLength,
      outputType: 'hex',
    });
    self.postMessage({ id, hashHex });
  } catch (err: any) {
    self.postMessage({ id, error: err?.message || String(err) });
  }
};
