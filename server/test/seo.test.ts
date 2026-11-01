import {it,expect} from 'vitest';
import {analyzeSeo} from '../src/scan/analyze/seo.js';
it('extracts SEO metadata and canonical URL',()=>{
 const result=analyzeSeo('<html><head><title>Shop</title><meta name="description" content="A store"><link rel="canonical" href="https://example.com/"></head><body><h1>Shop</h1></body></html>','https://example.com/');
 expect(result.title).toBe('Shop');expect(result.metaDescription).toBe('A store');expect(result.h1Count).toBe(1);
});
