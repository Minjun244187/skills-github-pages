/*global Ultraviolet*/
// Paths are computed from this file's location so the proxy works from any
// subfolder (e.g. https://user.github.io/repo/ember/lib/).
(function () {
    var src = (self.document && document.currentScript && document.currentScript.src) || self.location.href;
    var base = new URL('./', src).pathname;
    self.__uv$config = {
        prefix: base + 'go/',
        encodeUrl: Ultraviolet.codec.xor.encode,
        decodeUrl: Ultraviolet.codec.xor.decode,
        handler: base + 'handler.js',
        client: base + 'client.js',
        bundle: base + 'bundle.js',
        config: base + 'config.js',
        sw: base + 'core.js',
    };
})();
