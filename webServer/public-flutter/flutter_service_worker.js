'use strict';
const MANIFEST = 'flutter-app-manifest';
const TEMP = 'flutter-temp-cache';
const CACHE_NAME = 'flutter-app-cache';

const RESOURCES = {"main.dart.js": "ed3ff71448bbc43a6182bd6269fd87de",
"flutter_bootstrap.js": "83b2f91a503f5b5c4ba3e9e60c2256ed",
"favicon.png": "5dcef449791fa27946b3d35ad8803796",
"manifest.json": "96b3e2ee6852c0d22672c7a163d57d12",
"canvaskit/skwasm.worker.js": "bfb704a6c714a75da9ef320991e88b03",
"canvaskit/canvaskit.wasm": "afe4e31e8f3adb944a0883a694706404",
"canvaskit/canvaskit.js": "5fda3f1af7d6433d53b24083e2219fa0",
"canvaskit/chromium/canvaskit.wasm": "938f6103658d67ab8971f6225502b8af",
"canvaskit/chromium/canvaskit.js": "87325e67bf77a9b483250e1fb1b54677",
"canvaskit/chromium/canvaskit.js.symbols": "9f2dfa8c181a437290aa2b58e55da15d",
"canvaskit/canvaskit.js.symbols": "b85fedc601db924025e7936d851e7e7e",
"canvaskit/skwasm.wasm": "cae92e9f0585c2ecccb9fae9062349f8",
"canvaskit/skwasm.js": "f17a293d422e2c0b3a04962e68236cc2",
"canvaskit/skwasm.js.symbols": "c6f605aa7f865f54f11010319bec4307",
"version.json": "3cfb0133b2d7f1df147f0443e8de04a9",
"index.html": "dd7a8da1198208cd970e33ed55356584",
"/": "dd7a8da1198208cd970e33ed55356584",
"flutter.js": "383e55f7f3cce5be08fcf1f3881f585c",
"assets/images/gGrad.jpg": "cce8fe9f3b586c1bf330ff3506a2d11d",
"assets/images/qGrad.jpg": "5e044ddb81433d8e208cf4324ecf08aa",
"assets/images/rGrad.jpg": "044b5414513c7fbb441fc4bda3d34978",
"assets/images/eGrad.jpg": "90aeb120c3a0ea95f275fe51f0abd80b",
"assets/images/bGrad.jpg": "bf7cd4dacf065f3a9685b5f77eb27200",
"assets/images/fGrad.jpg": "d4e756f24d178aa24a0e9baa3ca3469a",
"assets/images/cGrad.jpg": "b3e19cbdb6cd5f991207ae0074a9c22d",
"assets/images/aGrad.jpg": "41d07c24fd4b941e1fb9132abce38695",
"assets/images/ceFlutter.jpeg": "eb4d1f89a05532597366b57fa6f83f19",
"assets/images/pGrad.jpg": "d7d8385d6a371de4e2a7d0ce4b172b38",
"assets/images/sGrad.jpg": "5a11a6e9ea2bef6692267207dc1c4e04",
"assets/images/lGrad.jpg": "6712b155811454c6ee908da2c1c2aa60",
"assets/images/mGrad.jpg": "bd42ae9c3ed8ad42dc684e586f7c82e3",
"assets/images/uGrad.jpg": "9b1d2018690d4866ac5b80098e8a40f7",
"assets/images/hGrad.jpg": "0a51908e0d6d9e1e9fa075fbdc744dc4",
"assets/images/jGrad.jpg": "5be2de10ae7d6b62e4c95e9469f4bddc",
"assets/images/kGrad.jpg": "ab75c2e7b3bbd6977c83453ba9f96895",
"assets/images/vGrad.jpg": "4ffac8d34075275d4d5a90761233f2e2",
"assets/images/zGrad.jpg": "e3b07702bed4e1039356b67d4a76f1ed",
"assets/images/codeEquityOrig.png": "7de7778274a88ce98afb54685a07607c",
"assets/images/iGrad.jpg": "ff5d394865543fd5fe48b45858fb7c63",
"assets/images/dGrad.jpg": "b675ab45412ed25a1abe84696d2725dd",
"assets/images/nGrad.jpg": "9e13ef55bc9bad3e828ed8521cca6247",
"assets/images/wGrad.jpg": "9e282e200af2a7290caa96b6b92222b8",
"assets/images/iAmAri.jpg": "3713d4d8c4750b2812121b0bd052112e",
"assets/images/oGrad.jpg": "e7c9ac8281ba7b7cbf3454d68e579c75",
"assets/images/ceFlutterLaunchIcon.jpeg": "f83b26fd3a655dd9736952f6333c5afe",
"assets/images/tGrad.jpg": "137b66026d00d5a22f773faaf64d02d0",
"assets/images/xGrad.jpg": "484ca475bfc911da3a39f8a4c9bd593a",
"assets/images/yGrad.jpg": "f586b9125764094f5624d4292900a5c1",
"assets/fonts/customLetters.ttf": "d8501aa12dd96d3dea86afe2ef46a6f9",
"assets/fonts/Mansalva-Regular.ttf": "3df5a9bbbb65409d04bb4429830b24c7",
"assets/fonts/MaterialIcons-Regular.otf": "8347ea5083ba38b07518c1356f95ce67",
"assets/fonts/customIcons.ttf": "274270a0b258590274f518a20d2c2042",
"assets/AssetManifest.json": "4b39afa727e59a39f96a9c697412cbe1",
"assets/FontManifest.json": "f07d1b8ebe59a68fcccd2f85f1921d78",
"assets/AssetManifest.bin": "6cea38658b796138849445b0a85d3c4d",
"assets/packages/fluttertoast/assets/toastify.css": "a85675050054f179444bc5ad70ffc635",
"assets/packages/fluttertoast/assets/toastify.js": "56e2c9cedd97f10e7e5f1cebd85d53e3",
"assets/packages/cupertino_icons/assets/CupertinoIcons.ttf": "e986ebe42ef785b27164c36a9abc7818",
"assets/files/awsconfiguration.json": "6693a1bcae72de7bf926719380e96190",
"assets/files/api_base_path.txt": "8cc78554c58a7eb3625504ea5e224f4f",
"assets/AssetManifest.bin.json": "39fc838d69bae331745fc2c8dad064bb",
"assets/NOTICES": "611dd3ed902cf1685974f662e162c99f",
"assets/shaders/ink_sparkle.frag": "ecc85a2e95f5e9f53123dcaf8cb9b6ce",
"icons/Icon-512.png": "96e752610906ba2a93c65f8abe1645f1",
"icons/Icon-192.png": "ac9a721a12bbc803b44f645561ecb1e1"};
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
