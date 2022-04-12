wasm-pack-build:
	@echo "---> Building custom wasm-pack with asyncify enabled..."
	cd wasm-pack; cargo build --release

wasm-pack: wasm-pack-build
	@echo "---> Building WebAssembly with wasm-pack..."
	wasm-pack/target/release/wasm-pack build --target web

# Wraps write/end with asyncify magic and adds this returns for chaining
# diff -uN pkg/html_rewriter.js pkg2/html_rewriter.js > html_rewriter.js.patch
patch: wasm-pack
	@echo "---> Patching JavaScript glue code..."
	patch -uN pkg/html_rewriter.js < patches/html_rewriter.js.patch

dist: patch
	@echo "---> Copying required files to root..."
	cp pkg/html_rewriter.js .
	cp pkg/html_rewriter_bg.wasm .
	cp src/asyncify.js .
	cp src/html_rewriter.d.ts .

test:
	deno test test