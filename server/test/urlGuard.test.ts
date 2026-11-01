import { describe,it,expect } from 'vitest';
import { validatePublicUrl } from '../src/scan/fetcher/urlGuard.js';
describe('validatePublicUrl',()=>{
  it('rejects localhost',async()=>{await expect(validatePublicUrl('http://localhost')).rejects.toThrow();});
  it('rejects loopback IP',async()=>{await expect(validatePublicUrl('http://127.0.0.1')).rejects.toThrow();});
  it('rejects credentials',async()=>{await expect(validatePublicUrl('https://user:pass@example.com')).rejects.toThrow();});
  it('rejects non-http protocols',async()=>{await expect(validatePublicUrl('file:///etc/passwd')).rejects.toThrow();});
  it('accepts public DNS host when it resolves publicly',async()=>{await expect(validatePublicUrl('https://example.com')).resolves.toBeInstanceOf(URL);});
});
