'use strict';
const MANIFEST = 'flutter-app-manifest';
const TEMP = 'flutter-temp-cache';
const CACHE_NAME = 'flutter-app-cache';

const RESOURCES = {"favicon.png": "5dcef449791fa27946b3d35ad8803796",
"main.dart.js": "0e97e037e6a8b4e5ab4cb040d36881d9",
"version.json": "3cfb0133b2d7f1df147f0443e8de04a9",
"flutter.js": "4b2350e14c6650ba82871f60906437ea",
"index.html.orig": "9e481afe3dc784880d62b499f0b2eb7c",
"index.html": "dd7a8da1198208cd970e33ed55356584",
"/": "dd7a8da1198208cd970e33ed55356584",
"canvaskit/skwasm.js": "ac0f73826b925320a1e9b0d3fd7da61c",
"canvaskit/chromium/canvaskit.js.symbols": "e115ddcfad5f5b98a90e389433606502",
"canvaskit/chromium/canvaskit.js": "b7ba6d908089f706772b2007c37e6da4",
"canvaskit/chromium/canvaskit.wasm": "016acebab4373bfdeee288e1ed2a7d75",
"canvaskit/canvaskit.js.symbols": "efc2cd87d1ff6c586b7d4c7083063a40",
"canvaskit/skwasm.wasm": "828c26a0b1cc8eb1adacbdd0c5e8bcfa",
"canvaskit/canvaskit.js": "26eef3024dbc64886b7f48e1b6fb05cf",
"canvaskit/skwasm.js.symbols": "96263e00e3c9bd9cd878ead867c04f3c",
"canvaskit/skwasm.worker.js": "89990e8c92bcb123999aa81f7e203b1c",
"canvaskit/canvaskit.wasm": "cf9a17f0622e7d92729eba8ca927e53d",
"flutter_bootstrap.js": "f98ea04d7d05d8d86a184b1f749eae8a",
"icons/Icon-512.png": "96e752610906ba2a93c65f8abe1645f1",
"icons/Icon-192.png": "ac9a721a12bbc803b44f645561ecb1e1",
"assets/packages/cupertino_icons/assets/CupertinoIcons.ttf": "e986ebe42ef785b27164c36a9abc7818",
"assets/packages/fluttertoast/assets/toastify.css": "a85675050054f179444bc5ad70ffc635",
"assets/packages/fluttertoast/assets/toastify.js": "56e2c9cedd97f10e7e5f1cebd85d53e3",
"assets/FontManifest.json": "f07d1b8ebe59a68fcccd2f85f1921d78",
"assets/shaders/ink_sparkle.frag": "ecc85a2e95f5e9f53123dcaf8cb9b6ce",
"assets/AssetManifest.bin": "dd08a39bbbe85f958fcae0d68986fe28",
"assets/images/sGrad.png": "b48c095849200fdb304fca0d2406aafe",
"assets/images/vGrad.png": "6a3b948bf11302ab8467b300baa13aa3",
"assets/images/ceFlutter.jpeg": "eb4d1f89a05532597366b57fa6f83f19",
"assets/images/eGrad.png": "02f054f1b1509c736796d01aa9c776dd",
"assets/images/oGrad.png": "c90fff34ddf0aac2fff19d8044f73879",
"assets/images/mGrad.png": "599147db9261f4dfc65a7e2b1ab73cb9",
"assets/images/uGrad.png": "8d2c97cf3fbb6dcefcef5373b6ef197a",
"assets/images/wGrad.png": "893a2389cdf1cc5e1a7c82f388acd003",
"assets/images/qGrad.png": "6cf98afc5f048e38d5236608149dc9a5",
"assets/images/codeEquityOrig.png": "7de7778274a88ce98afb54685a07607c",
"assets/images/xGrad.png": "dd681ceb3b6656f8831a04e03446fcb6",
"assets/images/ceFlutterLaunchIcon.jpeg": "f83b26fd3a655dd9736952f6333c5afe",
"assets/images/dGrad.png": "c5c9a8ec9cf5dacf5a82703b11d05f84",
"assets/images/cGrad.png": "a6261d439d86aebc234353d8decfafe3",
"assets/images/jGrad.png": "93bf6d7dd91e5f4de5f133a71eec4781",
"assets/images/kGrad.png": "98ec251c25c9bedc613455afa94177f4",
"assets/images/lGrad.png": "74b211dbefec7c07408ebad12cb913fd",
"assets/images/fGrad.png": "b9f89a371a3ff7ae5ad1eae3f30903f3",
"assets/images/pGrad.png": "96b3068c0a65e99051a8d09bfc7dc38d",
"assets/images/tGrad.png": "191c0f64e6f67090c9fabcb3f20c9b3c",
"assets/images/hGrad.png": "4ad3e8182ff8a18d454d73f26f89c532",
"assets/images/aGrad.png": "b2409b9719ea5ab8d0f77e3e66f37fb7",
"assets/images/bGrad.png": "e1544491dfe18a9e6d69931d721147d2",
"assets/images/yGrad.png": "3d97b0bea1cf3140353b339326cc4e2f",
"assets/images/nGrad.png": "6240b8cfd808ce60581dd59635d6e394",
"assets/images/gGrad.png": "371d51295de06a2768cb83c1b7d076b2",
"assets/images/rGrad.png": "872de014e2b26828b03b517f1fe680ce",
"assets/images/iGrad.png": "1594612806706fa0d2cd6b4c39b112fe",
"assets/images/zGrad.png": "a48382851541007f5bbf7b2c64505f53",
"assets/NOTICES": "f811c884c30ee14a5718a01f566b6271",
"assets/files/api_base_path.txt": "b28dc1979b628df6e512a707ec5e599f",
"assets/files/awsconfiguration.json": "dc2b5b2f36f3338cdd70f79c0eac9bfc",
"assets/AssetManifest.json": "326ba9132a7877b8cce97db526a985f2",
"assets/AssetManifest.bin.json": "202b6ea5a42a520978c5a4b632115dd1",
"assets/fonts/Mansalva-Regular.ttf": "3df5a9bbbb65409d04bb4429830b24c7",
"assets/fonts/customIcons.ttf": "274270a0b258590274f518a20d2c2042",
"assets/fonts/customLetters.ttf": "d8501aa12dd96d3dea86afe2ef46a6f9",
"assets/fonts/MaterialIcons-Regular.otf": "d8da7be875eb8f54b60cb928d667e05e",
"manifest.json": "96b3e2ee6852c0d22672c7a163d57d12"};
// The application shell files that are downloaded before a service worker can
// start.
const CORE = ["main.dart.js",
"index.html",
"flutter_bootstrap.js",
"assets/AssetManifest.bin.json",
"assets/FontManifest.json"];

// During install, the TEMP cache is populated with the application shell files.
self.addEventListener("install", (event) => {
  self.skipWaiting();
  return event.waitUntil(
    caches.open(TEMP).then((cache) => {
      return cache.addAll(
        CORE.map((value) => new Request(value, {'cache': 'reload'})));
    })
  );
});
// During activate, the cache is populated with the temp files downloaded in
// install. If this service worker is upgrading from one with a saved
// MANIFEST, then use this to retain unchanged resource files.
self.addEventListener("activate", function(event) {
  return event.waitUntil(async function() {
    try {
      var contentCache = await caches.open(CACHE_NAME);
      var tempCache = await caches.open(TEMP);
      var manifestCache = await caches.open(MANIFEST);
      var manifest = await manifestCache.match('manifest');
      // When there is no prior manifest, clear the entire cache.
      if (!manifest) {
        await caches.delete(CACHE_NAME);
        contentCache = await caches.open(CACHE_NAME);
        for (var request of await tempCache.keys()) {
          var response = await tempCache.match(request);
          await contentCache.put(request, response);
        }
        await caches.delete(TEMP);
        // Save the manifest to make future upgrades efficient.
        await manifestCache.put('manifest', new Response(JSON.stringify(RESOURCES)));
        // Claim client to enable caching on first launch
        self.clients.claim();
        return;
      }
      var oldManifest = await manifest.json();
      var origin = self.location.origin;
      for (var request of await contentCache.keys()) {
        var key = request.url.substring(origin.length + 1);
        if (key == "") {
          key = "/";
        }
        // If a resource from the old manifest is not in the new cache, or if
        // the MD5 sum has changed, delete it. Otherwise the resource is left
        // in the cache and can be reused by the new service worker.
        if (!RESOURCES[key] || RESOURCES[key] != oldManifest[key]) {
          await contentCache.delete(request);
        }
      }
      // Populate the cache with the app shell TEMP files, potentially overwriting
      // cache files preserved above.
      for (var request of await tempCache.keys()) {
        var response = await tempCache.match(request);
        await contentCache.put(request, response);
      }
      await caches.delete(TEMP);
      // Save the manifest to make future upgrades efficient.
      await manifestCache.put('manifest', new Response(JSON.stringify(RESOURCES)));
      // Claim client to enable caching on first launch
      self.clients.claim();
      return;
    } catch (err) {
      // On an unhandled exception the state of the cache cannot be guaranteed.
      console.error('Failed to upgrade service worker: ' + err);
      await caches.delete(CACHE_NAME);
      await caches.delete(TEMP);
      await caches.delete(MANIFEST);
    }
  }());
});
// The fetch handler redirects requests for RESOURCE files to the service
// worker cache.
self.addEventListener("fetch", (event) => {
  if (event.request.method !== 'GET') {
    return;
  }
  var origin = self.location.origin;
  var key = event.request.url.substring(origin.length + 1);
  // Redirect URLs to the index.html
  if (key.indexOf('?v=') != -1) {
    key = key.split('?v=')[0];
  }
  if (event.request.url == origin || event.request.url.startsWith(origin + '/#') || key == '') {
    key = '/';
  }
  // If the URL is not the RESOURCE list then return to signal that the
  // browser should take over.
  if (!RESOURCES[key]) {
    return;
  }
  // If the URL is the index.html, perform an online-first request.
  if (key == '/') {
    return onlineFirst(event);
  }
  event.respondWith(caches.open(CACHE_NAME)
    .then((cache) =>  {
      return cache.match(event.request).then((response) => {
        // Either respond with the cached resource, or perform a fetch and
        // lazily populate the cache only if the resource was successfully fetched.
        return response || fetch(event.request).then((response) => {
          if (response && Boolean(response.ok)) {
            cache.put(event.request, response.clone());
          }
          return response;
        });
      })
    })
  );
});
self.addEventListener('message', (event) => {
  // SkipWaiting can be used to immediately activate a waiting service worker.
  // This will also require a page refresh triggered by the main worker.
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
    return;
  }
  if (event.data === 'downloadOffline') {
    downloadOffline();
    return;
  }
});
// Download offline will check the RESOURCES for all files not in the cache
// and populate them.
async function downloadOffline() {
  var resources = [];
  var contentCache = await caches.open(CACHE_NAME);
  var currentContent = {};
  for (var request of await contentCache.keys()) {
    var key = request.url.substring(origin.length + 1);
    if (key == "") {
      key = "/";
    }
    currentContent[key] = true;
  }
  for (var resourceKey of Object.keys(RESOURCES)) {
    if (!currentContent[resourceKey]) {
      resources.push(resourceKey);
    }
  }
  return contentCache.addAll(resources);
}
// Attempt to download the resource online before falling back to
// the offline cache.
function onlineFirst(event) {
  return event.respondWith(
    fetch(event.request).then((response) => {
      return caches.open(CACHE_NAME).then((cache) => {
        cache.put(event.request, response.clone());
        return response;
      });
    }).catch((error) => {
      return caches.open(CACHE_NAME).then((cache) => {
        return cache.match(event.request).then((response) => {
          if (response != null) {
            return response;
          }
          throw error;
        });
      });
    })
  );
}
