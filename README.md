# FrameFlow — Virtual Glasses Prototype

A polished three-step browser demo:

1. Upload a normal glasses product photo and remove its background.
2. Upload a face photo or capture one with the live camera.
3. Detect facial landmarks, fit the glasses, fine-tune the result, and download it.

## Run the demo

Camera access and browser AI modules require a local web server (opening `index.html` directly is not enough).

### Option A: Node.js (included server)

```bash
npm start
```

Open `http://localhost:3000`. No package installation is required.

### Option B: Python

```bash
python -m http.server 8080
```

Open `http://localhost:8080`.

Allow camera access when prompted. The first AI operation downloads model files, so the first run may take longer and needs an internet connection.

## Browser processing used in this demo

- `@imgly/background-removal` removes the glasses background in-browser. If the AI module cannot load, a lightweight edge-color fallback keeps the demo usable for plain backgrounds.
- The selected product image is shown immediately while processing runs. Large source images are resized for safer browser memory use, and files over 20 MB are rejected with a clear message.
- MediaPipe Face Landmarker finds eye landmarks in-browser.
- Canvas composites the transparent glasses image over the face photo.
- No uploaded photo is intentionally sent to this demo's own server.

## Folder structure

```text
virtual-glasses-prototype/
├── index.html       # Three-step interface and semantic page structure
├── styles.css       # Responsive glassmorphism UI and animations
├── app.js           # Upload, camera, background removal, landmarks, compositing
├── server.mjs       # Tiny dependency-free Node.js demo server
├── package.json     # npm start command
└── README.md        # Setup, architecture, and production notes
```

## Next.js migration map

This no-build prototype deliberately separates structure, style, and behavior. In a Next.js App Router project, split it into:

```text
app/try-on/page.tsx
components/try-on/
├── TryOnWizard.tsx        # "use client"; owns wizard state
├── StepProgress.tsx
├── GlassesUploadStep.tsx  # Upload and processing status
├── FacePhotoStep.tsx      # Upload and camera capture
├── TryOnResultStep.tsx    # Canvas, fit controls, download
└── CameraCapture.tsx
lib/try-on/
├── backgroundRemoval.ts
├── faceLandmarks.ts
└── composite.ts
```

Anything using `window`, canvas, camera, dynamic browser imports, or MediaPipe must stay in a Client Component or a browser-only module. Load large AI libraries dynamically and render a loading state. Keep the original image objects and model instances in refs rather than React state; keep only serializable wizard state in state.

## Node.js production architecture

Browser-side background removal is convenient for this proof of concept, but product images are permanent catalog assets. In production:

1. An admin uploads the original glasses image to `POST /api/products/:id/frame-image`.
2. Node validates MIME type, dimensions, and file size, then stores the original privately.
3. A queue worker removes the background once, trims transparent padding, normalizes orientation/scale, and creates optimized WebP/PNG assets.
4. The processed asset is stored in object storage/CDN and its URL, dimensions, anchor point, and calibration values are saved with the product.
5. The customer-facing Next.js app downloads the already-processed transparent asset. Only face landmarks and the preview composition remain in the browser.

Suggested product metadata:

```json
{
  "tryOnImageUrl": "https://cdn.example.com/frames/123.webp",
  "naturalWidthMm": 138,
  "anchorX": 0.5,
  "anchorY": 0.48,
  "scaleMultiplier": 1.0,
  "verticalOffset": 0
}
```

For privacy, do not persist customer face photos by default. If server-side processing is later introduced, require clear consent, short retention, authenticated access, encryption, and an explicit deletion policy.

## Demo limitations

- The result is a 2D image overlay, not a physically rendered 3D GLB model.
- Occlusion (for example, glasses arms behind ears or hair) is not simulated.
- A forward-facing portrait with visible eyes gives the best fit.
- AI dependencies are loaded from public CDNs for simplicity. Pin, self-host, and review them before production.
- The IMG.LY background-removal package is published under AGPL; have the production architecture and licensing reviewed before adopting it in a commercial product, or replace it with an approved service/model.
- Mobile Safari and low-memory devices need dedicated performance testing.
