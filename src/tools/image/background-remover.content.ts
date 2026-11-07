/**
 * Editorial content for the background-remover tool page.
 *
 * Kept out of ``background-remover.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'What it does and what comes out',
      body: 'Drop in a photo of a person and this tool runs the MODNet portrait-matting model in your browser to estimate a soft alpha matte for the subject, then writes a PNG where everything around the person is transparent. You can leave the background transparent or type a hex colour such as #ffffff to flatten the subject onto it. The output is always PNG, the one widely supported format that carries an alpha channel.',
    },
    {
      heading: 'When it is the right tool',
      body: 'Use it for a headshot that needs a plain background, a profile picture, a speaker photo for a slide, or a cut-out to drop into a design. It is a portrait model: hair, shoulders and soft edges are what it was trained on. A product shot, a pet or a landscape is outside its training and usually comes back with the whole frame kept or almost nothing selected.',
    },
    {
      heading: 'The two options',
      body: 'Background colour controls the result: the word transparent gives a see-through PNG, and any hex colour flattens the subject onto that solid fill and makes the PNG fully opaque. Edge cutoff, from 0 to 128, trims faint background haze left as a halo around the subject; at 0 the soft edge is exactly what the model produced, and raising it eats into that softness to remove the fringe.',
    },
    {
      heading: 'Limits to expect',
      body: 'The matte is soft by design, so hair and edges keep their natural falloff rather than a hard cut. The model weights are fetched from the Hugging Face Hub the first time you use the tool and then cached by your browser. The runtime assets are served by this site. Very large photos take longer, and a matte that covers everything or is empty is reported rather than silently exported.',
    },
    {
      heading: 'What leaves your device',
      body: 'Your photo does not. The model runs on your device and the image is never uploaded — the only external network traffic is the one-time download of the model weights. The runtime files come from this static site, and later runs work without contacting anything.',
    },
  ],
  faq: [
    {
      q: 'What gets downloaded?',
      a: 'The MODNet model weights are downloaded once from the Hugging Face Hub and cached in your browser. The ONNX runtime files are served by this site, including on GitHub Pages. Your images are never uploaded.',
    },
    {
      q: 'Is my photo sent anywhere?',
      a: 'No. The only external request is for the model weights on first use; the photo is processed entirely on your device.',
    },
    {
      q: 'Which images work best?',
      a: 'MODNet is a portrait matting model: it is best at isolating a single person. Group photos, pets or objects with no clear person may keep some background. Use the matte threshold to tighten feathered edges.',
    },
    {
      q: 'Why is my result pixelated or slightly off?',
      a: 'The model runs at 512 px then scales back up, so small, heavily-compressed or very high-resolution photos may show soft edges. Save as PNG to keep the alpha channel lossless.',
    },
  ],
} as const;
