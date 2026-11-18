const VISION = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14'
const FACE_MODEL =
  'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite'
const DETECT_INTERVAL_MS = 66

export const cameraProblem = (error) => {
  if (!window.isSecureContext) {
    return 'Browsers allow the camera only on HTTPS or localhost. Open the HTTPS address of this page.'
  }
  if (!navigator.mediaDevices) return 'This browser view has no camera access. Open the page in a full browser.'
  if (error.name === 'NotFoundError') return 'No camera was found on this device.'
  if (error.name === 'NotReadableError') return 'Another app is using the camera. Close it, then try again.'
  return 'The camera is blocked. Allow it in the site settings and in your system privacy settings, then try again.'
}

export const openCamera = async () => {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
    audio: false,
  })
  return { stream, stop: () => stream.getTracks().forEach((track) => track.stop()) }
}

// a drawn stand-in, so the live state renders without a camera or a permission
export const mockCamera = () => {
  const canvas = document.createElement('canvas')
  canvas.width = 640
  canvas.height = 480
  const ctx = canvas.getContext('2d')
  const face = { x: 0.5, y: 0.52, size: 0.4 }
  let frame = 0

  const draw = (now) => {
    const sway = Math.sin(now / 1400)
    const room = ctx.createLinearGradient(0, 0, 640, 480)
    room.addColorStop(0, '#c9c2b4')
    room.addColorStop(0.55, '#8d949b')
    room.addColorStop(1, '#3c4148')
    ctx.fillStyle = room
    ctx.fillRect(0, 0, 640, 480)
    ctx.fillStyle = '#e9edf2'
    ctx.fillRect(40, 50, 150, 210)
    ctx.fillStyle = '#6f757c'
    ctx.fillRect(112, 50, 6, 210)
    ctx.fillRect(40, 150, 150, 6)

    const x = 320 + sway * 46
    const y = 228 + Math.cos(now / 1900) * 8
    ctx.fillStyle = '#2f3a4a'
    ctx.beginPath()
    ctx.ellipse(x, 520, 210, 170, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#b98a6c'
    ctx.fillRect(x - 34, 300, 68, 70)
    const skin = ctx.createRadialGradient(x - 26, y - 30, 20, x, y, 130)
    skin.addColorStop(0, '#e6bc9c')
    skin.addColorStop(1, '#a87657')
    ctx.fillStyle = skin
    ctx.beginPath()
    ctx.ellipse(x, y, 82, 104, sway * 0.06, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#2a1d16'
    ctx.beginPath()
    ctx.ellipse(x, y - 62, 88, 60, sway * 0.06, Math.PI, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.ellipse(x - 30, y - 8, 9, 6, 0, 0, Math.PI * 2)
    ctx.ellipse(x + 30, y - 8, 9, 6, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#7d3f37'
    ctx.fillRect(x - 22, y + 48, 44, 7)

    face.x = x / 640
    face.y = 1 - y / 480
    frame = requestAnimationFrame(draw)
  }
  frame = requestAnimationFrame(draw)

  const stream = canvas.captureStream(30)
  return {
    stream,
    face: () => ({ ...face }),
    stop: () => {
      cancelAnimationFrame(frame)
      stream.getTracks().forEach((track) => track.stop())
    },
  }
}

export const trackFace = async ({ video, onFace, signal }) => {
  const { FilesetResolver, FaceDetector } = await import(`${VISION}/vision_bundle.mjs`)
  const fileset = await FilesetResolver.forVisionTasks(`${VISION}/wasm`)
  const detector = await FaceDetector.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: FACE_MODEL, delegate: 'GPU' },
    runningMode: 'VIDEO',
    minDetectionConfidence: 0.7,
  })
  if (signal.aborted) return detector.close()
  const timer = setInterval(() => {
    if (video.readyState < 2) return
    const box = detector.detectForVideo(video, performance.now()).detections[0]?.boundingBox
    // a lost face keeps the last framing, so the reflection does not jump
    if (!box) return
    onFace({
      x: (box.originX + box.width / 2) / video.videoWidth,
      y: 1 - (box.originY + box.height / 2) / video.videoHeight,
      size: box.height / video.videoHeight,
    })
  }, DETECT_INTERVAL_MS)
  signal.addEventListener('abort', () => {
    clearInterval(timer)
    detector.close()
  })
}
