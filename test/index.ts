import {
  default as init,
  Comment,
  Element,
  HTMLRewriter as RawHTMLRewriter,
  TextChunk,
} from "../html_rewriter.js";
import type {
  DocumentHandlers,
  ElementHandlers,
  HTMLRewriterOptions as RawHTMLRewriterOptions,
} from "../html_rewriter.d.ts";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export class HTMLRewriter {
  private elementHandlers: [selector: string, handlers: ElementHandlers][] = [];
  private documentHandlers: DocumentHandlers[] = [];
  private promise: Promise<WebAssembly.Exports>;

  constructor(private readonly options?: RawHTMLRewriterOptions) {
    this.promise = init((async () => {
      const x = await Deno.open('./html_rewriter_bg.wasm', { read: true })
      const r = new Response(x.readable, { 
        headers: { 
          'content-type': 'application/wasm',
          // 'content-length': '' + (await x.stat()).size,
        }, 
      });
      return r;
    })())
  }

  on(selector: string, handlers: ElementHandlers): this {
    this.elementHandlers.push([selector, handlers]);
    return this;
  }

  onDocument(handlers: DocumentHandlers): this {
    this.documentHandlers.push(handlers);
    return this;
  }

  async transform(input: string): Promise<string> {
    await this.promise;

    let output = "";
    const rewriter = new RawHTMLRewriter((chunk: any) => {
      output += decoder.decode(chunk);
    }, this.options);
    for (const [selector, handlers] of this.elementHandlers) {
      rewriter.on(selector, handlers);
    }
    for (const handlers of this.documentHandlers) {
      rewriter.onDocument(handlers);
    }
    try {
      await rewriter.write(encoder.encode(input));
      await rewriter.end();
      return output;
    } finally {
      rewriter.free();
    }
  }
}

export const timeout = (t: number) => new Promise(r => setTimeout(r, t));
