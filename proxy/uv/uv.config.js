/*global Ultraviolet*/
// Paths are computed from this file's location so the proxy works from any
// subfolder (e.g. https://user.github.io/repo/proxy/uv/).
(function () {
    var src = (self.document && document.currentScript && document.currentScript.src) || self.location.href;
    var base = new URL('./', src).pathname;
    self.__uv$config = {
        prefix: base + 'service/',
        encodeUrl: Ultraviolet.codec.xor.encode,
        decodeUrl: Ultraviolet.codec.xor.decode,
        handler: base + 'uv.handler.js',
        client: base + 'uv.client.js',
        bundle: base + 'uv.bundle.js',
        config: base + 'uv.config.js',
        sw: base + 'uv.sw.js',
    };
})();
