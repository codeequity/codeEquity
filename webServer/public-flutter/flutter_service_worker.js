'use strict';
const MANIFEST = 'flutter-app-manifest';
const TEMP = 'flutter-temp-cache';
const CACHE_NAME = 'flutter-app-cache';

const RESOURCES = {"favicon.png": "5dcef449791fa27946b3d35ad8803796",
"main.dart.js": "d50386d14ac4d20eb1a72221d800d752",
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
"flutter_bootstrap.js": "88e1178f083da07c0a4ee9524e076a32",
"icons/Icon-512.png": "96e752610906ba2a93c65f8abe1645f1",
"icons/Icon-192.png": "ac9a721a12bbc803b44f645561ecb1e1",
"assets/packages/cupertino_icons/assets/CupertinoIcons.ttf": "e986ebe42ef785b27164c36a9abc7818",
"assets/packages/fluttertoast/assets/toastify.css": "a85675050054f179444bc5ad70ffc635",
"assets/packages/fluttertoast/assets/toastify.js": "56e2c9cedd97f10e7e5f1cebd85d53e3",
"assets/FontManifest.json": "f07d1b8ebe59a68fcccd2f85f1921d78",
"assets/shaders/ink_sparkle.frag": "ecc85a2e95f5e9f53123dcaf8cb9b6ce",
"assets/AssetManifest.bin": "0100d8806858b49e7372415ab99e9e26",
"assets/images/settingsHere.svg": "8d591153721a1280de1f5785b5e19c9e",
"assets/images/ceFlutter.jpeg": "eb4d1f89a05532597366b57fa6f83f19",
"assets/images/project.svg": "7990c187b8ca606a594428c4d9f4836e",
"assets/images/home.svg": "42fb4d8d7b4ad3adbd9519c9acb512dc",
"assets/images/b.png": "b78b495d068f57619b9014142330fe84",
"assets/images/codeEquityOrig.png": "7de7778274a88ce98afb54685a07607c",
"assets/images/ceFlutterLaunchIcon.jpeg": "f83b26fd3a655dd9736952f6333c5afe",
"assets/images/searchHere.svg": "75933e5670c283deec3e07b0201c8a5c",
"assets/images/b.svg": "91aa23fb502216683a51c9722d7749c8",
"assets/images/bOrig.svg": "e890e6510d2ef986714779a9a1c2c12d",
"assets/images/projectHere.svg": "3325aade3183149fd382f33d3b38b3af",
"assets/images/settings.svg": "c251c3d1ccda343a50828832fb57d7fa",
"assets/images/profile.svg": "02a4516c31632b7cd6e651a7836d564a",
"assets/images/bOrig.png": "a2cb2ef56cf51173e854feb98e0cb816",
"assets/images/homeHere.svg": "bae8b206fbff94a62190f429020e3fdc",
"assets/images/search.svg": "abc16c3661a3a77689ec777f690e62d4",
"assets/images/profileHere.svg": "cd22344527b2b90e20b201c3209f9a9d",
"assets/NOTICES": "f811c884c30ee14a5718a01f566b6271",
"assets/files/api_base_path.txt": "2c7c07002bf8b64a353363fa0f303df7",
"assets/files/awsconfiguration.json": "f8aadcb1d87df727b5b53a077280fa2e",
"assets/AssetManifest.json": "eb8eea13f34cdff871748cfaea51d48b",
"assets/AssetManifest.bin.json": "d6666ed434a093beb8eab93de641ae9c",
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
