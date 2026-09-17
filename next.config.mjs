/** @type {import('next').NextConfig} */
const nextConfig = {
  /* msedge-tts ichidagi 'ws' ixtiyoriy native modullarni (bufferutil,
     utf-8-validate) shartli require qiladi. Webpack buni bundle qilganda
     'bufferUtil.mask is not a function' bilan yiqiladi, natijada har bir TTS
     so'rovi 12s kutib 502 qaytaradi. Server paketi sifatida tashqarida
     qoldirilsa, Node uni odatdagidek yuklaydi. */
  serverExternalPackages: ['msedge-tts', 'ws'],

  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.epa.uz' },
    ],
  },
};

export default nextConfig;
