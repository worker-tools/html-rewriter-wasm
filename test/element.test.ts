// deno-lint-ignore-file
// import 'https://gist.githubusercontent.com/qwtel/b14f0f81e3a96189f7771f83ee113f64/raw/TestRequest.ts'
import {
  assert,
  assertExists,
  assertEquals,
  assertStrictEquals,
  assertStringIncludes,
  assertThrows,
  assertRejects,
  assertArrayIncludes,
} from 'https://deno.land/std@0.133.0/testing/asserts.ts'
const { test } = Deno;

import type { Element } from "../html_rewriter.d.ts";
import { HTMLRewriter, timeout } from "./index.ts";

// const elementMutationsInput = "<p>test</p>";
// const elementMutationsExpected = {
//   beforeAfter: [
//     "&lt;span&gt;before&lt;/span&gt;",
//     "<span>before html</span>",
//     "<p>",
//     "test",
//     "</p>",
//     "<span>after html</span>",
//     "&lt;span&gt;after&lt;/span&gt;",
//   ].join(""),
//   replace: "&lt;span&gt;replace&lt;/span&gt;",
//   replaceHtml: "<span>replace</span>",
//   remove: "",
// };

test("handles element properties", async () => {
  // t.plan(6);
  const res = await new HTMLRewriter()
    .on("p", {
      element(element) {
        assertEquals(element.tagName, "p");
        element.tagName = "h1";
        // assert(element.removed); // ??? ?? why
        assertEquals(element.namespaceURI, "http://www.w3.org/1999/xhtml");

        // Check element.attributes is an IterableIterator
        assertEquals(element.attributes.next(), {
          value: ["class", "red"],
          done: false,
        });
        assertEquals([...element.attributes], [["class", "red"]]);
      },
    })
    .transform('<p class="red">test</p>');
  assertEquals(res, '<h1 class="red">test</h1>');
});

test("handles element attribute methods", async () => {
  const res = await new HTMLRewriter()
    .on("p", {
      element(element) {
        assertEquals(element.getAttribute("class"), "red");
        assertEquals(element.getAttribute("id"), null);
        assert(element.hasAttribute("class"));
        assert(!element.hasAttribute("id"));
        element.setAttribute("id", "header");
        element.removeAttribute("class");
      },
    })
    .transform('<p class="red">test</p>');
  assertEquals(res, '<p id="header">test</p>');
});

// test(
//   "handles element mutations",
//   mutationsMacro,
//   (rw, element) => rw.on("p", { element }),
//   elementMutationsInput,
//   elementMutationsExpected
// );

test("handles element specific mutations", async () => {
  // prepend/append
  let res = await new HTMLRewriter()
    .on("p", {
      element(element) {
        element.prepend("<span>prepend</span>");
        element.prepend("<span>prepend html</span>", { html: true });
        element.append("<span>append</span>");
        element.append("<span>append html</span>", { html: true });
      },
    })
    .transform("<p>test</p>");
  assertEquals(
    res,
    [
      "<p>",
      "<span>prepend html</span>",
      "&lt;span&gt;prepend&lt;/span&gt;",
      "test",
      "&lt;span&gt;append&lt;/span&gt;",
      "<span>append html</span>",
      "</p>",
    ].join("")
  );

  // setInnerContent
  res = await new HTMLRewriter()
    .on("p", {
      element(element) {
        element.setInnerContent("<span>replace</span>");
      },
    })
    .transform("<p>test</p>");
  assertEquals(res, "<p>&lt;span&gt;replace&lt;/span&gt;</p>");
  res = await new HTMLRewriter()
    .on("p", {
      element(element) {
        element.setInnerContent("<span>replace</span>", { html: true });
      },
    })
    .transform("<p>test</p>");
  assertEquals(res, "<p><span>replace</span></p>");

  // removeAndKeepContent
  res = await new HTMLRewriter()
    .on("p", {
      element(element) {
        element.removeAndKeepContent();
      },
    })
    .transform("<p>test</p>");
  assertEquals(res, "test");
});

test("element allows chaining", async () => {
  await new HTMLRewriter()
    .on("p", {
      element(element) {
        assertEquals(element.before(""), element);
        assertEquals(element.after(""), element);
        assertEquals(element.replace(""), element);
        assertEquals(element.remove(), element);
        assertEquals(element.setAttribute("test", ""), element);
        assertEquals(element.removeAttribute("test"), element);
        assertEquals(element.prepend(""), element);
        assertEquals(element.append(""), element);
        assertEquals(element.setInnerContent(""), element);
        assertEquals(element.removeAndKeepContent(), element);
      },
    })
    .transform("<p>test</p>");
});

test("handles element async handler", async (t) => {
  const res = await new HTMLRewriter()
    .on("p", {
      async element(element) {
        await timeout(50);
        element.setInnerContent("new");
      },
    })
    .transform("<p>test</p>");
  assertEquals(res, "<p>new</p>");
});

test("handles element class handler", async (t) => {
  class Handler {
    constructor(private content: string) {}
    // noinspection JSUnusedGlobalSymbols
    element(element: Element) {
      element.setInnerContent(this.content);
    }
  }
  const res = await new HTMLRewriter()
    .on("p", new Handler("new"))
    .transform("<p>test</p>");
  assertEquals(res, "<p>new</p>");
});

test("handles end tag properties", async (t) => {
  const res = await new HTMLRewriter()
    .on("p", {
      element(element) {
        element.onEndTag(function (end) {
          assertEquals(this, element);
          assertEquals(end.name, "p");
          end.name = "h1";
        });
      },
    })
    .transform("<p>test</p>");
  assertEquals(res, "<p>test</h1>");
});

test("handles end tag mutations", async (t) => {
  const input = "<p>test</p>";
  const beforeAfterExpected = [
    "<p>",
    "test",
    "&lt;span&gt;before&lt;/span&gt;",
    "<span>before html</span>",
    "</p>",
    "<span>after html</span>",
    "&lt;span&gt;after&lt;/span&gt;",
  ].join("");
  const removeExpected = "<p>test";

  // before/after
  let res = await new HTMLRewriter()
    .on("p", {
      element(element) {
        const that = this;
        element.onEndTag((end) => {
          assertStrictEquals(this, that);
          end.before("<span>before</span>");
          end.before("<span>before html</span>", { html: true });
          end.after("<span>after</span>");
          end.after("<span>after html</span>", { html: true });
        });
      },
    })
    .transform(input);
  assertEquals(res, beforeAfterExpected);

  // remove
  res = await new HTMLRewriter()
    .on("p", {
      element(element) {
        element.onEndTag((end) => {
          end.remove();
        });
      },
    })
    .transform(input);
  assertEquals(res, removeExpected);
});

test("end tag allows chaining", async () => {
  await new HTMLRewriter()
    .on("p", {
      element(element) {
        element.onEndTag((end) => {
          assertEquals(end.before(""), end);
          assertEquals(end.after(""), end);
          assertEquals(end.remove(), end);
        });
      },
    })
    .transform("<p>test</p>");
});

test("handles end tag async handler", async () => {
  const res = await new HTMLRewriter()
    .on("p", {
      element(element) {
        element.onEndTag(async (end) => {
          await timeout(50);
          end.before("!");
        });
      },
    })
    .transform("<p>test</p>");
  assertEquals(res, "<p>test!</p>");
});

test("uses last end tag handler", async (t) => {
  const res = await new HTMLRewriter()
    .on("p", {
      element(element) {
        element.onEndTag((end) => {
          end.before("1");
        });
        element.onEndTag((end) => {
          end.before("2");
        });
      },
    })
    .transform("<p>test</p>");
  assertEquals(res, "<p>test2</p>");
});

test("throws error on no end tag", async () => {
  const res = new HTMLRewriter()
    .on("img", {
      element(element) {
        element.onEndTag(() => { throw Error('error') });
      },
    })
    .transform('<img src="" alt="">');
  await assertRejects(() => res, TypeError, "Parser error: No end tag.")
});
